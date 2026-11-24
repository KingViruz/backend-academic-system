import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, Repository } from 'typeorm';
import { AuditoriaService } from '../../common/auditoria.service';
import { UsuarioActual } from '../../common/auth.types';
import { Rol } from '../../common/enums';
import { DIAS, existe, hhmm, minutos, ordenarFranjas, regla, seCruzan } from '../../common/utils';
import { Aula, CargaAcademica, Docente, HorarioClase, Inscripcion, Materia, Periodo, Programa } from '../../database/entities';
import { CargaDto, CargaUpdateDto, HorarioDto } from './academico.dto';

export interface Cruce { tipo: 'DOCENTE' | 'AULA' | 'INTERNO'; mensaje: string; cargaId?: number }

@Injectable()
export class CargaService {
  constructor(
    private ds: DataSource,
    @InjectRepository(CargaAcademica) private cargas: Repository<CargaAcademica>,
    @InjectRepository(HorarioClase) private horarios: Repository<HorarioClase>,
    @InjectRepository(Inscripcion) private inscripciones: Repository<Inscripcion>,
    @InjectRepository(Docente) private docentes: Repository<Docente>,
    @InjectRepository(Aula) private aulas: Repository<Aula>,
    @InjectRepository(Materia) private materias: Repository<Materia>,
    @InjectRepository(Programa) private programas: Repository<Programa>,
    @InjectRepository(Periodo) private periodos: Repository<Periodo>,
    private auditoria: AuditoriaService,
  ) {}

  /** El coordinador solo programa y consulta su propio programa. */
  private programaDe(actor: UsuarioActual, solicitado?: number): number | undefined {
    if (actor.rol === Rol.COORDINADOR) {
      if (solicitado && solicitado !== actor.programaId) throw new ForbiddenException('Solo puedes gestionar la carga de tu programa');
      return actor.programaId;
    }
    return solicitado;
  }

  private relaciones = { materia: true, docente: { usuario: true }, programa: true, periodo: true, horarios: { aula: { sede: true } } };

  async listar(actor: UsuarioActual, f: { periodoId?: number; programaId?: number }) {
    const programaId = this.programaDe(actor, f.programaId);
    const periodoId = f.periodoId ?? (await this.periodos.findOneBy({ actual: true }))?.id;
    const rows = await this.cargas.find({ where: { ...(programaId ? { programaId } : {}), ...(periodoId ? { periodoId } : {}) }, relations: this.relaciones, order: { materia: { nombre: 'ASC' }, grupo: 'ASC' } });
    return this.conInscritos(rows);
  }

  private async conInscritos(rows: CargaAcademica[]) {
    if (!rows.length) return [];
    const conteo = await this.inscripciones.createQueryBuilder('i').select('i.cargaId', 'cargaId').addSelect('COUNT(*)', 'n')
      .where('i.cargaId IN (:...ids)', { ids: rows.map((r) => r.id) }).groupBy('i.cargaId').getRawMany<{ cargaId: number; n: string }>();
    const m = new Map(conteo.map((c) => [Number(c.cargaId), Number(c.n)]));
    return rows.map((r) => ({ ...r, horarios: ordenarFranjas(r.horarios), docente: { ...r.docente, usuario: { nombres: r.docente.usuario.nombres, apellidos: r.docente.usuario.apellidos, email: r.docente.usuario.email } }, inscritos: m.get(r.id) ?? 0 }));
  }

  async obtener(id: number, actor: UsuarioActual) {
    const c = existe(await this.cargas.findOne({ where: { id }, relations: this.relaciones }), 'Grupo no encontrado');
    if (actor.rol === Rol.COORDINADOR && c.programaId !== actor.programaId) throw new ForbiddenException('El grupo no pertenece a tu programa');
    if (actor.rol === Rol.DOCENTE && c.docenteId !== actor.docenteId) throw new ForbiddenException('No eres el docente de este grupo');
    return (await this.conInscritos([c]))[0];
  }

