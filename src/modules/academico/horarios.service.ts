import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsuarioActual } from '../../common/auth.types';
import { Rol } from '../../common/enums';
import { existe, hhmm } from '../../common/utils';
import { Estudiante, HorarioClase, Periodo } from '../../database/entities';

export interface Sesion {
  horarioId: number; cargaId: number; dia: number; horaInicio: string; horaFin: string;
  materia: string; materiaCodigo: string; grupo: string; aula: string; sede: string; docente: string;
}

/** Los horarios no se guardan aparte: se derivan de la carga académica (una sola fuente de verdad). */
@Injectable()
export class HorariosService {
  constructor(
    @InjectRepository(HorarioClase) private horarios: Repository<HorarioClase>,
    @InjectRepository(Estudiante) private estudiantes: Repository<Estudiante>,
    @InjectRepository(Periodo) private periodos: Repository<Periodo>,
  ) {}

  private async periodo(periodoId?: number) {
    return periodoId ?? (await this.periodos.findOneBy({ actual: true }))?.id ?? 0;
  }

  private base(periodoId: number) {
    return this.horarios.createQueryBuilder('h')
      .innerJoinAndSelect('h.carga', 'c').innerJoinAndSelect('c.materia', 'm').innerJoinAndSelect('h.aula', 'a').innerJoinAndSelect('a.sede', 's')
      .innerJoinAndSelect('c.docente', 'd').innerJoinAndSelect('d.usuario', 'u')
      .where('c.periodoId = :periodoId', { periodoId }).orderBy('h.dia').addOrderBy('h.horaInicio');
  }

  private mapear(rows: HorarioClase[]): Sesion[] {
    return rows.map((h) => ({
      horarioId: h.id, cargaId: h.cargaId, dia: h.dia, horaInicio: hhmm(h.horaInicio), horaFin: hhmm(h.horaFin),
      materia: h.carga.materia.nombre, materiaCodigo: h.carga.materia.codigo, grupo: h.carga.grupo,
      aula: h.aula.codigo, sede: h.aula.sede.nombre, docente: `${h.carga.docente.usuario.nombres} ${h.carga.docente.usuario.apellidos}`,
    }));
  }

  async deDocente(docenteId: number, periodoId?: number) {
    return this.mapear(await this.base(await this.periodo(periodoId)).andWhere('c.docenteId = :docenteId', { docenteId }).getMany());
  }

  async deEstudiante(estudianteId: number, periodoId?: number) {
    const rows = await this.base(await this.periodo(periodoId))
      .innerJoin('inscripcion', 'i', 'i.carga_id = c.id AND i.estudiante_id = :estudianteId', { estudianteId }).getMany();
    return this.mapear(rows);
  }

  async deAula(aulaId: number, periodoId?: number) {
    return this.mapear(await this.base(await this.periodo(periodoId)).andWhere('h.aulaId = :aulaId', { aulaId }).getMany());
  }

  async mio(actor: UsuarioActual, periodoId?: number) {
    if (actor.rol === Rol.DOCENTE) return this.deDocente(actor.docenteId!, periodoId);
    if (actor.rol === Rol.ESTUDIANTE) return this.deEstudiante(actor.estudianteId!, periodoId);
    return [];
  }

  /** HU-21: el coordinador consulta estudiantes de su programa. */
  async consultarEstudiante(actor: UsuarioActual, estudianteId: number, periodoId?: number) {
    if (actor.rol === Rol.COORDINADOR) {
      const e = existe(await this.estudiantes.findOneBy({ id: estudianteId }), 'Estudiante no encontrado');
      if (e.programaId !== actor.programaId) throw new ForbiddenException('El estudiante no pertenece a tu programa');
    }
    return this.deEstudiante(estudianteId, periodoId);
  }
}
