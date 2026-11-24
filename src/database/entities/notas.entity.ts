import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { EstadoSolicitud } from '../../common/enums';
import { decimal } from '../transformers';
import { Inscripcion } from './carga.entity';
import { Usuario } from './usuario.entity';

/** Nota de un estudiante en un corte (1, 2 o 3). La definitiva se calcula con los % del microcurrículo. */
@Entity('calificacion')
@Index(['inscripcionId', 'corte'], { unique: true })
export class Calificacion {
  @PrimaryGeneratedColumn() id: number;
  @Column() inscripcionId: number;
  @ManyToOne(() => Inscripcion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inscripcion_id' })
  inscripcion: Inscripcion;
  @Column({ type: 'tinyint' }) corte: number;
  @Column({ type: 'decimal', precision: 2, scale: 1, transformer: decimal }) nota: number;
  @Column() registradaPorId: number;
  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'registrada_por_id' })
  registradaPor: Usuario;
  @UpdateDateColumn() updatedAt: Date;
}

/** Cambio de nota después del cierre de un corte: requiere aprobación del coordinador. */
@Entity('solicitud_cambio_nota')
export class SolicitudCambioNota {
  @PrimaryGeneratedColumn() id: number;
  @Column() calificacionId: number;
  @ManyToOne(() => Calificacion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'calificacion_id' })
  calificacion: Calificacion;
  @Column({ type: 'decimal', precision: 2, scale: 1, transformer: decimal }) notaAnterior: number;
  @Column({ type: 'decimal', precision: 2, scale: 1, transformer: decimal }) notaNueva: number;
  @Column({ length: 300 }) motivo: string;
  @Column({ type: 'enum', enum: EstadoSolicitud, default: EstadoSolicitud.PENDIENTE }) estado: EstadoSolicitud;
  @Column() solicitanteId: number;
  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'solicitante_id' })
  solicitante: Usuario;
  @Column({ type: 'int', nullable: true }) aprobadorId: number | null;
  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'aprobador_id' })
  aprobador: Usuario | null;
  @Column({ type: 'varchar', length: 300, nullable: true }) comentario: string | null;
  @CreateDateColumn() createdAt: Date;
  @Column({ type: 'datetime', nullable: true }) resueltaEn: Date | null;
}
