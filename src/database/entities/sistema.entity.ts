import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TipoAlerta } from '../../common/enums';

/** Bitácora de auditoría: solo se inserta, nunca se edita ni se borra. */
@Entity('auditoria')
@Index(['entidad', 'entidadId'])
export class Auditoria {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id: string;
  @Column({ type: 'int', nullable: true }) usuarioId: number | null;
  @Column({ length: 40 }) accion: string;
  @Column({ length: 60 }) entidad: string;
  @Column({ type: 'varchar', length: 40, nullable: true }) entidadId: string | null;
  @Column({ type: 'json', nullable: true }) valorAnterior: unknown;
  @Column({ type: 'json', nullable: true }) valorNuevo: unknown;
  @Column({ type: 'varchar', length: 60, nullable: true }) ip: string | null;
  @CreateDateColumn() createdAt: Date;
}

@Entity('alerta')
export class Alerta {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'enum', enum: TipoAlerta }) tipo: TipoAlerta;
  @Column({ type: 'int', nullable: true }) programaId: number | null;
  @Column({ type: 'int', nullable: true }) estudianteId: number | null;
  @Column({ type: 'int', nullable: true }) cargaId: number | null;
  @Column({ length: 300 }) mensaje: string;
  /** Evita generar la misma alerta dos veces por la misma condición. */
  @Column({ length: 120, unique: true }) clave: string;
  @Column({ default: false }) atendida: boolean;
  @Column({ type: 'int', nullable: true }) atendidaPorId: number | null;
  @CreateDateColumn() createdAt: Date;
}
