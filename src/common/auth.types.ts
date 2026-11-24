import { Rol } from './enums';

/** Datos que viajan en el JWT y que cada endpoint recibe como usuario actual. */
export interface UsuarioActual {
  sub: number;
  rol: Rol;
  email: string;
  nombre: string;
  docenteId?: number;
  estudianteId?: number;
  /** Programa del coordinador o del estudiante. */
  programaId?: number;
}