  /** CP-04: valida que ni el docente ni el aula estén ocupados en esa franja dentro del mismo periodo. */
  async detectarCruces(periodoId: number, docenteId: number, horarios: HorarioDto[], excluirCargaId?: number): Promise<Cruce[]> {
    const cruces: Cruce[] = [];
    horarios.forEach((h, i) => {
      if (minutos(h.horaFin) <= minutos(h.horaInicio)) cruces.push({ tipo: 'INTERNO', mensaje: `${DIAS[h.dia]} ${h.horaInicio}: la hora de fin debe ser posterior a la de inicio` });
      horarios.slice(i + 1).forEach((o) => {
        if (o.dia === h.dia && seCruzan(h.horaInicio, h.horaFin, o.horaInicio, o.horaFin))
          cruces.push({ tipo: 'INTERNO', mensaje: `Las franjas del ${DIAS[h.dia]} se cruzan entre sí` });
      });
    });
    const dias = [...new Set(horarios.map((h) => h.dia))];
    const aulas = [...new Set(horarios.map((h) => h.aulaId))];
    const qb = this.horarios.createQueryBuilder('h')
      .innerJoinAndSelect('h.carga', 'c').innerJoinAndSelect('c.materia', 'm').innerJoinAndSelect('h.aula', 'a')
      .innerJoinAndSelect('c.docente', 'd').innerJoinAndSelect('d.usuario', 'u')
      .where('c.periodoId = :periodoId', { periodoId }).andWhere('h.dia IN (:...dias)', { dias })
      .andWhere('(c.docenteId = :docenteId OR h.aulaId IN (:...aulas))', { docenteId, aulas });
    if (excluirCargaId) qb.andWhere('c.id <> :ex', { ex: excluirCargaId });
    const existentes = await qb.getMany();
    for (const h of horarios) {
      for (const o of existentes) {
        if (o.dia !== h.dia || !seCruzan(h.horaInicio, h.horaFin, o.horaInicio, o.horaFin)) continue;
        const desc = `${o.carga.materia.nombre} grupo ${o.carga.grupo} (${DIAS[o.dia]} ${hhmm(o.horaInicio)}–${hhmm(o.horaFin)}, aula ${o.aula.codigo})`;
        if (o.carga.docenteId === docenteId)
          cruces.push({ tipo: 'DOCENTE', cargaId: o.cargaId, mensaje: `El docente ${o.carga.docente.usuario.nombres} ${o.carga.docente.usuario.apellidos} ya tiene clase: ${desc}` });
        if (o.aulaId === h.aulaId)
          cruces.push({ tipo: 'AULA', cargaId: o.cargaId, mensaje: `El aula ${o.aula.codigo} ya está ocupada: ${desc}` });
      }
    }
    return cruces;
  }

  private async validarBasico(periodoId: number, programaId: number, materiaId: number, docenteId: number, horarios: HorarioDto[] | undefined, cupo: number) {
    const periodo = existe(await this.periodos.findOneBy({ id: periodoId }), 'El periodo no existe');
    const prog = existe(await this.programas.findOneBy({ id: programaId }), 'El programa no existe');
    regla(prog.activo, 'El programa está inactivo');
    const mat = existe(await this.materias.findOneBy({ id: materiaId }), 'La materia no existe');
    regla(mat.activo, 'La materia está inactiva');
    const doc = existe(await this.docentes.findOne({ where: { id: docenteId }, relations: { materias: true, usuario: true } }), 'El docente no existe');
    regla(doc.usuario.activo, 'El docente está inactivo');
    regla(doc.materias.some((m) => m.id === materiaId), `${doc.usuario.nombres} ${doc.usuario.apellidos} no está habilitado para dictar ${mat.nombre}`);
    if (horarios?.length) {
      const aulas = await this.aulas.findBy({ id: In([...new Set(horarios.map((h) => h.aulaId))]) });
      regla(aulas.length === new Set(horarios.map((h) => h.aulaId)).size, 'Alguna de las aulas no existe');
      const pequena = aulas.find((a) => a.capacidad < cupo);
      regla(!pequena, `El cupo (${cupo}) supera la capacidad del aula ${pequena?.codigo} (${pequena?.capacidad})`);
    }
    return periodo;
  }

  async validar(dto: CargaDto & { excluirCargaId?: number }, actor: UsuarioActual) {
    void actor;
    return { cruces: await this.detectarCruces(dto.periodoId, dto.docenteId, dto.horarios, dto.excluirCargaId) };
  }

