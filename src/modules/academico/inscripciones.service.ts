import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditoriaService } from '../../common/auditoria.service';
import { UsuarioActual } from '../../common/auth.types';
import { DIAS, existe, hhmm, ordenarFranjas, redondear1, regla, seCruzan } from '../../common/utils';
import { Calificacion, CargaAcademica, Estudiante, HorarioClase, Inscripcion, Materia, Microcurriculo, Periodo } from '../../database/entities';

@Injectable()
export class InscripcionesService {
  constructor(
    private ds: DataSource,
    @InjectRepository(Inscripcion) private inscripciones: Repository<Inscripcion>,
    @InjectRepository(CargaAcademica) private cargas: Repository<CargaAcademica>,
    @InjectRepository(Estudiante) private estudiantes: Repository<Estudiante>,
    @InjectRepository(Periodo) private periodos: Repository<Periodo>,
    @InjectRepository(Microcurriculo) private micros: Repository<Microcurriculo>,
    @InjectRepository(Calificacion) private notas: Repository<Calificacion>,
    private auditoria: AuditoriaService,
  ) {}

  /** Grupos de su programa en el periodo actual, con cupo disponible (HU-18). */
  async oferta(actor: UsuarioActual) {
    const periodo = existe(await this.periodos.findOneBy({ actual: true }), 'No hay periodo académico actual');
    const cargas = await this.cargas.find({
      where: { periodoId: periodo.id, programaId: actor.programaId },
      relations: { materia: true, docente: { usuario: true }, horarios: { aula: { sede: true } } },
      order: { materia: { nombre: 'ASC' }, grupo: 'ASC' },
    });
    const ids = cargas.map((c) => c.id);
    const conteo = ids.length
      ? await this.inscripciones.createQueryBuilder('i').select('i.cargaId', 'cargaId').addSelect('COUNT(*)', 'n').where('i.cargaId IN (:...ids)', { ids }).groupBy('i.cargaId').getRawMany<{ cargaId: number; n: string }>()
      : [];
    const n = new Map(conteo.map((c) => [Number(c.cargaId), Number(c.n)]));
    const mias = new Set((await this.inscripciones.findBy({ estudianteId: actor.estudianteId })).map((i) => i.cargaId));
    return {
      periodo,
      grupos: cargas
        .map((c) => ({
          id: c.id, grupo: c.grupo, cupo: c.cupo, inscritos: n.get(c.id) ?? 0, disponibles: c.cupo - (n.get(c.id) ?? 0), inscrito: mias.has(c.id),
          materia: c.materia, docente: `${c.docente.usuario.nombres} ${c.docente.usuario.apellidos}`,
          horarios: ordenarFranjas(c.horarios).map((h) => ({ dia: h.dia, horaInicio: hhmm(h.horaInicio), horaFin: hhmm(h.horaFin), aula: h.aula.codigo, sede: h.aula.sede.nombre })),
        }))
        // Los grupos llenos no se ofrecen (CP-10 C), salvo que ya esté inscrito en él.
        .filter((g) => g.disponibles > 0 || g.inscrito),
    };
  }

  /** Nota definitiva = suma de cada corte por su porcentaje del microcurrículo. */
  static definitiva(notas: Record<number, number | undefined>, pct: [number, number, number]) {
    if ([1, 2, 3].some((c) => notas[c] === undefined)) return null;
    return redondear1((notas[1]! * pct[0] + notas[2]! * pct[1] + notas[3]! * pct[2]) / 100);
  }

  /** Materias aprobadas: grupos con los tres cortes cerrados y definitiva >= 3.0. */
  async materiasAprobadas(estudianteId: number): Promise<Set<number>> {
    const ins = await this.inscripciones.find({ where: { estudianteId }, relations: { carga: true } });
    const aprobadas = new Set<number>();
    for (const i of ins) {
      if (i.carga.ultimoCorteCerrado < 3) continue;
      const ns = await this.notas.findBy({ inscripcionId: i.id });
      const m = await this.micros.findOneBy({ materiaId: i.carga.materiaId, programaId: i.carga.programaId });
      const pct: [number, number, number] = m ? [m.porcentajeP1, m.porcentajeP2, m.porcentajeP3] : [30, 30, 40];
      const def = InscripcionesService.definitiva(Object.fromEntries(ns.map((n) => [n.corte, n.nota])), pct);
      if (def !== null && def >= 3) aprobadas.add(i.carga.materiaId);
    }
    return aprobadas;
  }

