import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AuditoriaService } from '../../common/auditoria.service';
import { UsuarioActual } from '../../common/auth.types';
import { EstadoMicrocurriculo, EstadoSolicitud, Rol, TipoAlerta } from '../../common/enums';
import { existe, num, regla } from '../../common/utils';
import { Calificacion, CargaAcademica, Inscripcion, Microcurriculo, SolicitudCambioNota } from '../../database/entities';
import { AlertasService } from '../alertas/alertas.service';
import { InscripcionesService } from '../academico/inscripciones.service';
import { NotaDto } from './notas.dto';

@Injectable()
export class NotasService {
  constructor(
    private ds: DataSource,
    private config: ConfigService,
    @InjectRepository(Calificacion) private notas: Repository<Calificacion>,
    @InjectRepository(Inscripcion) private inscripciones: Repository<Inscripcion>,
    @InjectRepository(CargaAcademica) private cargas: Repository<CargaAcademica>,
    @InjectRepository(Microcurriculo) private micros: Repository<Microcurriculo>,
    @InjectRepository(SolicitudCambioNota) private solicitudes: Repository<SolicitudCambioNota>,
    private auditoria: AuditoriaService,
    private alertas: AlertasService,
  ) {}

  private async carga(cargaId: number, actor: UsuarioActual) {
    const c = existe(await this.cargas.findOne({ where: { id: cargaId }, relations: { materia: true, periodo: true, docente: { usuario: true } } }), 'Grupo no encontrado');
    // CP-03: la autorización se valida en el servidor; un docente no toca grupos ajenos aunque llame la API directo.
    if (actor.rol === Rol.DOCENTE && c.docenteId !== actor.docenteId) throw new ForbiddenException('No eres el docente de este grupo');
    if (actor.rol === Rol.COORDINADOR && c.programaId !== actor.programaId) throw new ForbiddenException('El grupo no pertenece a tu programa');
    return c;
  }

  private async porcentajes(c: CargaAcademica): Promise<[number, number, number] | null> {
    const m = await this.micros.findOneBy({ materiaId: c.materiaId, programaId: c.programaId });
    return m && m.estado === EstadoMicrocurriculo.PUBLICADO ? [m.porcentajeP1, m.porcentajeP2, m.porcentajeP3] : null;
  }

  async grupo(cargaId: number, actor: UsuarioActual) {
    const c = await this.carga(cargaId, actor);
    const pct = await this.porcentajes(c);
    const ins = await this.inscripciones.find({ where: { cargaId }, relations: { estudiante: { usuario: true } } });
    const ns = ins.length ? await this.notas.findBy({ inscripcionId: In(ins.map((i) => i.id)) }) : [];
    const pendientes = ns.length ? await this.solicitudes.findBy({ calificacionId: In(ns.map((n) => n.id)), estado: EstadoSolicitud.PENDIENTE }) : [];
    const filas = ins.map((i) => {
      const mis = ns.filter((n) => n.inscripcionId === i.id);
      const porCorte = Object.fromEntries(mis.map((n) => [n.corte, n.nota])) as Record<number, number>;
      return {
        inscripcionId: i.id, estudianteId: i.estudianteId, codigoCarne: i.estudiante.codigoCarne,
        nombre: `${i.estudiante.usuario.apellidos} ${i.estudiante.usuario.nombres}`,
        notas: [1, 2, 3].map((corte) => {
          const n = mis.find((x) => x.corte === corte);
          return { corte, calificacionId: n?.id ?? null, nota: n?.nota ?? null, solicitudPendiente: n ? pendientes.some((p) => p.calificacionId === n.id) : false };
        }),
        definitiva: pct ? InscripcionesService.definitiva(porCorte, pct) : null,
      };
    }).sort((a, b) => a.nombre.localeCompare(b.nombre));
    return {
      grupo: { id: c.id, materia: c.materia.nombre, codigo: c.materia.codigo, grupo: c.grupo, periodo: c.periodo.codigo, docente: `${c.docente.usuario.nombres} ${c.docente.usuario.apellidos}` },
      porcentajes: pct, ultimoCorteCerrado: c.ultimoCorteCerrado, filas,
    };
  }