  async crear(dto: CargaDto, actor: UsuarioActual) {
    const programaId = this.programaDe(actor, dto.programaId);
    regla(!!programaId, 'Indica el programa');
    await this.validarBasico(dto.periodoId, programaId!, dto.materiaId, dto.docenteId, dto.horarios, dto.cupo);
    const dup = await this.cargas.findOneBy({ periodoId: dto.periodoId, programaId, materiaId: dto.materiaId, grupo: dto.grupo });
    if (dup) throw new ConflictException(`Ya existe el grupo ${dto.grupo} de esa materia en el periodo`);
    const cruces = await this.detectarCruces(dto.periodoId, dto.docenteId, dto.horarios);
    if (cruces.length) throw new ConflictException({ message: cruces[0].mensaje, cruces });
    // Todo o nada: si falla un horario no queda la carga a medias.
    return this.ds.transaction(async (em) => {
      const c = await em.save(CargaAcademica, em.create(CargaAcademica, {
        periodoId: dto.periodoId, programaId, materiaId: dto.materiaId, docenteId: dto.docenteId, grupo: dto.grupo, cupo: dto.cupo,
        horarios: dto.horarios.map((h) => em.create(HorarioClase, h)),
      }));
      await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'CREAR', entidad: 'carga_academica', entidadId: c.id, despues: dto }, em);
      return c;
    });
  }

  async editar(id: number, dto: CargaUpdateDto, actor: UsuarioActual) {
    const c = existe(await this.cargas.findOne({ where: { id }, relations: { horarios: true } }), 'Grupo no encontrado');
    this.programaDe(actor, c.programaId);
    const docenteId = dto.docenteId ?? c.docenteId;
    const cupo = dto.cupo ?? c.cupo;
    const horarios: HorarioDto[] = dto.horarios ?? c.horarios.map((h) => ({ aulaId: h.aulaId, dia: h.dia, horaInicio: hhmm(h.horaInicio), horaFin: hhmm(h.horaFin) }));
    await this.validarBasico(c.periodoId, c.programaId, c.materiaId, docenteId, horarios, cupo);
    const inscritos = await this.inscripciones.countBy({ cargaId: id });
    regla(cupo >= inscritos, `El grupo ya tiene ${inscritos} inscritos; el cupo no puede ser menor`);
    if (dto.grupo && dto.grupo !== c.grupo) {
      const dup = await this.cargas.findOneBy({ periodoId: c.periodoId, programaId: c.programaId, materiaId: c.materiaId, grupo: dto.grupo, id: Not(id) });
      if (dup) throw new ConflictException(`Ya existe el grupo ${dto.grupo}`);
    }
    const cruces = await this.detectarCruces(c.periodoId, docenteId, horarios, id);
    if (cruces.length) throw new ConflictException({ message: cruces[0].mensaje, cruces });
    return this.ds.transaction(async (em) => {
      await em.update(CargaAcademica, id, { docenteId, cupo, grupo: dto.grupo ?? c.grupo });
      if (dto.horarios) {
        await em.delete(HorarioClase, { cargaId: id });
        await em.save(HorarioClase, dto.horarios.map((h) => em.create(HorarioClase, { ...h, cargaId: id })));
      }
      await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'EDITAR', entidad: 'carga_academica', entidadId: id, antes: c, despues: dto }, em);
      return em.findOne(CargaAcademica, { where: { id }, relations: this.relaciones });
    });
  }

  async eliminar(id: number, actor: UsuarioActual) {
    const c = existe(await this.cargas.findOneBy({ id }), 'Grupo no encontrado');
    this.programaDe(actor, c.programaId);
    const inscritos = await this.inscripciones.countBy({ cargaId: id });
    regla(inscritos === 0, `No se puede eliminar: el grupo tiene ${inscritos} estudiante(s) inscrito(s)`);
    try {
      await this.cargas.delete(id);
    } catch {
      regla(false, 'No se puede eliminar: el grupo ya tiene asistencias o planes registrados');
    }
    await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'ELIMINAR', entidad: 'carga_academica', entidadId: id, antes: c });
    return { ok: true };
  }

  async misGrupos(actor: UsuarioActual, periodoId?: number) {
    const pid = periodoId ?? (await this.periodos.findOneBy({ actual: true }))?.id;
    const rows = await this.cargas.find({ where: { docenteId: actor.docenteId, ...(pid ? { periodoId: pid } : {}) }, relations: this.relaciones, order: { materia: { nombre: 'ASC' } } });
    return this.conInscritos(rows);
  }
}
