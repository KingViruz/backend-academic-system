import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Rol } from '../../common/enums';

/** Persona que ingresa al sistema. Docente, Estudiante y Coordinador extienden sus datos. */
@Entity('usuario')
export class Usuario {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 5, default: 'CC' }) tipoIdentificacion: string;
  @Column({ length: 20, unique: true }) identificacion: string;
  @Column({ length: 80 }) nombres: string;
  @Column({ length: 80 }) apellidos: string;
  @Column({ length: 120, unique: true }) email: string;
  @Column({ type: 'varchar', length: 20, nullable: true }) celular: string | null;
  @Column({ length: 100, select: false }) passwordHash: string;
  @Column({ type: 'enum', enum: Rol }) rol: Rol;
  @Column({ default: true }) activo: boolean;
  @Column({ type: 'int', default: 0 }) intentosFallidos: number;
  @Column({ type: 'datetime', nullable: true }) bloqueadoHasta: Date | null;
  @Column({ type: 'datetime', nullable: true }) ultimoAcceso: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
