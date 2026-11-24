import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { createHmac, randomBytes } from 'crypto';
import { DataSource, EntityManager, In, MoreThanOrEqual, Repository } from 'typeorm';
import { AuditoriaService } from '../../common/auditoria.service';
import { UsuarioActual } from '../../common/auth.types';
import { EstadoAsistencia, EstadoAsistente, EstadoLectura, OrigenRegistro, Rol, TipoAlerta } from '../../common/enums';
import { existe, hoyISO, minutos, num, regla } from '../../common/utils';
import {
  Asistencia, Aula, CargaAcademica, DetalleAsistencia, Estudiante, HorarioClase, Inscripcion, LecturaSensor, SensorAsistencia,
} from '../../database/entities';
import { AlertasService } from '../alertas/alertas.service';
import { AbrirAsistenciaDto, CorregirDto, LecturaDto, ManualDto, SensorDto, SensorUpdateDto } from './asistencia.dto';

/** Ventana antes de la apertura en la que una lectura todavía cuenta para la clase. */
const MARGEN_PREVIO_MIN = 30;

@Injectable()
export class AsistenciaService {
  constructor(
    private ds: DataSource,
    private config: ConfigService,
    @InjectRepository(Asistencia) private asistencias: Repository<Asistencia>,
    @InjectRepository(DetalleAsistencia) private detalles: Repository<DetalleAsistencia>,
    @InjectRepository(CargaAcademica) private cargas: Repository<CargaAcademica>,
    @InjectRepository(HorarioClase) private horarios: Repository<HorarioClase>,
    @InjectRepository(Inscripcion) private inscripciones: Repository<Inscripcion>,
    @InjectRepository(Estudiante) private estudiantes: Repository<Estudiante>,
    @InjectRepository(SensorAsistencia) private sensores: Repository<SensorAsistencia>,
    @InjectRepository(LecturaSensor) private lecturas: Repository<LecturaSensor>,
    @InjectRepository(Aula) private aulas: Repository<Aula>,
    private auditoria: AuditoriaService,
    private alertas: AlertasService,
  ) {}

  private get tolerancia() { return num(this.config.get('ASISTENCIA_TOLERANCIA_MIN'), 15); }

  private async cargaDelDocente(cargaId: number, actor: UsuarioActual) {
    const c = existe(await this.cargas.findOne({ where: { id: cargaId }, relations: { materia: true, horarios: true, periodo: true } }), 'Grupo no encontrado');
    if (actor.rol === Rol.DOCENTE && c.docenteId !== actor.docenteId) throw new ForbiddenException('No eres el docente de este grupo');
    if (actor.rol === Rol.COORDINADOR && c.programaId !== actor.programaId) throw new ForbiddenException('El grupo no pertenece a tu programa');
    return c;
  }

  private async asistenciaPropia(id: number, actor: UsuarioActual) {
    const a = existe(await this.asistencias.findOne({ where: { id }, relations: { carga: { materia: true }, aula: { sede: true } } }), 'Asistencia no encontrada');
    if (actor.rol === Rol.DOCENTE && a.carga.docenteId !== actor.docenteId) throw new ForbiddenException('No eres el docente de este grupo');
    if (actor.rol === Rol.COORDINADOR && a.carga.programaId !== actor.programaId) throw new ForbiddenException('El grupo no pertenece a tu programa');
    return a;
  }

  private estadoPorHora(a: Asistencia, leido: Date) {
    const tarde = leido.getTime() - new Date(a.horaApertura).getTime() > a.toleranciaMin * 60000;
    return tarde ? EstadoAsistente.TARDE : EstadoAsistente.PRESENTE;
  }

