import { Controller, Get, Query } from '@nestjs/common';
import { Roles, Usuario } from '../../common/decorators';
import { UsuarioActual } from '../../common/auth.types';
import { Rol } from '../../common/enums';
import { DashboardService } from './dashboard.service';

@Controller()
export class DashboardController {
  constructor(private s: DashboardService) {}

  @Get('dashboard') resumen(@Usuario() u: UsuarioActual) { return this.s.resumen(u); }

  @Roles(Rol.ADMIN) @Get('auditoria')
  auditoria(@Query('entidad') entidad?: string, @Query('usuarioId') usuarioId?: string, @Query('accion') accion?: string, @Query('pagina') pagina?: string) {
    return this.s.listarAuditoria({ entidad, accion, usuarioId: usuarioId ? Number(usuarioId) : undefined, pagina: pagina ? Number(pagina) : undefined });
  }
}
