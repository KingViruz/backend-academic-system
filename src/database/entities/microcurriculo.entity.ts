import { Column, Entity, Index, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { EstadoMicrocurriculo } from '../../common/enums';
import { Materia, Programa } from './estructura.entity';
import { CargaAcademica } from './carga.entity';

@Entity('microcurriculo')
@Index(['materiaId', 'programaId'], { unique: true })
export class Microcurriculo {
  @PrimaryGeneratedColumn() id: number;
  @Column() materiaId: number;
  @ManyToOne(() => Materia, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'materia_id' })
  materia: Materia;
  @Column() programaId: number;
  @ManyToOne(() => Programa, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'programa_id' })
  programa: Programa;
  @Column({ type: 'text', nullable: true }) descripcion: string | null;
  @Column({ type: 'text', nullable: true }) objetivoGeneral: string | null;
  @Column({ type: 'text', nullable: true }) objetivosEspecificos: string | null;
  @Column({ type: 'text', nullable: true }) competenciasGenericas: string | null;
  @Column({ type: 'text', nullable: true }) estrategias: string | null;
  @Column({ type: 'text', nullable: true }) bibliografia: string | null;
  @Column({ type: 'int', default: 30 }) porcentajeP1: number;
  @Column({ type: 'int', default: 30 }) porcentajeP2: number;
  @Column({ type: 'int', default: 40 }) porcentajeP3: number;
  @Column({ type: 'enum', enum: EstadoMicrocurriculo, default: EstadoMicrocurriculo.BORRADOR }) estado: EstadoMicrocurriculo;
  @Column({ type: 'datetime', nullable: true }) publicadoEn: Date | null;
  @OneToMany(() => UnidadTematica, (u) => u.microcurriculo) unidades: UnidadTematica[];
  @ManyToMany(() => Materia)
  @JoinTable({ name: 'microcurriculo_prerrequisito', joinColumn: { name: 'microcurriculo_id' }, inverseJoinColumn: { name: 'materia_id' } })
  prerrequisitos: Materia[];
  @UpdateDateColumn() updatedAt: Date;
}

/** Unidad con su competencia específica, resultado de aprendizaje y niveles de desempeño. */
@Entity('unidad_tematica')
export class UnidadTematica {
  @PrimaryGeneratedColumn() id: number;
  @Column() microcurriculoId: number;
  @ManyToOne(() => Microcurriculo, (m) => m.unidades, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'microcurriculo_id' })
  microcurriculo: Microcurriculo;
  @Column({ type: 'int' }) numero: number;
  @Column({ length: 150 }) nombre: string;
  @Column({ type: 'text' }) competenciaEspecifica: string;
  @Column({ type: 'text' }) resultadoAprendizaje: string;
  @Column({ type: 'text' }) nivelSuperior: string;
  @Column({ type: 'text' }) nivelNormal: string;
  @Column({ type: 'text' }) nivelBajo: string;
  @Column({ type: 'text' }) nivelDeficiente: string;
}

/** Ejecución del microcurrículo en un grupo (periodo + docente salen de la carga). */
@Entity('plan_microcurriculo')
export class PlanMicrocurriculo {
  @PrimaryGeneratedColumn() id: number;
  @Column() microcurriculoId: number;
  @ManyToOne(() => Microcurriculo, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'microcurriculo_id' })
  microcurriculo: Microcurriculo;
  @Column({ unique: true }) cargaId: number;
  @ManyToOne(() => CargaAcademica, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'carga_id' })
  carga: CargaAcademica;
  @Column({ type: 'date' }) fechaInicio: string;
  @Column({ type: 'date' }) fechaFin: string;
  @Column({ type: 'int' }) totalHoras: number;
  @OneToMany(() => DetallePlanMicrocurriculo, (d) => d.plan) detalles: DetallePlanMicrocurriculo[];
}

@Entity('detalle_plan_microcurriculo')
export class DetallePlanMicrocurriculo {
  @PrimaryGeneratedColumn() id: number;
  @Column() planId: number;
  @ManyToOne(() => PlanMicrocurriculo, (p) => p.detalles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan: PlanMicrocurriculo;
  @Column({ type: 'int' }) semana: number;
  @Column() unidadId: number;
  @ManyToOne(() => UnidadTematica, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'unidad_id' })
  unidad: UnidadTematica;
  @Column({ length: 200 }) tema: string;
  @Column({ type: 'varchar', length: 300, nullable: true }) actividad: string | null;
  @Column({ type: 'int' }) horas: number;
  @Column({ type: 'tinyint' }) corte: number;
  @Column({ type: 'date' }) fechaPlaneada: string;
  @Column({ default: false }) ejecutado: boolean;
  @Column({ type: 'date', nullable: true }) fechaEjecucion: string | null;
  @Column({ type: 'varchar', length: 500, nullable: true }) observaciones: string | null;
}
