import { Body, Controller, Get, Header, Param, ParseIntPipe, Patch, Post, Put, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles, Usuario } from '../../common/decorators';
import { UsuarioActual } from '../../common/auth.types';
import { Rol } from '../../common/enums';
import { regla } from '../../common/utils';
import { PersonasService } from './personas.service';
import {
  AdminCrearDto, CoordinadorDto, CoordinadorUpdateDto, DocenteDto, DocenteUpdateDto, EstudianteDto, EstudianteUpdateDto,
  MateriasDocenteDto, UsuarioUpdateDto,
} from './personas.dto';

@Controller()
export class PersonasController {
  constructor(private s: PersonasService) {}

  // Usuarios (administración)
  @Roles(Rol.ADMIN) @Get('usuarios') usuarios(@Query('rol') rol?: Rol, @Query('q') q?: string) { return this.s.listarUsuarios(rol, q); }
  @Roles(Rol.ADMIN) @Post('usuarios') crearAdmin(@Body() d: AdminCrearDto, @Usuario() u: UsuarioActual) { return this.s.crearAdmin(d, u); }
  @Roles(Rol.ADMIN) @Patch('usuarios/:id') editarUsuario(@Param('id', ParseIntPipe) id: number, @Body() d: UsuarioUpdateDto, @Usuario() u: UsuarioActual) { return this.s.actualizarUsuario(id, d, u); }
  @Roles(Rol.ADMIN) @Post('usuarios/:id/desbloquear') desbloquear(@Param('id', ParseIntPipe) id: number, @Usuario() u: UsuarioActual) { return this.s.desbloquear(id, u); }
  @Roles(Rol.ADMIN) @Post('usuarios/:id/restablecer-password') restablecer(@Param('id', ParseIntPipe) id: number, @Usuario() u: UsuarioActual) { return this.s.restablecerPassword(id, u); }

  // Coordinadores
  @Roles(Rol.ADMIN) @Get('coordinadores') coordinadores() { return this.s.listarCoordinadores(); }
  @Roles(Rol.ADMIN) @Post('coordinadores') crearCoord(@Body() d: CoordinadorDto, @Usuario() u: UsuarioActual) { return this.s.crearCoordinador(d, u); }
  @Roles(Rol.ADMIN) @Patch('coordinadores/:id') editarCoord(@Param('id', ParseIntPipe) id: number, @Body() d: CoordinadorUpdateDto, @Usuario() u: UsuarioActual) { return this.s.editarCoordinador(id, d, u); }

  // Docentes
  @Roles(Rol.ADMIN, Rol.COORDINADOR) @Get('docentes') docentes(@Query('materiaId') m?: string) { return this.s.listarDocentes(m ? Number(m) : undefined); }
  @Roles(Rol.ADMIN) @Post('docentes') crearDocente(@Body() d: DocenteDto, @Usuario() u: UsuarioActual) { return this.s.crearDocente(d, u); }
  @Roles(Rol.ADMIN) @Patch('docentes/:id') editarDocente(@Param('id', ParseIntPipe) id: number, @Body() d: DocenteUpdateDto, @Usuario() u: UsuarioActual) { return this.s.editarDocente(id, d, u); }
  @Roles(Rol.ADMIN) @Put('docentes/:id/materias') materias(@Param('id', ParseIntPipe) id: number, @Body() d: MateriasDocenteDto, @Usuario() u: UsuarioActual) { return this.s.asignarMaterias(id, d.materiaIds, u); }

  // Estudiantes
  @Roles(Rol.ADMIN, Rol.COORDINADOR, Rol.DOCENTE) @Get('estudiantes')
  estudiantes(@Usuario() u: UsuarioActual, @Query('programaId') p?: string, @Query('q') q?: string) {
    return this.s.listarEstudiantes(u, { programaId: p ? Number(p) : undefined, q });
  }
  @Roles(Rol.ADMIN) @Get('estudiantes/plantilla') @Header('Content-Type', 'text/csv; charset=utf-8') @Header('Content-Disposition', 'attachment; filename="plantilla_estudiantes.csv"')
  plantilla() { return '﻿' + this.s.plantillaCsv(); }
  @Get('estudiantes/:id') estudiante(@Param('id', ParseIntPipe) id: number, @Usuario() u: UsuarioActual) { return this.s.obtenerEstudiante(id, u); }
  @Roles(Rol.ADMIN) @Post('estudiantes') crearEst(@Body() d: EstudianteDto, @Usuario() u: UsuarioActual) { return this.s.crearEstudiante(d, u); }
  @Roles(Rol.ADMIN) @Patch('estudiantes/:id') editarEst(@Param('id', ParseIntPipe) id: number, @Body() d: EstudianteUpdateDto, @Usuario() u: UsuarioActual) { return this.s.editarEstudiante(id, d, u); }

  @Roles(Rol.ADMIN) @Post('estudiantes/carga-masiva') @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: 5 * 1024 * 1024 } }))
  cargaMasiva(@UploadedFile() archivo: Express.Multer.File, @Usuario() u: UsuarioActual) {
    regla(!!archivo, 'Adjunta el archivo CSV en el campo "archivo"');
    return this.s.cargaMasiva(archivo.buffer.toString('utf8'), u);
  }
}
