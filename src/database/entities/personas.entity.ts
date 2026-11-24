import { Column, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Usuario } from './usuario.entity';
import { Materia, Programa } from './estructura.entity';

@Entity('coordinador')
export class Coordinador {
  @PrimaryGeneratedColumn() id: number;
  @Column({ unique: true }) usuarioId: number;
  @OneToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;
  /** Un programa tiene un solo coordinador. */
  @Column({ unique: true }) programaId: number;
  @ManyToOne(() => Programa, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'programa_id' })
  programa: Programa;
}

@Entity('docente')
export class Docente {
  @PrimaryGeneratedColumn() id: number;
  @Column({ unique: true }) usuarioId: number;
  @OneToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;
  @Column({ type: 'varchar', length: 120, nullable: true }) profesion: string | null;
  @Column({ type: 'date', nullable: true }) fechaNacimiento: string | null;
  @Column({ type: 'varchar', length: 200, nullable: true }) direccion: string | null;
  /** Materias que el docente está habilitado para dictar (MateriaDocente). */
  @ManyToMany(() => Materia)
  @JoinTable({ name: 'materia_docente', joinColumn: { name: 'docente_id' }, inverseJoinColumn: { name: 'materia_id' } })
  materias: Materia[];
}

@Entity('estudiante')
export class Estudiante {
  @PrimaryGeneratedColumn() id: number;
  @Column({ unique: true }) usuarioId: number;
  @OneToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;
  /** Número de carné: es lo que lee el sensor de asistencia. */
  @Column({ length: 20, unique: true }) codigoCarne: string;
  @Column() programaId: number;
  @ManyToOne(() => Programa, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'programa_id' })
  programa: Programa;
  @Column({ type: 'int', default: 1 }) semestre: number;
  @Column({ type: 'date' }) fechaNacimiento: string;
  @Column({ type: 'date' }) fechaExpedicion: string;
  @Column({ type: 'varchar', length: 200, nullable: true }) direccion: string | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) acudienteNombre: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) acudienteTelefono: string | null;
  @Column({ type: 'int', nullable: true }) puntajeIcfes: number | null;
  @Column({ type: 'varchar', length: 10, nullable: true }) sisben: string | null;
}