  async inscribir(actor: UsuarioActual, cargaId: number) {
    const est = existe(await this.estudiantes.findOne({ where: { id: actor.estudianteId }, relations: { usuario: true } }), 'Estudiante no encontrado');
    return this.ds.transaction(async (em) => {
      // Bloquea la fila del grupo para que dos inscripciones simultáneas no superen el cupo (CP-13).
      const carga = existe(await em.findOne(CargaAcademica, { where: { id: cargaId }, lock: { mode: 'pessimistic_write' } }), 'El grupo no existe');
      const materia = await em.findOneByOrFail(Materia, { id: carga.materiaId });
      const periodo = await em.findOneByOrFail(Periodo, { id: carga.periodoId });
      regla(periodo.actual, 'Solo puedes inscribir grupos del periodo actual');
      regla(carga.programaId === est.programaId, 'El grupo no pertenece a tu programa');

      const yaInscrito = await em.findOneBy(Inscripcion, { estudianteId: est.id, cargaId });
      if (yaInscrito) throw new ConflictException('Ya estás inscrito en este grupo');
      const inscritos = await em.countBy(Inscripcion, { cargaId });
      regla(inscritos < carga.cupo, 'El grupo no tiene cupos disponibles');

      const mias = await em.find(Inscripcion, { where: { estudianteId: est.id }, relations: { carga: { materia: true, horarios: true } } });
      const delPeriodo = mias.filter((i) => i.carga.periodoId === carga.periodoId);
      regla(!delPeriodo.some((i) => i.carga.materiaId === carga.materiaId), `Ya tienes inscrita ${materia.nombre} en otro grupo`);

      const creditos = delPeriodo.reduce((s, i) => s + i.carga.materia.creditos, 0);
      regla(creditos + materia.creditos <= periodo.limiteCreditos,
        `Superas el límite de créditos: tienes ${creditos}, la materia suma ${materia.creditos} y el máximo es ${periodo.limiteCreditos}`);

      const nuevos = await em.findBy(HorarioClase, { cargaId });
      for (const h of nuevos) for (const i of delPeriodo) for (const o of i.carga.horarios) {
        if (o.dia === h.dia && seCruzan(h.horaInicio, h.horaFin, o.horaInicio, o.horaFin))
          regla(false, `Se cruza con ${i.carga.materia.nombre} grupo ${i.carga.grupo} el ${DIAS[h.dia]} de ${hhmm(o.horaInicio)} a ${hhmm(o.horaFin)}`);
      }

      // Prerrequisitos (HU-19): definidos en el microcurrículo de la materia.
      const micro = await em.findOne(Microcurriculo, { where: { materiaId: carga.materiaId, programaId: carga.programaId }, relations: { prerrequisitos: true } });
      if (micro?.prerrequisitos?.length) {
        const aprobadas = await this.materiasAprobadas(est.id);
        const faltan = micro.prerrequisitos.filter((p) => !aprobadas.has(p.id));
        regla(faltan.length === 0, `Te falta aprobar: ${faltan.map((p) => p.nombre).join(', ')}`);
      }

      const ins = await em.save(Inscripcion, { estudianteId: est.id, cargaId });
      await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'INSCRIBIR', entidad: 'inscripcion', entidadId: ins.id, despues: { cargaId, estudianteId: est.id } }, em);
      return { ...ins, creditosTotales: creditos + materia.creditos, limite: periodo.limiteCreditos };
    });
  }

  async retirar(actor: UsuarioActual, id: number) {
    const ins = existe(await this.inscripciones.findOne({ where: { id }, relations: { carga: { periodo: true } } }), 'Inscripción no encontrada');
    if (ins.estudianteId !== actor.estudianteId) throw new ForbiddenException('La inscripción no es tuya');
    regla(ins.carga.periodo.actual, 'Solo puedes retirar materias del periodo actual');
    const notas = await this.notas.countBy({ inscripcionId: id });
    regla(notas === 0, 'No puedes retirar la materia: ya tiene notas registradas');
    try {
      await this.inscripciones.delete(id);
    } catch {
      regla(false, 'No puedes retirar la materia: ya tiene asistencias registradas');
    }
    await this.auditoria.registrar({ usuarioId: actor.sub, accion: 'RETIRAR', entidad: 'inscripcion', entidadId: id, antes: ins });
    return { ok: true };
  }

  async mias(actor: UsuarioActual) {
    const periodo = await this.periodos.findOneBy({ actual: true });
    const rows = await this.inscripciones.find({
      where: { estudianteId: actor.estudianteId, ...(periodo ? { carga: { periodoId: periodo.id } } : {}) },
      relations: { carga: { materia: true, docente: { usuario: true } } },
    });
    const creditos = rows.reduce((s, i) => s + i.carga.materia.creditos, 0);
    return {
      periodo, creditos, limite: periodo?.limiteCreditos ?? 0,
      inscripciones: rows.map((i) => ({ id: i.id, cargaId: i.cargaId, grupo: i.carga.grupo, materia: i.carga.materia, docente: `${i.carga.docente.usuario.nombres} ${i.carga.docente.usuario.apellidos}` })),
    };
  }
}
