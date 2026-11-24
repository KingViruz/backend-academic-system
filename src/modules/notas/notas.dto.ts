import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, IsString, Length, Max, Min, ValidateNested } from 'class-validator';

export class NotaDto {
  @IsInt() inscripcionId: number;
  @IsNumber({ maxDecimalPlaces: 1 }, { message: 'La nota debe ser un número con máximo un decimal' })
  @Min(0, { message: 'La nota mínima es 0.0' }) @Max(5, { message: 'La nota máxima es 5.0' }) nota: number;
}

export class RegistrarNotasDto {
  @IsInt() @Min(1) @Max(3) corte: number;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => NotaDto) notas: NotaDto[];
}

export class CerrarCorteDto {
  @IsInt() @Min(1) @Max(3) corte: number;
}

export class SolicitudDto {
  @IsInt() calificacionId: number;
  @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) @Max(5) notaNueva: number;
  @IsString() @Length(5, 300, { message: 'Explica el motivo del cambio (mínimo 5 caracteres)' }) motivo: string;
}

export class ResolverDto {
  @IsOptional() @IsString() @Length(0, 300) comentario?: string;
}
