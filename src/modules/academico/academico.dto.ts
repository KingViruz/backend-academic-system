import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Length, Matches, Max, Min, ValidateNested } from 'class-validator';

export class HorarioDto {
  @IsInt() aulaId: number;
  @IsInt() @Min(1) @Max(6, { message: 'El día debe estar entre 1 (lunes) y 6 (sábado)' }) dia: number;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Hora de inicio inválida (usa HH:MM)' }) horaInicio: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Hora de fin inválida (usa HH:MM)' }) horaFin: string;
}

export class CargaDto {
  @IsInt() periodoId: number;
  @IsOptional() @IsInt() programaId?: number;
  @IsInt() materiaId: number;
  @IsInt() docenteId: number;
  @IsString() @Length(1, 10) grupo: string;
  @IsInt() @Min(1) @Max(200) cupo: number;
  @IsArray() @ArrayMinSize(1, { message: 'Agrega al menos una franja de horario' }) @ValidateNested({ each: true }) @Type(() => HorarioDto) horarios: HorarioDto[];
}

/** Para revisar cruces antes de guardar; al editar se excluye el propio grupo. */
export class ValidarCargaDto extends CargaDto {
  @IsOptional() @IsInt() excluirCargaId?: number;
}

export class CargaUpdateDto {
  @IsOptional() @IsInt() docenteId?: number;
  @IsOptional() @IsString() @Length(1, 10) grupo?: string;
  @IsOptional() @IsInt() @Min(1) @Max(200) cupo?: number;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => HorarioDto) horarios?: HorarioDto[];
}

export class InscribirDto {
  @IsInt() cargaId: number;
}
