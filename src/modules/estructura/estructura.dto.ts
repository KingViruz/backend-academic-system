import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export class FacultadDto {
  @IsString() @Length(1, 20) codigo: string;
  @IsString() @Length(2, 150) nombre: string;
  @IsOptional() @IsBoolean() activo?: boolean;
}
export class FacultadUpdateDto extends PartialType(FacultadDto) {}

export class ProgramaDto {
  @IsString() @Length(1, 20) codigo: string;
  @IsString() @Length(2, 150) nombre: string;
  @IsInt() @Min(1, { message: 'Los créditos deben ser mayores a cero' }) creditos: number;
  @IsInt() facultadId: number;
  @IsOptional() @IsBoolean() activo?: boolean;
}
export class ProgramaUpdateDto extends PartialType(ProgramaDto) {}

export class MateriaDto {
  @IsString() @Length(1, 20) codigo: string;
  @IsString() @Length(2, 150) nombre: string;
  @IsInt() @Min(1) @Max(10) creditos: number;
  @IsOptional() @IsBoolean() activo?: boolean;
}
export class MateriaUpdateDto extends PartialType(MateriaDto) {}

export class SedeDto {
  @IsString() @Length(2, 100) nombre: string;
  @IsOptional() @IsString() direccion?: string;
  @IsOptional() @IsBoolean() activo?: boolean;
}
export class SedeUpdateDto extends PartialType(SedeDto) {}

export class AulaDto {
  @IsInt() sedeId: number;
  @IsString() @Length(1, 20) codigo: string;
  @IsInt() @Min(1, { message: 'La capacidad es obligatoria' }) capacidad: number;
  @IsOptional() @IsBoolean() activo?: boolean;
}
export class AulaUpdateDto extends PartialType(AulaDto) {}

export class PeriodoDto {
  @Matches(/^\d{4}-[12]$/, { message: 'El código del periodo debe tener la forma 2027-1' }) codigo: string;
  @IsDateString() fechaInicio: string;
  @IsDateString() fechaFin: string;
  @IsOptional() @IsInt() @Min(1) limiteCreditos?: number;
  @IsOptional() @IsBoolean() actual?: boolean;
}
export class PeriodoUpdateDto extends PartialType(PeriodoDto) {}
