import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { Roles, Usuario } from '../../common/decorators';
import { UsuarioActual } from '../../common/auth.types';
import { Rol } from '../../common/enums';
import { MicrocurriculoService } from './microcurriculo.service';
import { DetallePlanDto, DetallePlanUpdateDto, EjecutarDto, MicrocurriculoDto, MicrocurriculoUpdateDto, PlanDto, PrerrequisitosDto, UnidadDto, UnidadUpdateDto } from './microcurriculo.dto';

const C = [Rol.COORDINADOR, Rol.ADMIN] as const;

@Controller()
export class MicrocurriculoController {
  constructor(private s: MicrocurriculoService) {}

  @Roles(...C) @Get('microcurriculos') listar(@Usuario() u: UsuarioActual, @Query('programaId') p?: string) { return this.s.listar(u, p ? Number(p) : undefined); }
  @Get('microcurriculos/carga/:cargaId') deCarga(@Param('cargaId', ParseIntPipe) id: number) { return this.s.deCarga(id); }
  @Roles(...C) @Get('microcurriculos/:id') obtener(@Param('id', ParseIntPipe) id: number, @Usuario() u: UsuarioActual) { return this.s.obtener(id, u); }
  @Roles(...C) @Post('microcurriculos') crear(@Body() d: MicrocurriculoDto, @Usuario() u: UsuarioActual) { return this.s.crear(d, u); }
  @Roles(...C) @Patch('microcurriculos/:id') editar(@Param('id', ParseIntPipe) id: number, @Body() d: MicrocurriculoUpdateDto, @Usuario() u: UsuarioActual) { return this.s.editar(id, d, u); }
  @Roles(...C) @Post('microcurriculos/:id/publicar') publicar(@Param('id', ParseIntPipe) id: number, @Usuario() u: UsuarioActual) { return this.s.publicar(id, u); }
  @Roles(...C) @Put('microcurriculos/:id/prerrequisitos') prerreq(@Param('id', ParseIntPipe) id: number, @Body() d: PrerrequisitosDto, @Usuario() u: UsuarioActual) { return this.s.definirPrerrequisitos(id, d.materiaIds, u); }
  @Roles(...C) @Post('microcurriculos/:id/unidades') unidad(@Param('id', ParseIntPipe) id: number, @Body() d: UnidadDto, @Usuario() u: UsuarioActual) { return this.s.agregarUnidad(id, d, u); }
  @Roles(...C) @Patch('unidades/:id') editarUnidad(@Param('id', ParseIntPipe) id: number, @Body() d: UnidadUpdateDto, @Usuario() u: UsuarioActual) { return this.s.editarUnidad(id, d, u); }
  @Roles(...C) @Delete('unidades/:id') eliminarUnidad(@Param('id', ParseIntPipe) id: number, @Usuario() u: UsuarioActual) { return this.s.eliminarUnidad(id, u); }

  @Roles(Rol.COORDINADOR, Rol.ADMIN, Rol.DOCENTE) @Get('planes/seguimiento') seguimiento(@Usuario() u: UsuarioActual, @Query('periodoId') p?: string) { return this.s.seguimiento(u, p ? Number(p) : undefined); }
  @Get('planes/carga/:cargaId') planDeCarga(@Param('cargaId', ParseIntPipe) id: number, @Usuario() u: UsuarioActual) { return this.s.planDeCarga(id, u); }
  @Get('planes/:id') plan(@Param('id', ParseIntPipe) id: number, @Usuario() u: UsuarioActual) { return this.s.obtenerPlan(id, u); }
  @Roles(...C) @Post('planes') crearPlan(@Body() d: PlanDto, @Usuario() u: UsuarioActual) { return this.s.crearPlan(d, u); }
  @Roles(...C) @Post('planes/:id/detalle') detalle(@Param('id', ParseIntPipe) id: number, @Body() d: DetallePlanDto, @Usuario() u: UsuarioActual) { return this.s.agregarDetalle(id, d, u); }
  @Roles(...C) @Patch('planes/detalle/:id') editarDetalle(@Param('id', ParseIntPipe) id: number, @Body() d: DetallePlanUpdateDto, @Usuario() u: UsuarioActual) { return this.s.editarDetalle(id, d, u); }
  @Roles(...C) @Delete('planes/detalle/:id') eliminarDetalle(@Param('id', ParseIntPipe) id: number, @Usuario() u: UsuarioActual) { return this.s.eliminarDetalle(id, u); }
  @Roles(Rol.DOCENTE) @Post('planes/detalle/:id/ejecutar') ejecutar(@Param('id', ParseIntPipe) id: number, @Body() d: EjecutarDto, @Usuario() u: UsuarioActual) { return this.s.ejecutar(id, d, u); }
}