  /** HU-35: notas 0.0–5.0; los porcentajes vienen del microcurrículo; un corte cerrado ya no se edita. */
  async registrar(cargaId: number, corte: number, notas: NotaDto[], actor: UsuarioActual) {
    const c = await this.carga(cargaId, actor);
    regla(actor.rol === Rol.DOCENTE, 'Solo el docente del grupo registra notas');
    regla(!!(await this.porcentajes(c)), 'La materia no tiene microcurrículo publicado: sin él no hay porcentajes para calcular la nota');
    regla(corte > c.ultimoCorteCerrado, `El corte ${corte} ya está cerrado. Para cambiar una nota crea una solicitud de cambio`);
    regla(corte === c.ultimoCorteCerrado + 1 || corte <= 3, 'Corte inválido');
    const ins = await this.inscripciones.findBy({ cargaId });
    const validos = new Set(ins.map((i) => i.id));
    const ajenas = notas.filter((n) => !validos.has(n.inscripcionId));
    regla(ajenas.length === 0, 'Algunas inscripciones no pertenecen a este grupo');
    return this.ds.transaction(async (em) => {
      let cambios = 0;
      for (const n of notas) {
        const previa = await em.findOneBy(Calificacion, { inscripcionId: n.inscripcionId, corte });
        if (previa && previa.nota === n.nota) continue;
        if (previa) await em.update(Calificacion, previa.id, { nota: n.nota, registradaPorId: actor.sub });
        else await em.insert(Calificacion, { inscripcionId: n.inscripcionId, corte, nota: n.nota, registradaPorId: actor.sub });
        await this.auditoria.registrar({ usuarioId: actor.sub, accion: previa ? 'EDITAR_NOTA' : 'REGISTRAR_NOTA', entidad: 'calificacion', entidadId: previa?.id ?? null, antes: previa ? { nota: previa.nota } : null, despues: { inscripcionId: n.inscripcionId, corte, nota: n.nota } }, em);
        cambios++;
      }
      return { guardadas: cambios };
    });
  }

