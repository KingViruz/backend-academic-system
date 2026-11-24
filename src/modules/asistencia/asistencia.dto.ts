import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, Length, Matches, ValidateNested } from 'class-validator';
import { EstadoAsistente } from '../../common/enums';

export class AbrirAsistenciaDto {
  @IsInt() cargaId: number;
  @IsString() @Length(2, 200) tema: string;
  @IsOptional() @IsInt() horarioId?: number;
}

export class ManualDto {
  @IsInt() estudianteId: number;
  @IsEnum(EstadoAsistente) estado: EstadoAsistente;
  @IsOptional() @IsString() @Length(0, 300) motivo?: string;
}

export class CorregirDto {
  @IsEnum(EstadoAsistente) estado: EstadoAsistente;
  @IsString() @Length(3, 300, { message: 'Escribe el motivo de la corrección' }) motivo: string;
}

export class QrDto {
  @Matches(/^[0-9A-Z]{6}$/, { message: 'El código tiene 6 caracteres' }) codigo: string;
}

export class LecturaDto {
  @IsString() @Length(1, 20) carne: string;
  /** Hora real en que se pasó el carné (el sensor la guarda en memoria si no hay red). */
  @IsDateString() leidoEn: string;
}

export class LecturasDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => LecturaDto) lecturas: LecturaDto[];
}

export class SensorDto {
  @IsString() @Length(2, 30) codigo: string;
  @IsInt() aulaId: number;
}

export class SensorUpdateDto {
  @IsOptional() @IsInt() aulaId?: number;
  @IsOptional() activo?: boolean;
}
