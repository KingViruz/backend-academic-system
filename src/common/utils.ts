import { BadRequestException, NotFoundException } from '@nestjs/common';

export const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** "08:00" o "08:00:00" -> minutos desde medianoche */
export function minutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** Dos franjas se cruzan si una empieza antes de que termine la otra. Las contiguas (8-10 y 10-12) no se cruzan. */
export function seCruzan(aIni: string, aFin: string, bIni: string, bFin: string): boolean {
  return minutos(aIni) < minutos(bFin) && minutos(aFin) > minutos(bIni);
}

/** Ordena franjas por día y hora de inicio. */
export function ordenarFranjas<T extends { dia: number; horaInicio: string }>(h: T[] = []): T[] {
  return [...h].sort((a, b) => a.dia - b.dia || a.horaInicio.localeCompare(b.horaInicio));
}

export function hhmm(hora: string): string {
  return hora.slice(0, 5);
}

/** Redondeo a un decimal (mitad hacia arriba), evitando errores de coma flotante. */
export function redondear1(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

export function hoyISO(d = new Date()): string {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

export function edad(fechaNacimiento: string, ref = new Date()): number {
  const n = new Date(fechaNacimiento + 'T00:00:00');
  let e = ref.getFullYear() - n.getFullYear();
  const m = ref.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < n.getDate())) e--;
  return e;
}

export function existe<T>(v: T | null | undefined, msg: string): T {
  if (!v) throw new NotFoundException(msg);
  return v;
}

export function regla(cond: boolean, msg: string): void {
  if (!cond) throw new BadRequestException(msg);
}

export function num(v: string | undefined, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

/** Quita campos sensibles antes de devolver o auditar un usuario. */
export function sinSecretos<T extends object>(o: T): T {
  const { passwordHash, tokenHash, ...rest } = o as Record<string, unknown>;
  void passwordHash; void tokenHash;
  return rest as T;
}
