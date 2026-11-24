import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Aula, Materia, Periodo, Programa } from './estructura.entity';
import { Docente, Estudiante } from './personas.entity';

/** Un grupo de una materia en un periodo, con su docente. */
@Entity('carga_academica')
@Index(['periodoId', 'programaId', 'materiaId', 'grupo'], { unique: true })
export class CargaAcademica {
  @PrimaryGeneratedColumn() id: number;
  @Column() periodoId: number;
  @ManyToOne(() => Periodo, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'periodo_id' })
  periodo: Periodo;
  @Column() programaId: number;
  @ManyToOne(() => Programa, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'programa_id' })
  programa: Programa;
  @Column() materiaId: number;
  @ManyToOne(() => Materia, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'materia_id' })
  materia: Materia;
  @Column() docenteId: number;
  @ManyToOne(() => Docente, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'docente_id' })
  docente: Docente;
  @Column({ length: 10 }) grupo: string;
  @Column({ type: 'int' }) cupo: number;
  /** 0 = ningún corte cerrado; 3 = los tres cortes cerrados. */
  @Column({ type: 'tinyint', default: 0 }) ultimoCorteCerrado: number;
  @OneToMany(() => HorarioClase, (h) => h.carga, { cascade: true }) horarios: HorarioClase[];
  @CreateDateColumn() createdAt: Date;
}

/** Franja semanal de un grupo. Los horarios de docente y estudiante se derivan de aquí. */
@Entity('horario_clase')
export class HorarioClase {
  @PrimaryGeneratedColumn() id: number;
  @Column() cargaId: number;
  @ManyToOne(() => CargaAcademica, (c) => c.horarios, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'carga_id' })
  carga: CargaAcademica;
  @Column() aulaId: number;
  @ManyToOne(() => Aula, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'aula_id' })
  aula: Aula;
  /** 1 = lunes ... 6 = sábado */
  @Column({ type: 'tinyint' }) dia: number;
  @Column({ type: 'time' }) horaInicio: string;
  @Column({ type: 'time' }) horaFin: string;
}

/** Inscripción de un estudiante en un grupo (antes HorarioEstudiante). */
@Entity('inscripcion')
@Index(['estudianteId', 'cargaId'], { unique: true })
export class Inscripcion {
  @PrimaryGeneratedColumn() id: number;
  @Column() estudianteId: number;
  @ManyToOne(() => Estudiante, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'estudiante_id' })
  estudiante: Estudiante;
  @Column() cargaId: number;
  @ManyToOne(() => CargaAcademica, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'carga_id' })
  carga: CargaAcademica;
  @CreateDateColumn() createdAt: Date;
}
