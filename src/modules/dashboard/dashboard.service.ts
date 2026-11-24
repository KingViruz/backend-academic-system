import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { UsuarioActual } from '../../common/auth.types';
import { EstadoAsistencia, EstadoSolicitud, Rol } from '../../common/enums';
import { num } from '../../common/utils';
import { Auditoria } from '../../database/entities';
import { AsistenciaService } from '../asistencia/asistencia.service';
import { HorariosService } from '../academico/horarios.service';
import { MicrocurriculoService } from '../microcurriculo/microcurriculo.service';

type Raw = Record<string, string | number | null>;

@Injectable()
export class DashboardService {
  constructor(
    private ds: DataSource,
    private config: ConfigService,
    @InjectRepository(Auditoria) private auditoria: Repository<Auditoria>,
    private micro: MicrocurriculoService,
    private asistencia: AsistenciaService,
    private horarios: HorariosService,
  ) {}

  private async q<T = Raw>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.ds.query(sql, params);
  }

  async resumen(actor: UsuarioActual) {
    switch (actor.rol) {
      case Rol.ADMIN: return this.admin();
      case Rol.COORDINADOR: return this.coordinador(actor);
      case Rol.DOCENTE: return this.docente(actor);
      default: return this.estudiante(actor);
    }
  }

  private async admin() {
    const [roles, totales, bloqueados, sensores] = await Promise.all([
      this.q(`SELECT rol, COUNT(*) n FROM usuario WHERE activo = 1 GROUP BY rol`),
      this.q(`SELECT (SELECT COUNT(*) FROM facultad WHERE activo=1) facultades, (SELECT COUNT(*) FROM programa WHERE activo=1) programas,
              (SELECT COUNT(*) FROM materia WHERE activo=1) materias, (SELECT COUNT(*) FROM aula WHERE activo=1) aulas`),
      this.q(`SELECT COUNT(*) n FROM usuario WHERE bloqueado_hasta > NOW()`),
      this.asistencia.listarSensores(),
    ]);
    const recientes = await this.auditoria.find({ order: { createdAt: 'DESC' }, take: 8 });
    return {
      rol: Rol.ADMIN,
      usuariosPorRol: Object.fromEntries(roles.map((r) => [r.rol, Number(r.n)])),
      totales: Object.fromEntries(Object.entries(totales[0] ?? {}).map(([k, v]) => [k, Number(v)])),
      cuentasBloqueadas: Number(bloqueados[0]?.n ?? 0),
      sensores: { total: sensores.length, conectados: sensores.filter((s) => s.conectado).length, enCola: sensores.reduce((s, x) => s + x.lecturasEnCola, 0) },
      actividadReciente: recientes,
    };
  }

  /** HU-38: asistencia promedio, avance de planes y rendimiento por materia del programa. */
  private async coordinador(actor: UsuarioActual) {
    const p = actor.programaId;
    const [asis, rendimiento, conteos, alertas, solicitudes] = await Promise.all([
      this.q(`SELECT m.nombre materia, c.grupo, c.id carga_id,
                SUM(CASE WHEN d.estado IN ('PRESENTE','TARDE','EXCUSADO') THEN 1 ELSE 0 END) asistio, COUNT(d.id) total
              FROM carga_academica c JOIN periodo pe ON pe.id = c.periodo_id AND pe.actual = 1
              JOIN materia m ON m.id = c.materia_id
              LEFT JOIN asistencia a ON a.carga_id = c.id AND a.estado = ?
              LEFT JOIN detalle_asistencia d ON d.asistencia_id = a.id
              WHERE c.programa_id = ? GROUP BY c.id, m.nombre, c.grupo ORDER BY m.nombre`, [EstadoAsistencia.CERRADA, p]),
      this.q(`SELECT m.nombre materia, c.grupo, cal.corte, ROUND(AVG(cal.nota), 2) promedio, COUNT(*) n,
                SUM(CASE WHEN cal.nota < ? THEN 1 ELSE 0 END) bajo
              FROM calificacion cal JOIN inscripcion i ON i.id = cal.inscripcion_id
              JOIN carga_academica c ON c.id = i.carga_id JOIN periodo pe ON pe.id = c.periodo_id AND pe.actual = 1
              JOIN materia m ON m.id = c.materia_id WHERE c.programa_id = ?
              GROUP BY m.nombre, c.grupo, cal.corte ORDER BY m.nombre, c.grupo, cal.corte`, [num(this.config.get('ALERTA_NOTA_MINIMA'), 3), p]),
      this.q(`SELECT (SELECT COUNT(*) FROM estudiante WHERE programa_id = ?) estudiantes,
                (SELECT COUNT(*) FROM carga_academica c JOIN periodo pe ON pe.id=c.periodo_id AND pe.actual=1 WHERE c.programa_id = ?) grupos,
                (SELECT COUNT(DISTINCT c.docente_id) FROM carga_academica c JOIN periodo pe ON pe.id=c.periodo_id AND pe.actual=1 WHERE c.programa_id = ?) docentes`, [p, p, p]),
      this.q(`SELECT tipo, COUNT(*) n FROM alerta WHERE atendida = 0 AND (programa_id = ? OR programa_id IS NULL) GROUP BY tipo`, [p]),
      this.q(`SELECT COUNT(*) n FROM solicitud_cambio_nota s JOIN calificacion cal ON cal.id = s.calificacion_id
              JOIN inscripcion i ON i.id = cal.inscripcion_id JOIN carga_academica c ON c.id = i.carga_id
              WHERE s.estado = ? AND c.programa_id = ?`, [EstadoSolicitud.PENDIENTE, p]),
    ]);
    const planes = await this.micro.seguimiento(actor);
    const semaforo = { VERDE: 0, AMARILLO: 0, ROJO: 0, SIN_INICIAR: 0 } as Record<string, number>;
    planes.forEach((x) => semaforo[x.avance.semaforo]++);
    const totAsis = asis.reduce((s, r) => s + Number(r.total), 0);
    const totAsistio = asis.reduce((s, r) => s + Number(r.asistio), 0);
    return {
      rol: Rol.COORDINADOR,
      totales: Object.fromEntries(Object.entries(conteos[0] ?? {}).map(([k, v]) => [k, Number(v)])),
      asistenciaPromedio: totAsis ? Math.round((totAsistio / totAsis) * 1000) / 10 : null,
      asistenciaPorGrupo: asis.map((r) => ({ cargaId: Number(r.carga_id), materia: r.materia, grupo: r.grupo, porcentaje: Number(r.total) ? Math.round((Number(r.asistio) / Number(r.total)) * 1000) / 10 : null })),
      rendimiento: rendimiento.map((r) => ({ materia: r.materia, grupo: r.grupo, corte: Number(r.corte), promedio: Number(r.promedio), notas: Number(r.n), bajoMinimo: Number(r.bajo) })),
      planes: { semaforo, detalle: planes },
      alertasAbiertas: Object.fromEntries(alertas.map((a) => [a.tipo, Number(a.n)])),
      solicitudesPendientes: Number(solicitudes[0]?.n ?? 0),
    };
  }

  private async docente(actor: UsuarioActual) {
    const horario = await this.horarios.mio(actor);
    const hoy = new Date().getDay();
    const [grupos, abiertas] = await Promise.all([
      this.q(`SELECT c.id, m.nombre materia, c.grupo, c.ultimo_corte_cerrado, (SELECT COUNT(*) FROM inscripcion i WHERE i.carga_id = c.id) inscritos
              FROM carga_academica c JOIN periodo pe ON pe.id = c.periodo_id AND pe.actual = 1 JOIN materia m ON m.id = c.materia_id
              WHERE c.docente_id = ? ORDER BY m.nombre`, [actor.docenteId]),
      this.asistencia.abiertasDocente(actor),
    ]);
    const planes = await this.micro.seguimiento(actor);
    return {
      rol: Rol.DOCENTE,
      grupos: grupos.map((g) => ({ id: Number(g.id), materia: g.materia, grupo: g.grupo, inscritos: Number(g.inscritos), ultimoCorteCerrado: Number(g.ultimo_corte_cerrado) })),
      clasesHoy: horario.filter((h) => h.dia === hoy),
      asistenciasAbiertas: abiertas,
      planes,
      temasAtrasados: planes.reduce((s, p) => s + p.avance.atrasados.length, 0),
    };
  }

  private async estudiante(actor: UsuarioActual) {
    const horario = await this.horarios.mio(actor);
    const hoy = new Date().getDay();
    const asistencias = await this.asistencia.mias(actor);
    const [cred] = await this.q(`SELECT COALESCE(SUM(m.creditos),0) creditos, pe.limite_creditos limite FROM inscripcion i
      JOIN carga_academica c ON c.id = i.carga_id JOIN periodo pe ON pe.id = c.periodo_id AND pe.actual = 1 JOIN materia m ON m.id = c.materia_id
      WHERE i.estudiante_id = ? GROUP BY pe.limite_creditos`, [actor.estudianteId]);
    return {
      rol: Rol.ESTUDIANTE,
      creditos: Number(cred?.creditos ?? 0), limiteCreditos: Number(cred?.limite ?? 0),
      clasesHoy: horario.filter((h) => h.dia === hoy),
      asistencias: asistencias.map(({ historial, ...a }) => { void historial; return a; }),
      materiasEnRiesgo: asistencias.filter((a) => a.enRiesgo).length,
    };
  }

  listarAuditoria(f: { entidad?: string; usuarioId?: number; accion?: string; pagina?: number }) {
    const qb = this.auditoria.createQueryBuilder('a').orderBy('a.id', 'DESC').take(50).skip(((f.pagina ?? 1) - 1) * 50);
    if (f.entidad) qb.andWhere('a.entidad = :e', { e: f.entidad });
    if (f.usuarioId) qb.andWhere('a.usuarioId = :u', { u: f.usuarioId });
    if (f.accion) qb.andWhere('a.accion = :ac', { ac: f.accion });
    return qb.getManyAndCount().then(([items, total]) => ({ items, total, pagina: f.pagina ?? 1, porPagina: 50 }));
  }
}
