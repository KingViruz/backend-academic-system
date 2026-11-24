import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { Roles, Usuario } from '../../common/decorators';
import { UsuarioActual } from '../../common/auth.types';
import { EstadoSolicitud, Rol } from '../../common/enums';
import { NotasService } from './notas.service';
import { CerrarCorteDto, RegistrarNotasDto, ResolverDto, SolicitudDto } from './notas.dto';

@Controller()
export class NotasController {
  constructor(private s: NotasService) {}

  @Roles(Rol.DOCENTE, Rol.COORDINADOR, Rol.ADMIN) @Get('calificaciones/grupo/:cargaId') grupo(@Param('cargaId', ParseIntPipe) id: number, @Usuario() u: UsuarioActual) { return this.s.grupo(id, u); }
  @Roles(Rol.DOCENTE) @Put('calificaciones/grupo/:cargaId') registrar(@Param('cargaId', ParseIntPipe) id: number, @Body() d: RegistrarNotasDto, @Usuario() u: UsuarioActual) { return this.s.registrar(id, d.corte, d.notas, u); }
  @Roles(Rol.DOCENTE) @Post('calificaciones/grupo/:cargaId/cerrar-corte') @HttpCode(200) cerrar(@Param('cargaId', ParseIntPipe) id: number, @Body() d: CerrarCorteDto, @Usuario() u: UsuarioActual) { return this.s.cerrarCorte(id, d.corte, u); }
  @Roles(Rol.ESTUDIANTE) @Get('calificaciones/mias') mias(@Usuario() u: UsuarioActual) { return this.s.mias(u); }

  @Roles(Rol.DOCENTE) @Post('solicitudes-nota') solicitar(@Body() d: SolicitudDto, @Usuario() u: UsuarioActual) { return this.s.solicitar(d.calificacionId, d.notaNueva, d.motivo, u); }
  @Roles(Rol.DOCENTE, Rol.COORDINADOR, Rol.ADMIN) @Get('solicitudes-nota') listar(@Usuario() u: UsuarioActual, @Query('estado') e?: EstadoSolicitud) { return this.s.listarSolicitudes(u, e); }
  @Roles(Rol.COORDINADOR) @Post('solicitudes-nota/:id/aprobar') @HttpCode(200) aprobar(@Param('id', ParseIntPipe) id: number, @Body() d: ResolverDto, @Usuario() u: UsuarioActual) { return this.s.resolver(id, true, d.comentario, u); }
  @Roles(Rol.COORDINADOR) @Post('solicitudes-nota/:id/rechazar') @HttpCode(200) rechazar(@Param('id', ParseIntPipe) id: number, @Body() d: ResolverDto, @Usuario() u: UsuarioActual) { return this.s.resolver(id, false, d.comentario, u); }
}
