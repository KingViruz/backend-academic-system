import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { parse } from 'csv-parse/sync';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AuditoriaService } from '../../common/auditoria.service';
import { UsuarioActual } from '../../common/auth.types';
import { Rol } from '../../common/enums';
import { edad, existe, regla, sinSecretos } from '../../common/utils';
import { Coordinador, Docente, Estudiante, Materia, Programa, Usuario } from '../../database/entities';
import { CoordinadorDto, DocenteDto, EstudianteDto, UsuarioBaseDto, UsuarioUpdateDto } from './personas.dto';

export const PLANTILLA_COLUMNAS = [
  'tipo_identificacion', 'identificacion', 'nombres', 'apellidos', 'email', 'celular', 'codigo_carne', 'programa_codigo',
  'semestre', 'fecha_nacimiento', 'fecha_expedicion', 'direccion', 'acudiente_nombre', 'acudiente_telefono', 'puntaje_icfes', 'sisben',
];

const DATOS_USUARIO = ['tipoIdentificacion', 'identificacion', 'nombres', 'apellidos', 'email', 'celular'] as const;

@Injectable()
export class PersonasService {
  constructor(
    private ds: DataSource,
    @InjectRepository(Usuario) private usuarios: Repository<Usuario>,
    @InjectRepository(Coordinador) private coordinadores: Repository<Coordinador>,
    @InjectRepository(Docente) private docentes: Repository<Docente>,
    @InjectRepository(Estudiante) private estudiantes: Repository<Estudiante>,
    @InjectRepository(Programa) private programas: Repository<Programa>,
    @InjectRepository(Materia) private materias: Repository<Materia>,
    private auditoria: AuditoriaService,
  ) {}

  // ---------- Usuario base ----------
  private async validarUnicos(em: EntityManager, d: Partial<UsuarioBaseDto>, id?: number) {
    if (d.identificacion) {
      const x = await em.findOneBy(Usuario, { identificacion: d.identificacion });
      if (x && x.id !== id) throw new ConflictException(`Ya existe un usuario con la identificación ${d.identificacion}`);
    }
    if (d.email) {
      const x = await em.findOneBy(Usuario, { email: d.email.toLowerCase() });
      if (x && x.id !== id) throw new ConflictException(`Ya existe un usuario con el correo ${d.email}`);
    }
  }

  /** Si no se envía contraseña, la inicial es el número de identificación. */
  private async crearUsuario(em: EntityManager, d: UsuarioBaseDto, rol: Rol) {
    await this.validarUnicos(em, d);
    const u = em.create(Usuario, {
      tipoIdentificacion: d.tipoIdentificacion, identificacion: d.identificacion, nombres: d.nombres.trim(), apellidos: d.apellidos.trim(),
      email: d.email.trim().toLowerCase(), celular: d.celular ?? null, rol,
      passwordHash: await bcrypt.hash(d.password || d.identificacion, 10),
    });
    return em.save(u);
  }

  private async editarUsuario(em: EntityManager, id: number, d: Partial<UsuarioBaseDto>) {
    await this.validarUnicos(em, d, id);
    const cambios: Partial<Usuario> = {};
    for (const k of DATOS_USUARIO) if (d[k] !== undefined) (cambios as Record<string, unknown>)[k] = k === 'email' ? d.email!.toLowerCase() : d[k];
    if (Object.keys(cambios).length) await em.update(Usuario, id, cambios);
  }

  listarUsuarios(rol?: Rol, q?: string) {
    const qb = this.usuarios.createQueryBuilder('u').orderBy('u.apellidos');
    if (rol) qb.andWhere('u.rol = :rol', { rol });
    if (q) qb.andWhere('(u.nombres LIKE :q OR u.apellidos LIKE :q OR u.identificacion LIKE :q OR u.email LIKE :q)', { q: `%${q}%` });
    return qb.take(500).getMany();
  }

