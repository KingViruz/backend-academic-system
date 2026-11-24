import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AuditoriaService } from '../../common/auditoria.service';
import { UsuarioActual } from '../../common/auth.types';
import { EstadoMicrocurriculo, Rol } from '../../common/enums';
import { existe, hoyISO, regla } from '../../common/utils';
import { Calificacion, CargaAcademica, DetallePlanMicrocurriculo, Inscripcion, Materia, Microcurriculo, PlanMicrocurriculo, UnidadTematica } from '../../database/entities';
import { DetallePlanDto, EjecutarDto, MicrocurriculoDto, PlanDto, UnidadDto } from './microcurriculo.dto';

type Semaforo = 'VERDE' | 'AMARILLO' | 'ROJO' | 'SIN_INICIAR';

@Injectable()
export class MicrocurriculoService {
  constructor(
    private ds: DataSource,
    @InjectRepository(Microcurriculo) private micros: Repository<Microcurriculo>,
    @InjectRepository(UnidadTematica) private unidades: Repository<UnidadTematica>,
    @InjectRepository(PlanMicrocurriculo) private planes: Repository<PlanMicrocurriculo>,
    @InjectRepository(DetallePlanMicrocurriculo) private detalles: Repository<DetallePlanMicrocurriculo>,
    @InjectRepository(CargaAcademica) private cargas: Repository<CargaAcademica>,
    @InjectRepository(Materia) private materias: Repository<Materia>,
    @InjectRepository(Inscripcion) private inscripciones: Repository<Inscripcion>,
    @InjectRepository(Calificacion) private notas: Repository<Calificacion>,
    private auditoria: AuditoriaService,
  ) {}

  private programaDe(actor: UsuarioActual, solicitado?: number) {
    if (actor.rol === Rol.COORDINADOR) {
      if (solicitado && solicitado !== actor.programaId) throw new ForbiddenException('Solo puedes gestionar los microcurrículos de tu programa');
      return actor.programaId!;
    }
    return solicitado;
  }

  private async propio(id: number, actor: UsuarioActual) {
    const m = existe(await this.micros.findOne({ where: { id }, relations: { materia: true, programa: true, unidades: true, prerrequisitos: true } }), 'Microcurrículo no encontrado');
    if (actor.rol === Rol.COORDINADOR && m.programaId !== actor.programaId) throw new ForbiddenException('El microcurrículo no pertenece a tu programa');
    m.unidades?.sort((a, b) => a.numero - b.numero);
    return m;
  }

  // ---------- Microcurrículo ----------
  listar(actor: UsuarioActual, programaId?: number) {
    const p = this.programaDe(actor, programaId);
    return this.micros.find({ where: p ? { programaId: p } : {}, relations: { materia: true, programa: true }, order: { materia: { nombre: 'ASC' } } });
  }

  obtener(id: number, actor: UsuarioActual) {
    return this.propio(id, actor);
  }

  /** Para estudiante/docente: microcurrículo publicado de la materia de un grupo. */
  async deCarga(cargaId: number) {
    const c = existe(await this.cargas.findOneBy({ id: cargaId }), 'Grupo no encontrado');
    const m = await this.micros.findOne({ where: { materiaId: c.materiaId, programaId: c.programaId }, relations: { materia: true, unidades: true, prerrequisitos: true } });
    m?.unidades?.sort((a, b) => a.numero - b.numero);
    return m;
  }

