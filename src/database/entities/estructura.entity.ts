import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

@Entity('facultad')
export class Facultad {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 20, unique: true }) codigo: string;
  @Column({ length: 150 }) nombre: string;
  @Column({ default: true }) activo: boolean;
  @OneToMany(() => Programa, (p) => p.facultad) programas: Programa[];
  @CreateDateColumn() createdAt: Date;
}

@Entity('programa')
export class Programa {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 20, unique: true }) codigo: string;
  @Column({ length: 150 }) nombre: string;
  @Column({ type: 'int' }) creditos: number;
  @Column() facultadId: number;
  @ManyToOne(() => Facultad, (f) => f.programas, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'facultad_id' })
  facultad: Facultad;
  @Column({ default: true }) activo: boolean;
  @CreateDateColumn() createdAt: Date;
}

@Entity('materia')
export class Materia {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 20, unique: true }) codigo: string;
  @Column({ length: 150 }) nombre: string;
  @Column({ type: 'int' }) creditos: number;
  @Column({ default: true }) activo: boolean;
  @CreateDateColumn() createdAt: Date;
}

@Entity('sede')
export class Sede {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 100, unique: true }) nombre: string;
  @Column({ type: 'varchar', length: 200, nullable: true }) direccion: string | null;
  @Column({ default: true }) activo: boolean;
}

@Entity('aula')
@Index(['sedeId', 'codigo'], { unique: true })
export class Aula {
  @PrimaryGeneratedColumn() id: number;
  @Column() sedeId: number;
  @ManyToOne(() => Sede, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sede_id' })
  sede: Sede;
  @Column({ length: 20 }) codigo: string;
  @Column({ type: 'int' }) capacidad: number;
  @Column({ default: true }) activo: boolean;
}

@Entity('periodo')
export class Periodo {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 10, unique: true }) codigo: string;
  @Column({ type: 'date' }) fechaInicio: string;
  @Column({ type: 'date' }) fechaFin: string;
  @Column({ type: 'int', default: 20 }) limiteCreditos: number;
  @Column({ default: false }) actual: boolean;
}