  // ---------- Abrir y cerrar ----------
  /** HU-30: solo para grupos de su carga; el aula se precarga desde el horario del día. */
  async abrir(dto: AbrirAsistenciaDto, actor: UsuarioActual) {
    const c = await this.cargaDelDocente(dto.cargaId, actor);
    regla(c.periodo.actual, 'Solo se toma asistencia en grupos del periodo actual');
    const abierta = await this.asistencias.findOneBy({ cargaId: c.id, estado: EstadoAsistencia.ABIERTA });
    if (abierta) throw new ConflictException('Este grupo ya tiene una asistencia abierta; ciérrala antes de abrir otra');

    const ahora = new Date();
    const dia = ahora.getDay() === 0 ? 7 : ahora.getDay();
    const hora = ahora.getHours() * 60 + ahora.getMinutes();
    let horario = dto.horarioId ? c.horarios.find((h) => h.id === dto.horarioId) : c.horarios.find((h) => h.dia === dia && hora >= minutos(h.horaInicio) - 15 && hora <= minutos(h.horaFin));
    if (this.config.get('ASISTENCIA_VALIDAR_FRANJA') === 'true') {
      regla(!!horario && horario.dia === dia && hora >= minutos(horario.horaInicio) - 15 && hora <= minutos(horario.horaFin), 'Solo puedes abrir la asistencia dentro de la franja de tu horario');
    }
    horario = horario ?? c.horarios.find((h) => h.dia === dia) ?? c.horarios[0];
    regla(!!horario, 'El grupo no tiene horario asignado');

    const a = await this.asistencias.save(this.asistencias.create({
      cargaId: c.id, horarioId: horario!.id, aulaId: horario!.aulaId, fecha: hoyISO(ahora), tema: dto.tema,
      horaApertura: ahora, toleranciaMin: this.tolerancia, estado: EstadoAsistencia.ABIERTA,
    }));
    await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'ABRIR_ASISTENCIA', entidad: 'asistencia', entidadId: a.id, despues: a });
    // Lecturas que llegaron antes de abrir (estaban en cola) se asignan ahora.
    const asignadas = await this.reprocesarPendientes(a);
    return { ...(await this.obtener(a.id, actor)), lecturasAsignadas: asignadas };
  }

  /** Al cerrar, quien no registró queda AUSENTE y se evalúan las alertas de inasistencia. */
  async cerrar(id: number, actor: UsuarioActual) {
    const a = await this.asistenciaPropia(id, actor);
    regla(a.estado === EstadoAsistencia.ABIERTA, 'La asistencia ya está cerrada');
    await this.ds.transaction(async (em) => {
      const inscritos = await em.findBy(Inscripcion, { cargaId: a.cargaId });
      const ya = new Set((await em.findBy(DetalleAsistencia, { asistenciaId: id })).map((d) => d.estudianteId));
      const faltan = inscritos.filter((i) => !ya.has(i.estudianteId));
      if (faltan.length) {
        await em.insert(DetalleAsistencia, faltan.map((i) => ({ asistenciaId: id, estudianteId: i.estudianteId, estado: EstadoAsistente.AUSENTE, origen: OrigenRegistro.SISTEMA, horaRegistro: null })));
      }
      await em.update(Asistencia, id, { estado: EstadoAsistencia.CERRADA, cerradaEn: new Date() });
      await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'CERRAR_ASISTENCIA', entidad: 'asistencia', entidadId: id, despues: { ausentes: faltan.length } }, em);
    });
    await this.evaluarInasistencia(a.cargaId);
    return this.obtener(id, actor);
  }

  /** Alerta temprana (HU-37): porcentaje de fallas sobre las sesiones cerradas del grupo. */
  private async evaluarInasistencia(cargaId: number) {
    const umbral = num(this.config.get('ALERTA_UMBRAL_INASISTENCIA'), 20);
    const carga = await this.cargas.findOne({ where: { id: cargaId }, relations: { materia: true } });
    if (!carga) return;
    const sesiones = await this.asistencias.countBy({ cargaId, estado: EstadoAsistencia.CERRADA });
    if (sesiones < 3) return; // con muy pocas clases el porcentaje no es representativo
    const filas = await this.detalles.createQueryBuilder('d').innerJoin('d.asistencia', 'a')
      .select('d.estudianteId', 'estudianteId').addSelect('SUM(CASE WHEN d.estado = :aus THEN 1 ELSE 0 END)', 'ausencias')
      .where('a.cargaId = :cargaId AND a.estado = :cer', { cargaId, cer: EstadoAsistencia.CERRADA, aus: EstadoAsistente.AUSENTE })
      .groupBy('d.estudianteId').getRawMany<{ estudianteId: number; ausencias: string }>();
    for (const f of filas) {
      const pct = (Number(f.ausencias) / sesiones) * 100;
      if (pct < umbral) continue;
      const e = await this.estudiantes.findOne({ where: { id: Number(f.estudianteId) }, relations: { usuario: true } });
      await this.alertas.crear({
        tipo: TipoAlerta.INASISTENCIA, programaId: carga.programaId, estudianteId: Number(f.estudianteId), cargaId,
        clave: `INASIST-${cargaId}-${f.estudianteId}`,
        mensaje: `${e?.usuario.nombres} ${e?.usuario.apellidos} lleva ${Math.round(pct)} % de fallas en ${carga.materia.nombre} grupo ${carga.grupo} (umbral ${umbral} %).`,
      });
    }
  }

  // ---------- Registro ----------
  /** Contingencia (HU-43): registro manual del docente. Si ya existe un registro se actualiza (nunca se duplica). */
  async manual(id: number, dto: ManualDto, actor: UsuarioActual, origen = OrigenRegistro.MANUAL) {
    const a = await this.asistenciaPropia(id, actor);
    const ins = await this.inscripciones.findOneBy({ cargaId: a.cargaId, estudianteId: dto.estudianteId });
    regla(!!ins, 'El estudiante no está inscrito en este grupo');
    if (a.estado === EstadoAsistencia.CERRADA) return this.corregirPorEstudiante(a, dto, actor);
    const previo = await this.detalles.findOneBy({ asistenciaId: id, estudianteId: dto.estudianteId });
    if (previo) {
      await this.detalles.update(previo.id, { estado: dto.estado, origen, motivo: dto.motivo ?? previo.motivo });
    } else {
      await this.detalles.insert({ asistenciaId: id, estudianteId: dto.estudianteId, estado: dto.estado, origen, horaRegistro: new Date(), motivo: dto.motivo ?? null });
    }
    await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'ASISTENCIA_MANUAL', entidad: 'detalle_asistencia', entidadId: previo?.id ?? null, antes: previo, despues: { asistenciaId: id, ...dto } });
    return this.obtener(id, actor);
  }

  private async corregirPorEstudiante(a: Asistencia, dto: ManualDto, actor: UsuarioActual) {
    const d = existe(await this.detalles.findOneBy({ asistenciaId: a.id, estudianteId: dto.estudianteId }), 'No hay registro para corregir');
    return this.corregir(d.id, { estado: dto.estado, motivo: dto.motivo || 'Corrección manual' }, actor);
  }

  /** HU-32: corrección auditada con motivo, solo dentro de las 48 h siguientes a la clase. */
  async corregir(detalleId: number, dto: CorregirDto, actor: UsuarioActual) {
    const d = existe(await this.detalles.findOne({ where: { id: detalleId }, relations: { asistencia: { carga: true } } }), 'Registro no encontrado');
    if (actor.rol === Rol.DOCENTE && d.asistencia.carga.docenteId !== actor.docenteId) throw new ForbiddenException('No eres el docente de este grupo');
    const horas = num(this.config.get('ASISTENCIA_CORRECCION_HORAS'), 48);
    const limite = new Date(new Date(d.asistencia.horaApertura).getTime() + horas * 3600000);
    regla(new Date() <= limite, `Solo se puede corregir dentro de las ${horas} horas siguientes a la clase`);
    await this.detalles.update(detalleId, { estado: dto.estado, motivo: dto.motivo, origen: OrigenRegistro.MANUAL });
    await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'CORREGIR_ASISTENCIA', entidad: 'detalle_asistencia', entidadId: detalleId, antes: { estado: d.estado }, despues: dto });
    if (d.asistencia.estado === EstadoAsistencia.CERRADA) await this.evaluarInasistencia(d.asistencia.cargaId);
    return this.detalles.findOneBy({ id: detalleId });
  }

  // ---------- QR ----------
  /** Código de 6 caracteres que rota cada 5 minutos, derivado del id de la sesión. */
  private codigoQr(asistenciaId: number, ventana: number) {
    const secreto = this.config.get<string>('JWT_SECRET') ?? 'qr';
    const h = createHmac('sha256', secreto).update(`${asistenciaId}:${ventana}`).digest();
    const abc = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    return Array.from(h.subarray(0, 6)).map((b) => abc[b % abc.length]).join('').padEnd(6, '2');
  }

  async qr(id: number, actor: UsuarioActual) {
    const a = await this.asistenciaPropia(id, actor);
    regla(a.estado === EstadoAsistencia.ABIERTA, 'La asistencia está cerrada');
    const ventana = Math.floor(Date.now() / 300000);
    return { codigo: this.codigoQr(id, ventana), venceEn: new Date((ventana + 1) * 300000) };
  }

  async marcarQr(codigo: string, actor: UsuarioActual) {
    const ins = await this.inscripciones.findBy({ estudianteId: actor.estudianteId });
    regla(ins.length > 0, 'No tienes materias inscritas');
    const abiertas = await this.asistencias.find({ where: { cargaId: In(ins.map((i) => i.cargaId)), estado: EstadoAsistencia.ABIERTA }, relations: { carga: { materia: true } } });
    const ventana = Math.floor(Date.now() / 300000);
    const a = abiertas.find((x) => [ventana, ventana - 1].some((v) => this.codigoQr(x.id, v) === codigo.toUpperCase()));
    regla(!!a, 'El código no corresponde a ninguna clase abierta de tus materias o ya venció');
    const previo = await this.detalles.findOneBy({ asistenciaId: a!.id, estudianteId: actor.estudianteId });
    if (previo) return { ok: true, estado: previo.estado, materia: a!.carga.materia.nombre, mensaje: 'Tu asistencia ya estaba registrada' };
    const estado = this.estadoPorHora(a!, new Date());
    await this.detalles.insert({ asistenciaId: a!.id, estudianteId: actor.estudianteId!, estado, origen: OrigenRegistro.QR, horaRegistro: new Date() });
    return { ok: true, estado, materia: a!.carga.materia.nombre };
  }

  // ---------- Sensor ----------
  private async sensorAutenticado(codigo: string, token: string) {
    const s = await this.sensores.createQueryBuilder('s').addSelect('s.tokenHash').where('s.codigo = :codigo', { codigo }).getOne();
    if (!s || !s.activo || !token || !(await bcrypt.compare(token, s.tokenHash))) throw new UnauthorizedException('Sensor no autorizado');
    return s;
  }

  async heartbeat(codigo: string, token: string) {
    const s = await this.sensorAutenticado(codigo, token);
    await this.sensores.update(s.id, { ultimaSenal: new Date() });
    return { ok: true, servidor: new Date() };
  }

  /**
   * HU-31 / CP-07 / CP-08: recibe un lote de lecturas (las que el sensor guardó en memoria si no tenía red).
   * Se guarda la hora real de la lectura, se ignoran duplicados y si no hay sesión abierta la lectura queda en cola.
   */
  async recibirLecturas(codigo: string, token: string, lecturas: LecturaDto[]) {
    const s = await this.sensorAutenticado(codigo, token);
    await this.sensores.update(s.id, { ultimaSenal: new Date() });
    // Se procesan en orden cronológico, pero la respuesta conserva el orden en que llegaron.
    const resultados: { carne: string; leidoEn: string; estado: EstadoLectura; detalle: string | null }[] = new Array(lecturas.length);
    const orden = lecturas.map((l, i) => ({ l, i })).sort((a, b) => a.l.leidoEn.localeCompare(b.l.leidoEn));
    for (const { l, i } of orden) {
      const r = await this.ds.transaction((em) => this.procesarLectura(em, s, l.carne, new Date(l.leidoEn)));
      resultados[i] = { carne: l.carne, leidoEn: l.leidoEn, ...r };
    }
    const resumen = resultados.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.estado]: (acc[r.estado] ?? 0) + 1 }), {});
    return { recibidas: lecturas.length, resumen, resultados };
  }

  private async procesarLectura(em: EntityManager, s: SensorAsistencia, carne: string, leidoEn: Date, existente?: LecturaSensor) {
    const guardar = async (estado: EstadoLectura, detalle: string | null, asistenciaId: number | null = null) => {
      if (existente) await em.update(LecturaSensor, existente.id, { estado, detalle, asistenciaId });
      else await em.insert(LecturaSensor, { sensorId: s.id, codigoCarne: carne, leidoEn, estado, detalle, asistenciaId });
      return { estado, detalle };
    };
    const desde = new Date(leidoEn.getTime() - 12 * 3600000);
    const a = await em.findOne(Asistencia, {
      where: { aulaId: s.aulaId, horaApertura: MoreThanOrEqual(desde) },
      order: { horaApertura: 'DESC' },
    });
    const enVentana = a && leidoEn.getTime() >= new Date(a.horaApertura).getTime() - MARGEN_PREVIO_MIN * 60000 &&
      (a.estado === EstadoAsistencia.ABIERTA || (a.cerradaEn && leidoEn <= new Date(a.cerradaEn)));
    if (!a || !enVentana) return guardar(EstadoLectura.PENDIENTE, 'No hay asistencia abierta en el aula a esa hora');

    const est = await em.findOneBy(Estudiante, { codigoCarne: carne });
    if (!est) return guardar(EstadoLectura.RECHAZADA, 'Carné no registrado', a.id);
    const ins = await em.findOneBy(Inscripcion, { cargaId: a.cargaId, estudianteId: est.id });
    if (!ins) return guardar(EstadoLectura.RECHAZADA, 'El estudiante no está inscrito en este grupo', a.id);
    const previo = await em.findOneBy(DetalleAsistencia, { asistenciaId: a.id, estudianteId: est.id });
    if (previo) {
      // Si la clase se cerró sin conexión y el estudiante quedó AUSENTE, la lectura atrasada lo corrige.
      if (previo.origen === OrigenRegistro.SISTEMA && previo.estado === EstadoAsistente.AUSENTE) {
        await em.update(DetalleAsistencia, previo.id, { estado: this.estadoPorHora(a, leidoEn), origen: OrigenRegistro.SENSOR, horaRegistro: leidoEn });
        return guardar(EstadoLectura.PROCESADA, 'Registrada al reconectar el sensor', a.id);
      }
      return guardar(EstadoLectura.DUPLICADA, 'El estudiante ya tenía registro en esta clase', a.id);
    }
    await em.insert(DetalleAsistencia, { asistenciaId: a.id, estudianteId: est.id, estado: this.estadoPorHora(a, leidoEn), origen: OrigenRegistro.SENSOR, horaRegistro: leidoEn });
    return guardar(EstadoLectura.PROCESADA, null, a.id);
  }

  private async reprocesarPendientes(a: Asistencia) {
    const sensores = await this.sensores.findBy({ aulaId: a.aulaId });
    if (!sensores.length) return 0;
    const desde = new Date(new Date(a.horaApertura).getTime() - MARGEN_PREVIO_MIN * 60000);
    const pendientes = await this.lecturas.find({ where: { sensorId: In(sensores.map((s) => s.id)), estado: EstadoLectura.PENDIENTE, leidoEn: MoreThanOrEqual(desde) }, order: { leidoEn: 'ASC' } });
    for (const l of pendientes) {
      const s = sensores.find((x) => x.id === l.sensorId)!;
      await this.ds.transaction((em) => this.procesarLectura(em, s, l.codigoCarne, new Date(l.leidoEn), l));
    }
    return pendientes.length;
  }

  // ---------- Consultas ----------
  async obtener(id: number, actor: UsuarioActual) {
    const a = await this.asistenciaPropia(id, actor);
    const inscritos = await this.inscripciones.find({ where: { cargaId: a.cargaId }, relations: { estudiante: { usuario: true } } });
    const dets = await this.detalles.findBy({ asistenciaId: id });
    const porEst = new Map(dets.map((d) => [d.estudianteId, d]));
    const novedades = await this.lecturas.find({ where: { asistenciaId: id, estado: In([EstadoLectura.RECHAZADA]) }, order: { leidoEn: 'ASC' } });
    const lista = inscritos.map((i) => {
      const d = porEst.get(i.estudianteId);
      return {
        estudianteId: i.estudianteId, codigoCarne: i.estudiante.codigoCarne,
        nombre: `${i.estudiante.usuario.apellidos} ${i.estudiante.usuario.nombres}`,
        detalleId: d?.id ?? null, estado: d?.estado ?? null, origen: d?.origen ?? null, horaRegistro: d?.horaRegistro ?? null, motivo: d?.motivo ?? null,
      };
    }).sort((x, y) => x.nombre.localeCompare(y.nombre));
    const conteo = { PRESENTE: 0, TARDE: 0, AUSENTE: 0, EXCUSADO: 0, SIN_REGISTRO: 0 } as Record<string, number>;
    lista.forEach((l) => conteo[l.estado ?? 'SIN_REGISTRO']++);
    const horas = num(this.config.get('ASISTENCIA_CORRECCION_HORAS'), 48);
    const corregibleHasta = new Date(new Date(a.horaApertura).getTime() + horas * 3600000);
    return { ...a, lista, conteo, novedades, corregibleHasta, corregible: new Date() <= corregibleHasta };
  }

  async listar(cargaId: number, actor: UsuarioActual) {
    await this.cargaDelDocente(cargaId, actor);
    const rows = await this.asistencias.find({ where: { cargaId }, relations: { aula: true }, order: { horaApertura: 'DESC' } });
    return rows;
  }

  async abiertasDocente(actor: UsuarioActual) {
    return this.asistencias.find({ where: { estado: EstadoAsistencia.ABIERTA, carga: { docenteId: actor.docenteId } }, relations: { carga: { materia: true }, aula: true } });
  }

  /** HU-33: porcentaje de fallas por materia = ausencias / sesiones dictadas. */
  async mias(actor: UsuarioActual) {
    const umbral = num(this.config.get('ALERTA_UMBRAL_INASISTENCIA'), 20);
    const ins = await this.inscripciones.find({ where: { estudianteId: actor.estudianteId, carga: { periodo: { actual: true } } }, relations: { carga: { materia: true } } });
    const out = [];
    for (const i of ins) {
      const sesiones = await this.asistencias.find({ where: { cargaId: i.cargaId, estado: EstadoAsistencia.CERRADA }, order: { fecha: 'DESC' } });
      const dets = sesiones.length ? await this.detalles.findBy({ asistenciaId: In(sesiones.map((s) => s.id)), estudianteId: actor.estudianteId }) : [];
      const m = new Map(dets.map((d) => [d.asistenciaId, d]));
      const c = (e: EstadoAsistente) => dets.filter((d) => d.estado === e).length;
      const ausencias = c(EstadoAsistente.AUSENTE);
      const pct = sesiones.length ? Math.round((ausencias / sesiones.length) * 1000) / 10 : 0;
      out.push({
        cargaId: i.cargaId, materia: i.carga.materia.nombre, grupo: i.carga.grupo, sesiones: sesiones.length,
        presentes: c(EstadoAsistente.PRESENTE), tardes: c(EstadoAsistente.TARDE), ausencias, excusas: c(EstadoAsistente.EXCUSADO),
        porcentajeFallas: pct, umbral, enRiesgo: pct >= umbral * 0.75,
        historial: sesiones.map((s) => ({ fecha: s.fecha, tema: s.tema, estado: m.get(s.id)?.estado ?? null })),
      });
    }
    return out;
  }

  /** HU-34: consolidado por grupo y rango de fechas. */
  async consolidado(cargaId: number, actor: UsuarioActual, desde?: string, hasta?: string) {
    const c = await this.cargaDelDocente(cargaId, actor);
    let sesiones = await this.asistencias.find({ where: { cargaId, estado: EstadoAsistencia.CERRADA }, order: { fecha: 'ASC' } });
    if (hasta) sesiones = sesiones.filter((s) => s.fecha <= hasta);
    if (desde) sesiones = sesiones.filter((s) => s.fecha >= desde);
    const inscritos = await this.inscripciones.find({ where: { cargaId }, relations: { estudiante: { usuario: true } } });
    const dets = sesiones.length ? await this.detalles.findBy({ asistenciaId: In(sesiones.map((s) => s.id)) }) : [];
    const umbral = num(this.config.get('ALERTA_UMBRAL_INASISTENCIA'), 20);
    const filas = inscritos.map((i) => {
      const mis = dets.filter((d) => d.estudianteId === i.estudianteId);
      const n = (e: EstadoAsistente) => mis.filter((d) => d.estado === e).length;
      const aus = n(EstadoAsistente.AUSENTE);
      const pct = sesiones.length ? Math.round((aus / sesiones.length) * 1000) / 10 : 0;
      return {
        estudianteId: i.estudianteId, codigoCarne: i.estudiante.codigoCarne, nombre: `${i.estudiante.usuario.apellidos} ${i.estudiante.usuario.nombres}`,
        presentes: n(EstadoAsistente.PRESENTE), tardes: n(EstadoAsistente.TARDE), ausencias: aus, excusas: n(EstadoAsistente.EXCUSADO),
        porcentajeFallas: pct, enRiesgo: pct >= umbral,
      };
    }).sort((a, b) => a.nombre.localeCompare(b.nombre));
    return { grupo: { id: c.id, materia: c.materia.nombre, grupo: c.grupo }, sesiones: sesiones.length, umbral, filas };
  }

  // ---------- Administración de sensores ----------
  async listarSensores() {
    const limite = num(this.config.get('SENSOR_SIN_SENAL_MIN'), 10);
    const rows = await this.sensores.find({ relations: { aula: { sede: true } }, order: { codigo: 'ASC' } });
    const pendientes = await this.lecturas.createQueryBuilder('l').select('l.sensorId', 'sensorId').addSelect('COUNT(*)', 'n')
      .where('l.estado = :e', { e: EstadoLectura.PENDIENTE }).groupBy('l.sensorId').getRawMany<{ sensorId: number; n: string }>();
    const p = new Map(pendientes.map((x) => [Number(x.sensorId), Number(x.n)]));
    return rows.map((s) => ({ ...s, conectado: !!s.ultimaSenal && Date.now() - s.ultimaSenal.getTime() <= limite * 60000, lecturasEnCola: p.get(s.id) ?? 0 }));
  }

  /** El token se muestra una sola vez; en la base solo queda su hash. */
  async crearSensor(dto: SensorDto, actor: UsuarioActual) {
    existe(await this.aulas.findOneBy({ id: dto.aulaId }), 'El aula no existe');
    if (await this.sensores.findOneBy({ codigo: dto.codigo })) throw new ConflictException('Ya existe un sensor con ese código');
    const token = randomBytes(24).toString('hex');
    const s = await this.sensores.save(this.sensores.create({ ...dto, tokenHash: await bcrypt.hash(token, 10) }));
    await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'CREAR', entidad: 'sensor', entidadId: s.id, despues: dto });
    return { id: s.id, codigo: s.codigo, aulaId: s.aulaId, token };
  }

  async editarSensor(id: number, dto: SensorUpdateDto, actor: UsuarioActual) {
    const s = existe(await this.sensores.findOneBy({ id }), 'Sensor no encontrado');
    if (dto.aulaId) existe(await this.aulas.findOneBy({ id: dto.aulaId }), 'El aula no existe');
    await this.sensores.update(id, dto);
    await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'EDITAR', entidad: 'sensor', entidadId: id, antes: s, despues: dto });
    return this.sensores.findOne({ where: { id }, relations: { aula: true } });
  }

  async regenerarToken(id: number, actor: UsuarioActual) {
    const s = existe(await this.sensores.findOneBy({ id }), 'Sensor no encontrado');
    const token = randomBytes(24).toString('hex');
    await this.sensores.update(id, { tokenHash: await bcrypt.hash(token, 10) });
    await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'REGENERAR_TOKEN', entidad: 'sensor', entidadId: id });
    return { id, codigo: s.codigo, token };
  }

  lecturasSensor(id: number) {
    return this.lecturas.find({ where: { sensorId: id }, order: { leidoEn: 'DESC' }, take: 200 });
  }
}

