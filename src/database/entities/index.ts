export * from './usuario.entity';
export * from './estructura.entity';
export * from './personas.entity';
export * from './carga.entity';
export * from './microcurriculo.entity';
export * from './asistencia.entity';
export * from './notas.entity';
export * from './sistema.entity';

import { Usuario } from './usuario.entity';
import { Aula, Facultad, Materia, Periodo, Programa, Sede } from './estructura.entity';
import { Coordinador, Docente, Estudiante } from './personas.entity';
import { CargaAcademica, HorarioClase, Inscripcion } from './carga.entity';
import { DetallePlanMicrocurriculo, Microcurriculo, PlanMicrocurriculo, UnidadTematica } from './microcurriculo.entity';
import { Asistencia, DetalleAsistencia, LecturaSensor, SensorAsistencia } from './asistencia.entity';
import { Calificacion, SolicitudCambioNota } from './notas.entity';
import { Alerta, Auditoria } from './sistema.entity';

export const ENTITIES = [
  Usuario, Facultad, Programa, Materia, Sede, Aula, Periodo, Coordinador, Docente, Estudiante,
  CargaAcademica, HorarioClase, Inscripcion, Microcurriculo, UnidadTematica, PlanMicrocurriculo,
  DetallePlanMicrocurriculo, SensorAsistencia, Asistencia, DetalleAsistencia, LecturaSensor,
  Calificacion, SolicitudCambioNota, Auditoria, Alerta,
];