  async crear(dto: MicrocurriculoDto, actor: UsuarioActual) {
    const programaId = this.programaDe(actor, dto.programaId);
    regla(!!programaId, 'Indica el programa');
    existe(await this.materias.findOneBy({ id: dto.materiaId }), 'La materia no existe');
    if (await this.micros.findOneBy({ materiaId: dto.materiaId, programaId })) throw new ConflictException('La materia ya tiene microcurrículo en este programa');
    const m = await this.micros.save(this.micros.create({ ...dto, programaId }));
    await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'CREAR', entidad: 'microcurriculo', entidadId: m.id, despues: m });
    return m;
  }

  /** Publicado, los porcentajes no cambian si ya hay notas registradas en la materia (R06). */
  async editar(id: number, dto: Partial<MicrocurriculoDto>, actor: UsuarioActual) {
    const m = await this.propio(id, actor);
    const cambiaPct = ['porcentajeP1', 'porcentajeP2', 'porcentajeP3'].some((k) => dto[k as keyof MicrocurriculoDto] !== undefined && dto[k as keyof MicrocurriculoDto] !== m[k as keyof Microcurriculo]);
    if (cambiaPct && m.estado === EstadoMicrocurriculo.PUBLICADO) {
      const conNotas = await this.notas.createQueryBuilder('n').innerJoin('n.inscripcion', 'i').innerJoin('i.carga', 'c')
        .where('c.materiaId = :mid AND c.programaId = :pid', { mid: m.materiaId, pid: m.programaId }).getCount();
      regla(conNotas === 0, 'No se pueden cambiar los porcentajes: ya hay notas registradas con ellos');
    }
    const { materiaId, programaId, ...resto } = dto;
    void materiaId; void programaId;
    const nuevo = { ...m, ...resto };
    if (m.estado === EstadoMicrocurriculo.PUBLICADO) this.validarPublicable(nuevo, m.unidades);
    await this.micros.update(id, resto);
    await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'EDITAR', entidad: 'microcurriculo', entidadId: id, antes: m, despues: resto });
    return this.propio(id, actor);
  }

  private validarPublicable(m: Partial<Microcurriculo>, unidades: UnidadTematica[]) {
    const faltan: string[] = [];
    if (!m.descripcion?.trim()) faltan.push('descripción');
    if (!m.objetivoGeneral?.trim()) faltan.push('objetivo general');
    if (!m.competenciasGenericas?.trim()) faltan.push('competencias genéricas');
    regla(faltan.length === 0, `Para publicar completa: ${faltan.join(', ')}`);
    const suma = (m.porcentajeP1 ?? 0) + (m.porcentajeP2 ?? 0) + (m.porcentajeP3 ?? 0);
    regla(suma === 100, `Los porcentajes de los parciales suman ${suma} %; deben sumar 100 %`);
    regla(unidades.length > 0, 'Agrega al menos una unidad temática con su competencia y resultado de aprendizaje');
  }

  async publicar(id: number, actor: UsuarioActual) {
    const m = await this.propio(id, actor);
    this.validarPublicable(m, m.unidades);
    await this.micros.update(id, { estado: EstadoMicrocurriculo.PUBLICADO, publicadoEn: new Date() });
    await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'PUBLICAR', entidad: 'microcurriculo', entidadId: id });
    return this.propio(id, actor);
  }

  async agregarUnidad(id: number, dto: UnidadDto, actor: UsuarioActual) {
    const m = await this.propio(id, actor);
    regla(!m.unidades.some((u) => u.numero === dto.numero), `Ya existe la unidad ${dto.numero}`);
    const u = await this.unidades.save(this.unidades.create({ ...dto, microcurriculoId: id }));
    await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'CREAR', entidad: 'unidad_tematica', entidadId: u.id, despues: u });
    return u;
  }

  async editarUnidad(unidadId: number, dto: Partial<UnidadDto>, actor: UsuarioActual) {
    const u = existe(await this.unidades.findOneBy({ id: unidadId }), 'Unidad no encontrada');
    await this.propio(u.microcurriculoId, actor);
    await this.unidades.update(unidadId, dto);
    await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'EDITAR', entidad: 'unidad_tematica', entidadId: unidadId, antes: u, despues: dto });
    return this.unidades.findOneBy({ id: unidadId });
  }

  async eliminarUnidad(unidadId: number, actor: UsuarioActual) {
    const u = existe(await this.unidades.findOneBy({ id: unidadId }), 'Unidad no encontrada');
    const m = await this.propio(u.microcurriculoId, actor);
    regla(!(m.estado === EstadoMicrocurriculo.PUBLICADO && m.unidades.length === 1), 'Un microcurrículo publicado necesita al menos una unidad');
    const usada = await this.detalles.countBy({ unidadId });
    regla(usada === 0, 'La unidad ya está en un plan de periodo; no se puede eliminar');
    await this.unidades.delete(unidadId);
    await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'ELIMINAR', entidad: 'unidad_tematica', entidadId: unidadId, antes: u });
    return { ok: true };
  }

  /** HU-24: sin auto-referencia ni ciclos (A requiere B y B requiere A). */
  async definirPrerrequisitos(id: number, materiaIds: number[], actor: UsuarioActual) {
    const m = await this.propio(id, actor);
    regla(!materiaIds.includes(m.materiaId), 'Una materia no puede ser prerrequisito de sí misma');
    const mats = materiaIds.length ? await this.materias.findBy({ id: In(materiaIds) }) : [];
    regla(mats.length === materiaIds.length, 'Alguna materia no existe');
    // Grafo de prerrequisitos del programa para detectar ciclos.
    const todos = await this.micros.find({ where: { programaId: m.programaId }, relations: { prerrequisitos: true } });
    const grafo = new Map<number, number[]>(todos.map((x) => [x.materiaId, x.prerrequisitos.map((p) => p.id)]));
    grafo.set(m.materiaId, materiaIds);
    const visitando = new Set<number>();
    const listo = new Set<number>();
    const ciclo = (n: number): boolean => {
      if (visitando.has(n)) return true;
      if (listo.has(n)) return false;
      visitando.add(n);
      for (const v of grafo.get(n) ?? []) if (ciclo(v)) return true;
      visitando.delete(n); listo.add(n);
      return false;
    };
    regla(!ciclo(m.materiaId), 'Esos prerrequisitos forman un ciclo con otra materia del programa');
    const antes = m.prerrequisitos.map((p) => p.id);
    m.prerrequisitos = mats;
    await this.micros.save(m);
    await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'PRERREQUISITOS', entidad: 'microcurriculo', entidadId: id, antes, despues: materiaIds });
    return this.propio(id, actor);
  }

  // ---------- Plan del periodo ----------
  private async planPropio(id: number, actor: UsuarioActual) {
    const p = existe(await this.planes.findOne({
      where: { id },
      relations: { microcurriculo: { materia: true, unidades: true }, carga: { materia: true, docente: { usuario: true }, periodo: true }, detalles: { unidad: true } },
    }), 'Plan no encontrado');
    if (actor.rol === Rol.COORDINADOR && p.carga.programaId !== actor.programaId) throw new ForbiddenException('El plan no pertenece a tu programa');
    if (actor.rol === Rol.DOCENTE && p.carga.docenteId !== actor.docenteId) throw new ForbiddenException('No eres el docente de este grupo');
    if (actor.rol === Rol.ESTUDIANTE) {
      const ins = await this.inscripciones.findOneBy({ estudianteId: actor.estudianteId, cargaId: p.cargaId });
      if (!ins) throw new ForbiddenException('Solo puedes ver los planes de tus materias');
    }
    p.detalles.sort((a, b) => a.semana - b.semana || a.id - b.id);
    return p;
  }

  static avance(detalles: DetallePlanMicrocurriculo[], hoy = hoyISO()) {
    const total = detalles.reduce((s, d) => s + d.horas, 0);
    const ejecutadas = detalles.filter((d) => d.ejecutado).reduce((s, d) => s + d.horas, 0);
    const previstas = detalles.filter((d) => d.fechaPlaneada <= hoy).reduce((s, d) => s + d.horas, 0);
    const ejecutadasPrevistas = detalles.filter((d) => d.fechaPlaneada <= hoy && d.ejecutado).reduce((s, d) => s + d.horas, 0);
    const pctFecha = previstas === 0 ? 100 : Math.round((ejecutadasPrevistas / previstas) * 100);
    // HU-28: verde >= 90 %, amarillo 70-89 %, rojo < 70 % de lo planeado a la fecha.
    const semaforo: Semaforo = previstas === 0 ? 'SIN_INICIAR' : pctFecha >= 90 ? 'VERDE' : pctFecha >= 70 ? 'AMARILLO' : 'ROJO';
    const atrasados = detalles.filter((d) => d.fechaPlaneada < hoy && !d.ejecutado).map((d) => ({ id: d.id, semana: d.semana, tema: d.tema, fechaPlaneada: d.fechaPlaneada }));
    return { horasTotales: total, horasEjecutadas: ejecutadas, horasPrevistasALaFecha: previstas, porcentajeTotal: total ? Math.round((ejecutadas / total) * 100) : 0, porcentajeALaFecha: pctFecha, semaforo, atrasados };
  }

  async obtenerPlan(id: number, actor: UsuarioActual) {
    const p = await this.planPropio(id, actor);
    const horasDetalle = p.detalles.reduce((s, d) => s + d.horas, 0);
    return { ...p, avance: MicrocurriculoService.avance(p.detalles), horasDetalle, horasCuadran: horasDetalle === p.totalHoras };
  }

  async planDeCarga(cargaId: number, actor: UsuarioActual) {
    const p = await this.planes.findOneBy({ cargaId });
    return p ? this.obtenerPlan(p.id, actor) : null;
  }

  async crearPlan(dto: PlanDto, actor: UsuarioActual) {
    const c = existe(await this.cargas.findOne({ where: { id: dto.cargaId }, relations: { periodo: true } }), 'Grupo no encontrado');
    this.programaDe(actor, c.programaId);
    const m = await this.micros.findOneBy({ materiaId: c.materiaId, programaId: c.programaId });
    regla(!!m && m.estado === EstadoMicrocurriculo.PUBLICADO, 'Solo se puede crear el plan desde un microcurrículo publicado');
    regla(dto.fechaFin > dto.fechaInicio, 'La fecha de terminación debe ser posterior a la de inicio');
    regla(dto.fechaInicio >= c.periodo.fechaInicio && dto.fechaFin <= c.periodo.fechaFin, `Las fechas deben estar dentro del periodo (${c.periodo.fechaInicio} a ${c.periodo.fechaFin})`);
    if (await this.planes.findOneBy({ cargaId: c.id })) throw new ConflictException('El grupo ya tiene plan de microcurrículo');
    const p = await this.planes.save(this.planes.create({ ...dto, microcurriculoId: m!.id }));
    await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'CREAR', entidad: 'plan_microcurriculo', entidadId: p.id, despues: p });
    return p;
  }

  async agregarDetalle(planId: number, dto: DetallePlanDto, actor: UsuarioActual) {
    const p = await this.planPropio(planId, actor);
    regla(p.microcurriculo.unidades.some((u) => u.id === dto.unidadId), 'La unidad no pertenece a este microcurrículo');
    regla(dto.fechaPlaneada >= p.fechaInicio && dto.fechaPlaneada <= p.fechaFin, 'La fecha planeada debe estar dentro del plan');
    const suma = p.detalles.reduce((s, d) => s + d.horas, 0) + dto.horas;
    regla(suma <= p.totalHoras, `Con esta sesión el detalle suma ${suma} h y el plan tiene ${p.totalHoras} h`);
    const d = await this.detalles.save(this.detalles.create({ ...dto, planId }));
    await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'CREAR', entidad: 'detalle_plan', entidadId: d.id, despues: d });
    return d;
  }

  async editarDetalle(id: number, dto: Partial<DetallePlanDto>, actor: UsuarioActual) {
    const d = existe(await this.detalles.findOneBy({ id }), 'Sesión del plan no encontrada');
    const p = await this.planPropio(d.planId, actor);
    if (dto.unidadId) regla(p.microcurriculo.unidades.some((u) => u.id === dto.unidadId), 'La unidad no pertenece a este microcurrículo');
    if (dto.horas !== undefined) {
      const suma = p.detalles.reduce((s, x) => s + (x.id === id ? dto.horas! : x.horas), 0);
      regla(suma <= p.totalHoras, `El detalle sumaría ${suma} h y el plan tiene ${p.totalHoras} h`);
    }
    await this.detalles.update(id, dto);
    await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'EDITAR', entidad: 'detalle_plan', entidadId: id, antes: d, despues: dto });
    return this.detalles.findOneBy({ id });
  }

  async eliminarDetalle(id: number, actor: UsuarioActual) {
    const d = existe(await this.detalles.findOneBy({ id }), 'Sesión del plan no encontrada');
    await this.planPropio(d.planId, actor);
    regla(!d.ejecutado, 'No se puede eliminar una sesión ya ejecutada');
    await this.detalles.delete(id);
    await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'ELIMINAR', entidad: 'detalle_plan', entidadId: id, antes: d });
    return { ok: true };
  }

  /** HU-27: solo el docente asignado marca avances; se guarda la fecha real de ejecución. */
  async ejecutar(id: number, dto: EjecutarDto, actor: UsuarioActual) {
    const d = existe(await this.detalles.findOne({ where: { id }, relations: { plan: { carga: true } } }), 'Sesión del plan no encontrada');
    if (d.plan.carga.docenteId !== actor.docenteId) throw new ForbiddenException('Solo el docente del grupo puede reportar avances');
    const cambios = {
      ejecutado: dto.ejecutado,
      fechaEjecucion: dto.ejecutado ? (dto.fechaEjecucion ?? hoyISO()) : null,
      observaciones: dto.observaciones ?? d.observaciones,
    };
    await this.detalles.update(id, cambios);
    await this.auditoria.registrar({ usuarioId: actor.sub, accion: dto.ejecutado ? 'EJECUTAR_TEMA' : 'DESMARCAR_TEMA', entidad: 'detalle_plan', entidadId: id, antes: { ejecutado: d.ejecutado }, despues: cambios });
    return this.detalles.findOneBy({ id });
  }

  /** Seguimiento del coordinador: todos los planes del periodo con su semáforo. */
  async seguimiento(actor: UsuarioActual, periodoId?: number) {
    const qb = this.planes.createQueryBuilder('p')
      .innerJoinAndSelect('p.carga', 'c').innerJoinAndSelect('c.materia', 'm').innerJoinAndSelect('c.periodo', 'pe')
      .innerJoinAndSelect('c.docente', 'd').innerJoinAndSelect('d.usuario', 'u').leftJoinAndSelect('p.detalles', 'det');
    if (actor.rol === Rol.COORDINADOR) qb.andWhere('c.programaId = :pid', { pid: actor.programaId });
    if (actor.rol === Rol.DOCENTE) qb.andWhere('c.docenteId = :did', { did: actor.docenteId });
    if (periodoId) qb.andWhere('c.periodoId = :periodoId', { periodoId }); else qb.andWhere('pe.actual = true');
    const rows = await qb.getMany();
    return rows.map((p) => ({
      id: p.id, cargaId: p.cargaId, materia: p.carga.materia.nombre, grupo: p.carga.grupo,
      docente: `${p.carga.docente.usuario.nombres} ${p.carga.docente.usuario.apellidos}`,
      fechaInicio: p.fechaInicio, fechaFin: p.fechaFin, totalHoras: p.totalHoras, avance: MicrocurriculoService.avance(p.detalles),
    }));
  }
}
