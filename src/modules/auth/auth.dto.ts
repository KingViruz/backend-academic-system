import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Escribe un correo válido' }) email: string;
  @IsString() @MinLength(1, { message: 'Escribe tu contraseña' }) password: string;
}

export class CambiarPasswordDto {
  @IsString() actual: string;
  @IsString() @MinLength(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres' }) nueva: string;
}
