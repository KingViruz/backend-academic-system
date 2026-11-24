import { Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { Roles, Usuario } from '../../common/decorators';
import { UsuarioActual } from '../../common/auth.types';
import { Rol, TipoAlerta } from '../../common/enums';
import { AlertasService } from './alertas.service';

@Controller('alertas')
@Roles(Rol.ADMIN, Rol.COORDINADOR)
export class AlertasController {
  constructor(private s: AlertasService) {}

  @Get() listar(@Usuario() u: UsuarioActual, @Query('atendida') at?: string, @Query('tipo') tipo?: TipoAlerta) {
    return this.s.listar(u, { atendida: at === undefined ? undefined : at === 'true', tipo });
  }

  @Post(':id/atender') atender(@Param('id', ParseIntPipe) id: number, @Usuario() u: UsuarioActual) { return this.s.atender(id, u); }
}
