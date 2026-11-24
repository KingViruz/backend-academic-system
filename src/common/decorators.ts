import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Rol } from './enums';
import { UsuarioActual } from './auth.types';

export const IS_PUBLIC = 'isPublic';
/** Endpoint sin JWT (login, lecturas del sensor). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES = 'roles';
/** Restringe el endpoint a los roles indicados. */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES, roles);

export const Usuario = createParamDecorator((_: unknown, ctx: ExecutionContext): UsuarioActual => ctx.switchToHttp().getRequest().user);

export const Ip = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest();
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
});