  async crearAdmin(d: UsuarioBaseDto, actor: UsuarioActual) {
    return this.ds.transaction(async (em) => {
      const u = await this.crearUsuario(em, d, Rol.ADMIN);
      await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'CREAR', entidad: 'usuario', entidadId: u.id, despues: sinSecretos(u) }, em);
      return sinSecretos(u);
    });
  }

  /** Editar datos, activar/inactivar o cambiar el rol (HU-02). El cambio aplica en el siguiente inicio de sesión. */
  async actualizarUsuario(id: number, d: UsuarioUpdateDto, actor: UsuarioActual) {
    const antes = existe(await this.usuarios.findOneBy({ id }), 'Usuario no encontrado');
    if (d.rol && d.rol !== antes.rol) {
      regla(id !== actor.sub, 'No puedes cambiar tu propio rol');
      const perfiles = await Promise.all([
        this.docentes.countBy({ usuarioId: id }), this.estudiantes.countBy({ usuarioId: id }), this.coordinadores.countBy({ usuarioId: id }),
      ]);
      const necesita: Record<Rol, number> = { [Rol.DOCENTE]: perfiles[0], [Rol.ESTUDIANTE]: perfiles[1], [Rol.COORDINADOR]: perfiles[2], [Rol.ADMIN]: 1 };
      regla(necesita[d.rol] > 0, `Para asignar el rol ${d.rol} primero registra a la persona en el módulo correspondiente`);
    }
    if (d.activo === false) regla(id !== actor.sub, 'No puedes inactivar tu propia cuenta');
    await this.ds.transaction(async (em) => {
      await this.editarUsuario(em, id, d);
      const extra: Partial<Usuario> = {};
      if (d.activo !== undefined) extra.activo = d.activo;
      if (d.rol) extra.rol = d.rol;
      if (Object.keys(extra).length) await em.update(Usuario, id, extra);
      const despues = await em.findOneByOrFail(Usuario, { id });
      await this.auditoria.registrar({ usuarioId: actor.sub, accion: d.rol && d.rol !== antes.rol ? 'CAMBIO_ROL' : 'EDITAR', entidad: 'usuario', entidadId: id, antes, despues }, em);
    });
    return this.usuarios.findOneBy({ id });
  }

  async desbloquear(id: number, actor: UsuarioActual) {
    existe(await this.usuarios.findOneBy({ id }), 'Usuario no encontrado');
    await this.usuarios.update(id, { intentosFallidos: 0, bloqueadoHasta: null });
    await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'DESBLOQUEAR', entidad: 'usuario', entidadId: id });
    return { ok: true };
  }

  async restablecerPassword(id: number, actor: UsuarioActual) {
    const u = existe(await this.usuarios.findOneBy({ id }), 'Usuario no encontrado');
    await this.usuarios.update(id, { passwordHash: await bcrypt.hash(u.identificacion, 10), intentosFallidos: 0, bloqueadoHasta: null });
    await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'RESTABLECER_PASSWORD', entidad: 'usuario', entidadId: id });
    return { ok: true, mensaje: 'La contraseña quedó igual al número de identificación' };
  }

  // ---------- Coordinadores ----------
  listarCoordinadores() {
    return this.coordinadores.find({ relations: { usuario: true, programa: true }, order: { id: 'ASC' } });
  }

  async crearCoordinador(d: CoordinadorDto, actor: UsuarioActual) {
    const prog = existe(await this.programas.findOneBy({ id: d.programaId }), 'El programa no existe');
    regla(prog.activo, 'El programa está inactivo');
    const ocupado = await this.coordinadores.findOne({ where: { programaId: d.programaId }, relations: { usuario: true } });
    if (ocupado) throw new ConflictException(`El programa ya tiene como coordinador a ${ocupado.usuario.nombres} ${ocupado.usuario.apellidos}`);
    return this.ds.transaction(async (em) => {
      const u = await this.crearUsuario(em, d, Rol.COORDINADOR);
      const c = await em.save(Coordinador, { usuarioId: u.id, programaId: d.programaId });
      await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'CREAR', entidad: 'coordinador', entidadId: c.id, despues: { ...c, usuario: sinSecretos(u) } }, em);
      return em.findOne(Coordinador, { where: { id: c.id }, relations: { usuario: true, programa: true } });
    });
  }

  async editarCoordinador(id: number, d: Partial<CoordinadorDto>, actor: UsuarioActual) {
    const c = existe(await this.coordinadores.findOneBy({ id }), 'Coordinador no encontrado');
    if (d.programaId && d.programaId !== c.programaId) {
      const ocupado = await this.coordinadores.findOneBy({ programaId: d.programaId });
      if (ocupado) throw new ConflictException('Ese programa ya tiene coordinador');
    }
    return this.ds.transaction(async (em) => {
      await this.editarUsuario(em, c.usuarioId, d);
      if (d.programaId) await em.update(Coordinador, id, { programaId: d.programaId });
      const despues = await em.findOne(Coordinador, { where: { id }, relations: { usuario: true, programa: true } });
      await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'EDITAR', entidad: 'coordinador', entidadId: id, antes: c, despues }, em);
      return despues;
    });
  }

  // ---------- Docentes ----------
  listarDocentes(materiaId?: number) {
    const qb = this.docentes.createQueryBuilder('d').innerJoinAndSelect('d.usuario', 'u').leftJoinAndSelect('d.materias', 'm').orderBy('u.apellidos');
    if (materiaId) qb.innerJoin('d.materias', 'mf', 'mf.id = :materiaId', { materiaId });
    return qb.getMany();
  }

  async crearDocente(d: DocenteDto, actor: UsuarioActual) {
    return this.ds.transaction(async (em) => {
      const u = await this.crearUsuario(em, d, Rol.DOCENTE);
      const doc = await em.save(Docente, { usuarioId: u.id, profesion: d.profesion ?? null, fechaNacimiento: d.fechaNacimiento ?? null, direccion: d.direccion ?? null });
      await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'CREAR', entidad: 'docente', entidadId: doc.id, despues: { ...doc, usuario: sinSecretos(u) } }, em);
      return em.findOne(Docente, { where: { id: doc.id }, relations: { usuario: true, materias: true } });
    });
  }

  async editarDocente(id: number, d: Partial<DocenteDto>, actor: UsuarioActual) {
    const doc = existe(await this.docentes.findOne({ where: { id }, relations: { usuario: true } }), 'Docente no encontrado');
    return this.ds.transaction(async (em) => {
      await this.editarUsuario(em, doc.usuarioId, d);
      const cambios: Partial<Docente> = {};
      if (d.profesion !== undefined) cambios.profesion = d.profesion;
      if (d.fechaNacimiento !== undefined) cambios.fechaNacimiento = d.fechaNacimiento;
      if (d.direccion !== undefined) cambios.direccion = d.direccion;
      if (Object.keys(cambios).length) await em.update(Docente, id, cambios);
      const despues = await em.findOne(Docente, { where: { id }, relations: { usuario: true, materias: true } });
      await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'EDITAR', entidad: 'docente', entidadId: id, antes: doc, despues }, em);
      return despues;
    });
  }

  /** HU-14: materias que el docente está habilitado para dictar. No se asocian materias inactivas. */
  async asignarMaterias(id: number, materiaIds: number[], actor: UsuarioActual) {
    const doc = existe(await this.docentes.findOne({ where: { id }, relations: { materias: true } }), 'Docente no encontrado');
    const mats = materiaIds.length ? await this.materias.findBy({ id: In(materiaIds) }) : [];
    regla(mats.length === materiaIds.length, 'Alguna de las materias no existe');
    const inactivas = mats.filter((m) => !m.activo && !doc.materias.some((x) => x.id === m.id));
    regla(inactivas.length === 0, `No se pueden asociar materias inactivas: ${inactivas.map((m) => m.nombre).join(', ')}`);
    const antes = doc.materias.map((m) => m.id);
    doc.materias = mats;
    await this.docentes.save(doc);
    await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'ASIGNAR_MATERIAS', entidad: 'docente', entidadId: id, antes, despues: materiaIds });
    return this.docentes.findOne({ where: { id }, relations: { usuario: true, materias: true } });
  }

  // ---------- Estudiantes ----------
  /** Mínimo privilegio (CP-09): el docente solo ve datos básicos; el coordinador solo su programa. */
  async listarEstudiantes(actor: UsuarioActual, filtros: { programaId?: number; q?: string }) {
    const qb = this.estudiantes.createQueryBuilder('e').innerJoinAndSelect('e.usuario', 'u').innerJoinAndSelect('e.programa', 'p').orderBy('u.apellidos');
    let programaId = filtros.programaId;
    if (actor.rol === Rol.COORDINADOR) programaId = actor.programaId;
    if (programaId) qb.andWhere('e.programaId = :programaId', { programaId });
    if (filtros.q) qb.andWhere('(u.nombres LIKE :q OR u.apellidos LIKE :q OR u.identificacion LIKE :q OR e.codigoCarne LIKE :q)', { q: `%${filtros.q}%` });
    const rows = await qb.take(1000).getMany();
    return actor.rol === Rol.ADMIN || actor.rol === Rol.COORDINADOR ? rows : rows.map((e) => this.basico(e));
  }

  basico(e: Estudiante) {
    return {
      id: e.id, codigoCarne: e.codigoCarne, programaId: e.programaId, semestre: e.semestre,
      usuario: { id: e.usuario.id, nombres: e.usuario.nombres, apellidos: e.usuario.apellidos, identificacion: e.usuario.identificacion, email: e.usuario.email },
    };
  }

  async obtenerEstudiante(id: number, actor: UsuarioActual) {
    const e = existe(await this.estudiantes.findOne({ where: { id }, relations: { usuario: true, programa: true } }), 'Estudiante no encontrado');
    if (actor.rol === Rol.COORDINADOR && e.programaId !== actor.programaId) throw new ForbiddenException('El estudiante no pertenece a tu programa');
    if (actor.rol === Rol.ESTUDIANTE && e.id !== actor.estudianteId) throw new ForbiddenException('Solo puedes ver tu propia información');
    if (actor.rol === Rol.DOCENTE) return this.basico(e);
    return e;
  }

  private async validarEstudiante(em: EntityManager, d: Partial<EstudianteDto>, actual?: Estudiante) {
    const nac = d.fechaNacimiento ?? actual?.fechaNacimiento;
    const exp = d.fechaExpedicion ?? actual?.fechaExpedicion;
    if (nac && exp) regla(exp > nac, 'La fecha de expedición del documento debe ser posterior a la de nacimiento');
    if (nac && edad(nac) < 18) {
      const nombre = d.acudienteNombre ?? actual?.acudienteNombre;
      const tel = d.acudienteTelefono ?? actual?.acudienteTelefono;
      regla(!!nombre && !!tel, 'El estudiante es menor de edad: el nombre y teléfono del acudiente son obligatorios');
    }
    if (d.programaId) {
      const p = existe(await em.findOneBy(Programa, { id: d.programaId }), 'El programa no existe');
      regla(p.activo, 'El programa está inactivo');
    }
    if (d.codigoCarne) {
      const x = await em.findOneBy(Estudiante, { codigoCarne: d.codigoCarne });
      if (x && x.id !== actual?.id) throw new ConflictException(`El carné ${d.codigoCarne} ya está asignado`);
    }
  }

  private datosEstudiante(d: Partial<EstudianteDto>): Partial<Estudiante> {
    const keys = ['codigoCarne', 'programaId', 'semestre', 'fechaNacimiento', 'fechaExpedicion', 'direccion', 'acudienteNombre', 'acudienteTelefono', 'puntajeIcfes', 'sisben'] as const;
    const out: Record<string, unknown> = {};
    for (const k of keys) if (d[k] !== undefined) out[k] = d[k];
    return out as Partial<Estudiante>;
  }

  async crearEstudiante(d: EstudianteDto, actor: UsuarioActual, em?: EntityManager) {
    const run = async (tx: EntityManager) => {
      await this.validarEstudiante(tx, d);
      const u = await this.crearUsuario(tx, d, Rol.ESTUDIANTE);
      const e = await tx.save(Estudiante, { ...this.datosEstudiante(d), usuarioId: u.id } as Estudiante);
      await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'CREAR', entidad: 'estudiante', entidadId: e.id, despues: { ...e, usuario: sinSecretos(u) } }, tx);
      return e;
    };
    const e = em ? await run(em) : await this.ds.transaction(run);
    return em ? e : this.estudiantes.findOne({ where: { id: e.id }, relations: { usuario: true, programa: true } });
  }

  async editarEstudiante(id: number, d: Partial<EstudianteDto>, actor: UsuarioActual) {
    const e = existe(await this.estudiantes.findOne({ where: { id }, relations: { usuario: true } }), 'Estudiante no encontrado');
    return this.ds.transaction(async (em) => {
      await this.validarEstudiante(em, d, e);
      await this.editarUsuario(em, e.usuarioId, d);
      const cambios = this.datosEstudiante(d);
      if (Object.keys(cambios).length) await em.update(Estudiante, id, cambios);
      const despues = await em.findOne(Estudiante, { where: { id }, relations: { usuario: true, programa: true } });
      await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'EDITAR', entidad: 'estudiante', entidadId: id, antes: e, despues }, em);
      return despues;
    });
  }

  plantillaCsv() {
    const ejemplo = ['CC', '1001234567', 'Ana María', 'Pérez Gómez', 'ana.perez@cul.edu.co', '3001234567', 'EST-0001', 'ING-SIS', '1', '2005-03-14', '2023-03-20', 'Calle 10 # 20-30', '', '', '320', 'B2'];
    return PLANTILLA_COLUMNAS.join(',') + '\n' + ejemplo.join(',') + '\n';
  }

  /**
   * HU-13 / CP-12: cada fila se procesa en su propia transacción. Las filas con error se reportan
   * sin detener las válidas y no dejan registros a medias. Un estudiante ya existente no se duplica.
   */
  async cargaMasiva(contenido: string, actor: UsuarioActual) {
    let filas: Record<string, string>[];
    try {
      filas = parse(contenido.replace(/^﻿/, ''), { columns: true, skip_empty_lines: true, trim: true, delimiter: [',', ';'] });
    } catch (e) {
      throw new BadRequestException(`No se pudo leer el archivo: ${(e as Error).message}`);
    }
    regla(filas.length > 0, 'El archivo no tiene filas');
    const faltan = PLANTILLA_COLUMNAS.filter((c) => !(c in filas[0]));
    regla(faltan.length === 0, `Faltan columnas en el archivo: ${faltan.join(', ')}. Descarga la plantilla`);
    regla(filas.length <= 2000, 'El archivo supera el máximo de 2000 filas');

    const programas = new Map((await this.programas.find()).map((p) => [p.codigo.toUpperCase(), p]));
    const creados: { fila: number; id: number; nombre: string }[] = [];
    const errores: { fila: number; motivo: string }[] = [];
    const existentes: { fila: number; identificacion: string }[] = [];

    for (let i = 0; i < filas.length; i++) {
      const f = filas[i];
      const n = i + 2; // fila 1 = encabezado
      const prog = programas.get((f.programa_codigo || '').toUpperCase());
      if (!prog) { errores.push({ fila: n, motivo: `El programa "${f.programa_codigo}" no existe` }); continue; }
      const dto = plainToInstance(EstudianteDto, {
        tipoIdentificacion: f.tipo_identificacion || 'CC', identificacion: f.identificacion, nombres: f.nombres, apellidos: f.apellidos,
        email: f.email, celular: f.celular || undefined, codigoCarne: f.codigo_carne, programaId: prog.id,
        semestre: f.semestre ? Number(f.semestre) : 1, fechaNacimiento: f.fecha_nacimiento, fechaExpedicion: f.fecha_expedicion,
        direccion: f.direccion || undefined, acudienteNombre: f.acudiente_nombre || undefined, acudienteTelefono: f.acudiente_telefono || undefined,
        puntajeIcfes: f.puntaje_icfes ? Number(f.puntaje_icfes) : undefined, sisben: f.sisben || undefined,
      });
      const errs = await validate(dto);
      if (errs.length) { errores.push({ fila: n, motivo: Object.values(errs[0].constraints ?? {})[0] ?? 'Datos inválidos' }); continue; }
      const ya = await this.usuarios.findOneBy({ identificacion: dto.identificacion });
      if (ya) { existentes.push({ fila: n, identificacion: dto.identificacion }); continue; }
      try {
        const e = await this.ds.transaction((em) => this.crearEstudiante(dto, actor, em));
        creados.push({ fila: n, id: (e as Estudiante).id, nombre: `${dto.nombres} ${dto.apellidos}` });
      } catch (e) {
        errores.push({ fila: n, motivo: (e as Error).message });
      }
    }
    await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'CARGA_MASIVA', entidad: 'estudiante', despues: { total: filas.length, creados: creados.length, errores: errores.length, existentes: existentes.length } });
    return { total: filas.length, creados, existentes, errores };
  }
}
