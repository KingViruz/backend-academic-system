import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditoriaService } from '../../common/auditoria.service';
import { existe, regla } from '../../common/utils';
import { Aula, CargaAcademica, Facultad, Materia, Periodo, Programa, Sede } from '../../database/entities';
import { AulaDto, FacultadDto, MateriaDto, PeriodoDto, ProgramaDto, SedeDto } from './estructura.dto';

@Injectable()
export class EstructuraService {
  constructor(
    @InjectRepository(Facultad) private facultades: Repository<Facultad>,
    @InjectRepository(Programa) private programas: Repository<Programa>,
    @InjectRepository(Materia) private materias: Repository<Materia>,
    @InjectRepository(Sede) private sedes: Repository<Sede>,
    @InjectRepository(Aula) private aulas: Repository<Aula>,
    @InjectRepository(Periodo) private periodos: Repository<Periodo>,
    @InjectRepository(CargaAcademica) private cargas: Repository<CargaAcademica>,
    private ds: DataSource,
    private auditoria: AuditoriaService,
  ) {}

  private async unico<T extends object>(repo: Repository<T>, campo: keyof T, valor: unknown, id: number | undefined, msg: string) {
    if (valor === undefined) return;
    const otro = await repo.findOne({ where: { [campo]: valor } as never });
    if (otro && (otro as { id: number }).id !== id) throw new ConflictException(msg);
  }

  // ---------- Facultades ----------
  /** El número de programas se calcula, no se guarda (HU-09). */
  async listarFacultades() {
    const rows = await this.facultades.createQueryBuilder('f')
      .loadRelationCountAndMap('f.numeroProgramas', 'f.programas', 'p', (qb) => qb.where('p.activo = true'))
      .orderBy('f.nombre').getMany();
    return rows;
  }

  async crearFacultad(dto: FacultadDto, usuarioId: number) {
    await this.unico(this.facultades, 'codigo', dto.codigo, undefined, 'Ya existe una facultad con ese código');
    const f = await this.facultades.save(this.facultades.create(dto));
    await this.auditoria.registrar({ usuarioId, accion: 'CREAR', entidad: 'facultad', entidadId: f.id, despues: f });
    return f;
  }

  async editarFacultad(id: number, dto: Partial<FacultadDto>, usuarioId: number) {
    const f = existe(await this.facultades.findOneBy({ id }), 'Facultad no encontrada');
    await this.unico(this.facultades, 'codigo', dto.codigo, id, 'Ya existe una facultad con ese código');
    if (dto.activo === false && f.activo) {
      const activos = await this.programas.count({ where: { facultadId: id, activo: true } });
      regla(activos === 0, `No se puede inactivar: la facultad tiene ${activos} programa(s) activo(s)`);
    }
    const nuevo = await this.facultades.save({ ...f, ...dto });
    await this.auditoria.registrar({ usuarioId, accion: 'EDITAR', entidad: 'facultad', entidadId: id, antes: f, despues: nuevo });
    return nuevo;
  }

  // ---------- Programas ----------
  listarProgramas(facultadId?: number) {
    return this.programas.find({ where: facultadId ? { facultadId } : {}, relations: { facultad: true }, order: { nombre: 'ASC' } });
  }

  async crearPrograma(dto: ProgramaDto, usuarioId: number) {
    await this.unico(this.programas, 'codigo', dto.codigo, undefined, 'Ya existe un programa con ese código');
    const fac = existe(await this.facultades.findOneBy({ id: dto.facultadId }), 'La facultad no existe');
    regla(fac.activo, 'La facultad está inactiva');
    const p = await this.programas.save(this.programas.create(dto));
    await this.auditoria.registrar({ usuarioId, accion: 'CREAR', entidad: 'programa', entidadId: p.id, despues: p });
    return p;
  }

  async editarPrograma(id: number, dto: Partial<ProgramaDto>, usuarioId: number) {
    const p = existe(await this.programas.findOneBy({ id }), 'Programa no encontrado');
    await this.unico(this.programas, 'codigo', dto.codigo, id, 'Ya existe un programa con ese código');
    if (dto.facultadId) existe(await this.facultades.findOneBy({ id: dto.facultadId }), 'La facultad no existe');
    const nuevo = await this.programas.save({ ...p, ...dto });
    await this.auditoria.registrar({ usuarioId, accion: 'EDITAR', entidad: 'programa', entidadId: id, antes: p, despues: nuevo });
    return nuevo;
  }

  // ---------- Materias ----------
  listarMaterias(soloActivas = false) {
    return this.materias.find({ where: soloActivas ? { activo: true } : {}, order: { nombre: 'ASC' } });
  }

  async crearMateria(dto: MateriaDto, usuarioId: number) {
    await this.unico(this.materias, 'codigo', dto.codigo, undefined, 'Ya existe una materia con ese código');
    const m = await this.materias.save(this.materias.create(dto));
    await this.auditoria.registrar({ usuarioId, accion: 'CREAR', entidad: 'materia', entidadId: m.id, despues: m });
    return m;
  }

