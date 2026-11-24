import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC, ROLES } from './decorators';
import { Rol } from './enums';
import { UsuarioActual } from './auth.types';

/** Valida el JWT en todas las rutas salvo las marcadas con @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private reflector: Reflector, private jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;
    const req = ctx.switchToHttp().getRequest();
    const [tipo, token] = (req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw new UnauthorizedException('Inicia sesión para continuar');
    try {
      req.user = await this.jwt.verifyAsync<UsuarioActual>(token);
      return true;
    } catch {
      throw new UnauthorizedException('Tu sesión expiró. Vuelve a iniciar sesión');
    }
  }
}

/** Autorización por rol en el servidor (no solo en la interfaz). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Rol[]>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (!roles?.length) return true;
    const user: UsuarioActual | undefined = ctx.switchToHttp().getRequest().user;
    if (!user || !roles.includes(user.rol)) throw new ForbiddenException('No tienes permiso para esta acción');
    return true;
  }
}
