import { PartialType, OmitType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min, ValidateNested } from 'class-validator';
import { Rol } from '../../common/enums';

export class UsuarioBaseDto {
  @IsIn(['CC', 'TI', 'CE', 'PA'], { message: 'Tipo de identificación inválido' }) tipoIdentificacion: string;
  @Matches(/^[0-9A-Za-z]{5,20}$/, { message: 'La identificación debe tener entre 5 y 20 caracteres alfanuméricos' }) identificacion: string;
  @IsString() @Length(2, 80) nombres: string;
  @IsString() @Length(2, 80) apellidos: string;
  @IsEmail({}, { message: 'Correo con formato inválido' }) email: string;
  @IsOptional() @Matches(/^3\d{9}$/, { message: 'El celular debe tener 10 dígitos y empezar por 3' }) celular?: string;
  @IsOptional() @IsString() @Length(8, 100) password?: string;
}

export class AdminCrearDto extends UsuarioBaseDto {}

export class UsuarioUpdateDto extends PartialType(OmitType(UsuarioBaseDto, ['password'] as const)) {
  @IsOptional() @IsBoolean() activo?: boolean;
  @IsOptional() @IsEnum(Rol) rol?: Rol;
}

export class CoordinadorDto extends UsuarioBaseDto {
  @IsInt() programaId: number;
}
export class CoordinadorUpdateDto extends PartialType(OmitType(CoordinadorDto, ['password'] as const)) {}

export class DocenteDto extends UsuarioBaseDto {
  @IsOptional() @IsString() profesion?: string;
  @IsOptional() @IsDateString() fechaNacimiento?: string;
  @IsOptional() @IsString() direccion?: string;
}
export class DocenteUpdateDto extends PartialType(OmitType(DocenteDto, ['password'] as const)) {}

export class MateriasDocenteDto {
  @IsArray() @ArrayUnique() @IsInt({ each: true }) materiaIds: number[];
}

export class EstudianteDto extends UsuarioBaseDto {
  @Matches(/^[0-9A-Za-z-]{4,20}$/, { message: 'El código de carné debe tener entre 4 y 20 caracteres' }) codigoCarne: string;
  @IsInt() programaId: number;
  @IsOptional() @IsInt() @Min(1) @Max(12) semestre?: number;
  @IsDateString() fechaNacimiento: string;
  @IsDateString() fechaExpedicion: string;
  @IsOptional() @IsString() direccion?: string;
  @IsOptional() @IsString() acudienteNombre?: string;
  @IsOptional() @Matches(/^\d{7,10}$/, { message: 'Teléfono del acudiente inválido' }) acudienteTelefono?: string;
  @IsOptional() @IsInt() @Min(0) @Max(500) puntajeIcfes?: number;
  @IsOptional() @IsString() @Length(1, 10) sisben?: string;
}
export class EstudianteUpdateDto extends PartialType(OmitType(EstudianteDto, ['password'] as const)) {}

export class CargaMasivaDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => Object) filas: Record<string, string>[];
}