  /** Cierra el corte en orden (1, 2, 3); exige nota para todos y genera alertas de nota baja. */
  async cerrarCorte(cargaId: number, corte: number, actor: UsuarioActual) {
    const c = await this.carga(cargaId, actor);
    regla(actor.rol === Rol.DOCENTE, 'Solo el docente del grupo cierra cortes');
    regla(corte === c.ultimoCorteCerrado + 1, c.ultimoCorteCerrado >= corte ? `El corte ${corte} ya está cerrado` : `Primero cierra el corte ${c.ultimoCorteCerrado + 1}`);
    const ins = await this.inscripciones.find({ where: { cargaId }, relations: { estudiante: { usuario: true } } });
    const ns = ins.length ? await this.notas.findBy({ inscripcionId: In(ins.map((i) => i.id)), corte }) : [];
    const sinNota = ins.filter((i) => !ns.some((n) => n.inscripcionId === i.id));
    regla(sinNota.length === 0, `Faltan notas del corte ${corte} para: ${sinNota.slice(0, 5).map((i) => `${i.estudiante.usuario.nombres} ${i.estudiante.usuario.apellidos}`).join(', ')}${sinNota.length > 5 ? '…' : ''}`);
    await this.cargas.update(cargaId, { ultimoCorteCerrado: corte });
    await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'CERRAR_CORTE', entidad: 'carga_academica', entidadId: cargaId, despues: { corte } });
    const minima = num(this.config.get('ALERTA_NOTA_MINIMA'), 3);
    for (const n of ns.filter((x) => x.nota < minima)) {
      const i = ins.find((x) => x.id === n.inscripcionId)!;
      await this.alertas.crear({
        tipo: TipoAlerta.NOTA_BAJA, programaId: c.programaId, estudianteId: i.estudianteId, cargaId,
        clave: `NOTA-${cargaId}-${i.estudianteId}-${corte}`,
        mensaje: `${i.estudiante.usuario.nombres} ${i.estudiante.usuario.apellidos} obtuvo ${n.nota.toFixed(1)} en el corte ${corte} de ${c.materia.nombre} grupo ${c.grupo}.`,
      });
    }
    return this.grupo(cargaId, actor);
  }

  /** HU-36: notas por corte con su porcentaje y la definitiva calculada. */
  async mias(actor: UsuarioActual) {
    const ins = await this.inscripciones.find({ where: { estudianteId: actor.estudianteId, carga: { periodo: { actual: true } } }, relations: { carga: { materia: true, docente: { usuario: true } } } });
    const out = [];
    for (const i of ins) {
      const pct = await this.porcentajes(i.carga);
      const ns = await this.notas.findBy({ inscripcionId: i.id });
      const porCorte = Object.fromEntries(ns.map((n) => [n.corte, n.nota])) as Record<number, number>;
      const parcial = pct ? ns.reduce((s, n) => s + (n.nota * pct[n.corte - 1]) / 100, 0) : null;
      out.push({
        cargaId: i.cargaId, materia: i.carga.materia.nombre, codigo: i.carga.materia.codigo, creditos: i.carga.materia.creditos, grupo: i.carga.grupo,
        docente: `${i.carga.docente.usuario.nombres} ${i.carga.docente.usuario.apellidos}`,
        porcentajes: pct, ultimoCorteCerrado: i.carga.ultimoCorteCerrado,
        notas: [1, 2, 3].map((corte) => ({ corte, nota: porCorte[corte] ?? null, porcentaje: pct?.[corte - 1] ?? null })),
        acumulado: parcial === null ? null : Math.round(parcial * 100) / 100,
        definitiva: pct ? InscripcionesService.definitiva(porCorte, pct) : null,
      });
    }
    return out;
  }

  // ---------- Solicitudes de cambio (HU-42 / CP-06) ----------
  async solicitar(calificacionId: number, notaNueva: number, motivo: string, actor: UsuarioActual) {
    const cal = existe(await this.notas.findOne({ where: { id: calificacionId }, relations: { inscripcion: { carga: true } } }), 'Calificación no encontrada');
    const c = cal.inscripcion.carga;
    if (c.docenteId !== actor.docenteId) throw new ForbiddenException('Solo el docente del grupo puede solicitar cambios');
    regla(cal.corte <= c.ultimoCorteCerrado, 'El corte sigue abierto: puedes editar la nota directamente');
    regla(cal.nota !== notaNueva, 'La nota nueva es igual a la actual');
    const pendiente = await this.solicitudes.findOneBy({ calificacionId, estado: EstadoSolicitud.PENDIENTE });
    if (pendiente) throw new ConflictException('Ya hay una solicitud pendiente para esta nota');
    const s = await this.solicitudes.save(this.solicitudes.create({ calificacionId, notaAnterior: cal.nota, notaNueva, motivo, solicitanteId: actor.sub }));
    await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'SOLICITAR_CAMBIO_NOTA', entidad: 'solicitud_cambio_nota', entidadId: s.id, despues: s });
    return s;
  }

  async listarSolicitudes(actor: UsuarioActual, estado?: EstadoSolicitud) {
    const qb = this.solicitudes.createQueryBuilder('s')
      .innerJoinAndSelect('s.calificacion', 'cal').innerJoinAndSelect('cal.inscripcion', 'i').innerJoinAndSelect('i.carga', 'c')
      .innerJoinAndSelect('c.materia', 'm').innerJoinAndSelect('i.estudiante', 'e').innerJoinAndSelect('e.usuario', 'eu')
      .innerJoinAndSelect('s.solicitante', 'sol').leftJoinAndSelect('s.aprobador', 'apr').orderBy('s.createdAt', 'DESC');
    if (actor.rol === Rol.COORDINADOR) qb.andWhere('c.programaId = :p', { p: actor.programaId });
    if (actor.rol === Rol.DOCENTE) qb.andWhere('s.solicitanteId = :u', { u: actor.sub });
    if (estado) qb.andWhere('s.estado = :estado', { estado });
    const rows = await qb.getMany();
    return rows.map((s) => ({
      id: s.id, estado: s.estado, notaAnterior: s.notaAnterior, notaNueva: s.notaNueva, motivo: s.motivo, comentario: s.comentario,
      createdAt: s.createdAt, resueltaEn: s.resueltaEn, corte: s.calificacion.corte,
      materia: s.calificacion.inscripcion.carga.materia.nombre, grupo: s.calificacion.inscripcion.carga.grupo,
      estudiante: `${s.calificacion.inscripcion.estudiante.usuario.nombres} ${s.calificacion.inscripcion.estudiante.usuario.apellidos}`,
      solicitante: `${s.solicitante.nombres} ${s.solicitante.apellidos}`,
      aprobador: s.aprobador ? `${s.aprobador.nombres} ${s.aprobador.apellidos}` : null,
    }));
  }

  /** El coordinador del programa aprueba o rechaza; nadie aprueba su propia solicitud. */
  async resolver(id: number, aprobar: boolean, comentario: string | undefined, actor: UsuarioActual) {
    const s = existe(await this.solicitudes.findOne({ where: { id }, relations: { calificacion: { inscripcion: { carga: { materia: true }, estudiante: true } } } }), 'Solicitud no encontrada');
    const c = s.calificacion.inscripcion.carga;
    if (actor.rol === Rol.COORDINADOR && c.programaId !== actor.programaId) throw new ForbiddenException('La solicitud no es de tu programa');
    regla(s.solicitanteId !== actor.sub, 'No puedes aprobar tu propia solicitud');
    regla(s.estado === EstadoSolicitud.PENDIENTE, 'La solicitud ya fue resuelta');
    return this.ds.transaction(async (em) => {
      const estado = aprobar ? EstadoSolicitud.APROBADA : EstadoSolicitud.RECHAZADA;
      await em.update(SolicitudCambioNota, id, { estado, aprobadorId: actor.sub, comentario: comentario ?? null, resueltaEn: new Date() });
      if (aprobar) {
        await em.update(Calificacion, s.calificacionId, { nota: s.notaNueva, registradaPorId: s.solicitanteId });
        await this.auditoria.registrar({
          usuarioId: actor.sub, accion: 'CAMBIO_NOTA_APROBADO', entidad: 'calificacion', entidadId: s.calificacionId,
          antes: { nota: s.notaAnterior }, despues: { nota: s.notaNueva, solicitudId: id, solicitanteId: s.solicitanteId, motivo: s.motivo },
        }, em);
        // A07: todo cambio posterior al cierre queda como alerta de seguridad para revisión.
        await this.alertas.crear({
          tipo: TipoAlerta.SEGURIDAD, programaId: c.programaId, estudianteId: s.calificacion.inscripcion.estudianteId, cargaId: c.id,
          clave: `CAMBIO-NOTA-${id}`,
          mensaje: `Se aprobó el cambio de nota de ${s.notaAnterior.toFixed(1)} a ${s.notaNueva.toFixed(1)} en el corte ${s.calificacion.corte} de ${c.materia.nombre} grupo ${c.grupo}.`,
        }, em);
      } else {
        await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'CAMBIO_NOTA_RECHAZADO', entidad: 'solicitud_cambio_nota', entidadId: id }, em);
      }
      return em.findOneBy(SolicitudCambioNota, { id });
    });
  }
}
