import { PartialType } from '@nestjs/mapped-types';
import { ArrayUnique, IsArray, IsBoolean, IsDateString, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class MicrocurriculoDto {
  @IsInt() materiaId: number;
  @IsOptional() @IsInt() programaId?: number;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsString() objetivoGeneral?: string;
  @IsOptional() @IsString() objetivosEspecificos?: string;
  @IsOptional() @IsString() competenciasGenericas?: string;
  @IsOptional() @IsString() estrategias?: string;
  @IsOptional() @IsString() bibliografia?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) porcentajeP1?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) porcentajeP2?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) porcentajeP3?: number;
}
export class MicrocurriculoUpdateDto extends PartialType(MicrocurriculoDto) {}

export class UnidadDto {
  @IsInt() @Min(1) numero: number;
  @IsString() @Length(2, 150) nombre: string;
  @IsString() @Length(2) competenciaEspecifica: string;
  @IsString() @Length(2) resultadoAprendizaje: string;
  @IsString() @Length(2) nivelSuperior: string;
  @IsString() @Length(2) nivelNormal: string;
  @IsString() @Length(2) nivelBajo: string;
  @IsString() @Length(2) nivelDeficiente: string;
}
export class UnidadUpdateDto extends PartialType(UnidadDto) {}

export class PrerrequisitosDto {
  @IsArray() @ArrayUnique() @IsInt({ each: true }) materiaIds: number[];
}

export class PlanDto {
  @IsInt() cargaId: number;
  @IsDateString() fechaInicio: string;
  @IsDateString() fechaFin: string;
  @IsInt() @Min(1) totalHoras: number;
}

export class DetallePlanDto {
  @IsInt() @Min(1) @Max(30) semana: number;
  @IsInt() unidadId: number;
  @IsString() @Length(2, 200) tema: string;
  @IsOptional() @IsString() @Length(0, 300) actividad?: string;
  @IsInt() @Min(1) horas: number;
  @IsInt() @Min(1) @Max(3) corte: number;
  @IsDateString() fechaPlaneada: string;
}
export class DetallePlanUpdateDto extends PartialType(DetallePlanDto) {}

export class EjecutarDto {
  @IsBoolean() ejecutado: boolean;
  @IsOptional() @IsDateString() fechaEjecucion?: string;
  @IsOptional() @IsString() @Length(0, 500) observaciones?: string;
}
