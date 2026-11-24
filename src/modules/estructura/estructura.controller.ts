import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { Roles, Usuario } from '../../common/decorators';
import { UsuarioActual } from '../../common/auth.types';
import { Rol } from '../../common/enums';
import { EstructuraService } from './estructura.service';
import {
  AulaDto, AulaUpdateDto, FacultadDto, FacultadUpdateDto, MateriaDto, MateriaUpdateDto,
  PeriodoDto, PeriodoUpdateDto, ProgramaDto, ProgramaUpdateDto, SedeDto, SedeUpdateDto,
} from './estructura.dto';

const opt = (v?: string) => (v ? Number(v) : undefined);

@Controller()
export class EstructuraController {
  constructor(private s: EstructuraService) {}

  @Get('facultades') facultades() { return this.s.listarFacultades(); }
  @Roles(Rol.ADMIN) @Post('facultades') crearFacultad(@Body() d: FacultadDto, @Usuario() u: UsuarioActual) { return this.s.crearFacultad(d, u.sub); }
  @Roles(Rol.ADMIN) @Patch('facultades/:id') editarFacultad(@Param('id', ParseIntPipe) id: number, @Body() d: FacultadUpdateDto, @Usuario() u: UsuarioActual) { return this.s.editarFacultad(id, d, u.sub); }

  @Get('programas') programas(@Query('facultadId') f?: string) { return this.s.listarProgramas(opt(f)); }
  @Roles(Rol.ADMIN) @Post('programas') crearPrograma(@Body() d: ProgramaDto, @Usuario() u: UsuarioActual) { return this.s.crearPrograma(d, u.sub); }
  @Roles(Rol.ADMIN) @Patch('programas/:id') editarPrograma(@Param('id', ParseIntPipe) id: number, @Body() d: ProgramaUpdateDto, @Usuario() u: UsuarioActual) { return this.s.editarPrograma(id, d, u.sub); }

  @Get('materias') materias(@Query('activas') a?: string) { return this.s.listarMaterias(a === 'true'); }
  @Roles(Rol.ADMIN) @Post('materias') crearMateria(@Body() d: MateriaDto, @Usuario() u: UsuarioActual) { return this.s.crearMateria(d, u.sub); }
  @Roles(Rol.ADMIN) @Patch('materias/:id') editarMateria(@Param('id', ParseIntPipe) id: number, @Body() d: MateriaUpdateDto, @Usuario() u: UsuarioActual) { return this.s.editarMateria(id, d, u.sub); }
  @Roles(Rol.ADMIN) @Delete('materias/:id') eliminarMateria(@Param('id', ParseIntPipe) id: number, @Usuario() u: UsuarioActual) { return this.s.eliminarMateria(id, u.sub); }

  @Get('sedes') sedes() { return this.s.listarSedes(); }
  @Roles(Rol.ADMIN) @Post('sedes') crearSede(@Body() d: SedeDto, @Usuario() u: UsuarioActual) { return this.s.crearSede(d, u.sub); }
  @Roles(Rol.ADMIN) @Patch('sedes/:id') editarSede(@Param('id', ParseIntPipe) id: number, @Body() d: SedeUpdateDto, @Usuario() u: UsuarioActual) { return this.s.editarSede(id, d, u.sub); }

  @Get('aulas') aulas(@Query('sedeId') s?: string) { return this.s.listarAulas(opt(s)); }
  @Roles(Rol.ADMIN) @Post('aulas') crearAula(@Body() d: AulaDto, @Usuario() u: UsuarioActual) { return this.s.crearAula(d, u.sub); }
  @Roles(Rol.ADMIN) @Patch('aulas/:id') editarAula(@Param('id', ParseIntPipe) id: number, @Body() d: AulaUpdateDto, @Usuario() u: UsuarioActual) { return this.s.editarAula(id, d, u.sub); }

  @Get('periodos') periodos() { return this.s.listarPeriodos(); }
  @Get('periodos/actual') actual() { return this.s.periodoActual(); }
  @Roles(Rol.ADMIN) @Post('periodos') crearPeriodo(@Body() d: PeriodoDto, @Usuario() u: UsuarioActual) { return this.s.guardarPeriodo(null, d, u.sub); }
  @Roles(Rol.ADMIN) @Patch('periodos/:id') editarPeriodo(@Param('id', ParseIntPipe) id: number, @Body() d: PeriodoUpdateDto, @Usuario() u: UsuarioActual) { return this.s.guardarPeriodo(id, d, u.sub); }
}