  async editarMateria(id: number, dto: Partial<MateriaDto>, usuarioId: number) {
    const m = existe(await this.materias.findOneBy({ id }), 'Materia no encontrada');
    await this.unico(this.materias, 'codigo', dto.codigo, id, 'Ya existe una materia con ese código');
    const nuevo = await this.materias.save({ ...m, ...dto });
    await this.auditoria.registrar({ usuarioId, accion: 'EDITAR', entidad: 'materia', entidadId: id, antes: m, despues: nuevo });
    return nuevo;
  }

  /** Una materia usada en una carga académica no se elimina: se inactiva. */
  async eliminarMateria(id: number, usuarioId: number) {
    const m = existe(await this.materias.findOneBy({ id }), 'Materia no encontrada');
    const usos = await this.cargas.count({ where: { materiaId: id } });
    if (usos > 0) {
      await this.materias.update(id, { activo: false });
      await this.auditoria.registrar({ usuarioId, accion: 'INACTIVAR', entidad: 'materia', entidadId: id, antes: m });
      return { eliminada: false, inactivada: true, mensaje: 'La materia tiene carga académica asociada; se inactivó en lugar de eliminarse' };
    }
    try {
      await this.materias.delete(id);
    } catch {
      await this.materias.update(id, { activo: false });
      return { eliminada: false, inactivada: true, mensaje: 'La materia está en uso; se inactivó en lugar de eliminarse' };
    }
    await this.auditoria.registrar({ usuarioId, accion: 'ELIMINAR', entidad: 'materia', entidadId: id, antes: m });
    return { eliminada: true };
  }

  // ---------- Sedes y aulas ----------
  listarSedes() {
    return this.sedes.find({ order: { nombre: 'ASC' } });
  }

  async crearSede(dto: SedeDto, usuarioId: number) {
    await this.unico(this.sedes, 'nombre', dto.nombre, undefined, 'Ya existe una sede con ese nombre');
    const s = await this.sedes.save(this.sedes.create(dto));
    await this.auditoria.registrar({ usuarioId, accion: 'CREAR', entidad: 'sede', entidadId: s.id, despues: s });
    return s;
  }

  async editarSede(id: number, dto: Partial<SedeDto>, usuarioId: number) {
    const s = existe(await this.sedes.findOneBy({ id }), 'Sede no encontrada');
    const nuevo = await this.sedes.save({ ...s, ...dto });
    await this.auditoria.registrar({ usuarioId, accion: 'EDITAR', entidad: 'sede', entidadId: id, antes: s, despues: nuevo });
    return nuevo;
  }

  listarAulas(sedeId?: number) {
    return this.aulas.find({ where: sedeId ? { sedeId } : {}, relations: { sede: true }, order: { sedeId: 'ASC', codigo: 'ASC' } });
  }

  async crearAula(dto: AulaDto, usuarioId: number) {
    existe(await this.sedes.findOneBy({ id: dto.sedeId }), 'La sede no existe');
    const dup = await this.aulas.findOneBy({ sedeId: dto.sedeId, codigo: dto.codigo });
    if (dup) throw new ConflictException('Ya existe un aula con ese código en la sede');
    const a = await this.aulas.save(this.aulas.create(dto));
    await this.auditoria.registrar({ usuarioId, accion: 'CREAR', entidad: 'aula', entidadId: a.id, despues: a });
    return a;
  }

  async editarAula(id: number, dto: Partial<AulaDto>, usuarioId: number) {
    const a = existe(await this.aulas.findOneBy({ id }), 'Aula no encontrada');
    if (dto.codigo || dto.sedeId) {
      const dup = await this.aulas.findOneBy({ sedeId: dto.sedeId ?? a.sedeId, codigo: dto.codigo ?? a.codigo });
      if (dup && dup.id !== id) throw new ConflictException('Ya existe un aula con ese código en la sede');
    }
    const nuevo = await this.aulas.save({ ...a, ...dto });
    await this.auditoria.registrar({ usuarioId, accion: 'EDITAR', entidad: 'aula', entidadId: id, antes: a, despues: nuevo });
    return nuevo;
  }

  // ---------- Periodos ----------
  listarPeriodos() {
    return this.periodos.find({ order: { codigo: 'DESC' } });
  }

  async periodoActual() {
    return existe(await this.periodos.findOneBy({ actual: true }), 'No hay un periodo académico marcado como actual');
  }

  async guardarPeriodo(id: number | null, dto: Partial<PeriodoDto>, usuarioId: number) {
    const antes = id ? existe(await this.periodos.findOneBy({ id }), 'Periodo no encontrado') : null;
    await this.unico(this.periodos, 'codigo', dto.codigo, id ?? undefined, 'Ya existe ese periodo');
    const ini = dto.fechaInicio ?? antes?.fechaInicio;
    const fin = dto.fechaFin ?? antes?.fechaFin;
    regla(!!ini && !!fin && fin > ini, 'La fecha de fin debe ser posterior a la de inicio');
    return this.ds.transaction(async (em) => {
      if (dto.actual) await em.update(Periodo, { actual: true }, { actual: false });
      const p = await em.save(Periodo, { ...(antes ?? {}), ...dto });
      await this.auditoria.registrar({ usuarioId, accion: id ? 'EDITAR' : 'CREAR', entidad: 'periodo', entidadId: p.id, antes, despues: p }, em);
      return p;
    });
  }
}
