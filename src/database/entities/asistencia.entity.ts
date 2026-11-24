import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { EstadoAsistencia, EstadoAsistente, EstadoLectura, OrigenRegistro } from '../../common/enums';
import { Aula } from './estructura.entity';
import { CargaAcademica, HorarioClase } from './carga.entity';
import { Estudiante } from './personas.entity';

@Entity('sensor_asistencia')
export class SensorAsistencia {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 30, unique: true }) codigo: string;
  @Column() aulaId: number;
  @ManyToOne(() => Aula, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'aula_id' })
  aula: Aula;
  @Column({ length: 100, select: false }) tokenHash: string;
  @Column({ type: 'datetime', nullable: true }) ultimaSenal: Date | null;
  @Column({ default: true }) activo: boolean;
}

/** Una sesión de clase en la que se toma asistencia. */
@Entity('asistencia')
export class Asistencia {
  @PrimaryGeneratedColumn() id: number;
  @Column() cargaId: number;
  @ManyToOne(() => CargaAcademica, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'carga_id' })
  carga: CargaAcademica;
  @Column({ type: 'int', nullable: true }) horarioId: number | null;
  @ManyToOne(() => HorarioClase, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'horario_id' })
  horario: HorarioClase | null;
  @Column() aulaId: number;
  @ManyToOne(() => Aula, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'aula_id' })
  aula: Aula;
  @Column({ type: 'date' }) fecha: string;
  @Column({ length: 200 }) tema: string;
  @Column({ type: 'datetime' }) horaApertura: Date;
  @Column({ type: 'int', default: 15 }) toleranciaMin: number;
  @Column({ type: 'enum', enum: EstadoAsistencia, default: EstadoAsistencia.ABIERTA }) estado: EstadoAsistencia;
  @Column({ type: 'datetime', nullable: true }) cerradaEn: Date | null;
  @OneToMany(() => DetalleAsistencia, (d) => d.asistencia) detalles: DetalleAsistencia[];
}

@Entity('detalle_asistencia')
@Index(['asistenciaId', 'estudianteId'], { unique: true })
export class DetalleAsistencia {
  @PrimaryGeneratedColumn() id: number;
  @Column() asistenciaId: number;
  @ManyToOne(() => Asistencia, (a) => a.detalles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asistencia_id' })
  asistencia: Asistencia;
  @Column() estudianteId: number;
  @ManyToOne(() => Estudiante, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'estudiante_id' })
  estudiante: Estudiante;
  @Column({ type: 'enum', enum: EstadoAsistente }) estado: EstadoAsistente;
  @Column({ type: 'datetime', nullable: true }) horaRegistro: Date | null;
  @Column({ type: 'enum', enum: OrigenRegistro }) origen: OrigenRegistro;
  @Column({ type: 'varchar', length: 300, nullable: true }) motivo: string | null;
  @UpdateDateColumn() updatedAt: Date;
}

/** Cada lectura que envía un sensor. Si no hay asistencia abierta queda PENDIENTE (cola). */
@Entity('lectura_sensor')
export class LecturaSensor {
  @PrimaryGeneratedColumn() id: number;
  @Column() sensorId: number;
  @ManyToOne(() => SensorAsistencia, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sensor_id' })
  sensor: SensorAsistencia;
  @Column({ length: 20 }) codigoCarne: string;
  @Column({ type: 'datetime' }) leidoEn: Date;
  @CreateDateColumn() recibidoEn: Date;
  @Column({ type: 'enum', enum: EstadoLectura }) estado: EstadoLectura;
  @Column({ type: 'varchar', length: 200, nullable: true }) detalle: string | null;
  @Column({ type: 'int', nullable: true }) asistenciaId: number | null;
}
