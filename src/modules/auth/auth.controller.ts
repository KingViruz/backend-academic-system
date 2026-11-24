import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Ip, Public, Usuario } from '../../common/decorators';
import { UsuarioActual } from '../../common/auth.types';
import { AuthService } from './auth.service';
import { CambiarPasswordDto, LoginDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public() @Post('login') @HttpCode(200)
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.auth.login(dto.email, dto.password, ip);
  }

  @Get('me')
  me(@Usuario() u: UsuarioActual) {
    return this.auth.perfil(u);
  }

  @Post('cambiar-password') @HttpCode(200)
  cambiar(@Usuario() u: UsuarioActual, @Body() dto: CambiarPasswordDto) {
    return this.auth.cambiarPassword(u, dto.actual, dto.nueva);
  }
}
