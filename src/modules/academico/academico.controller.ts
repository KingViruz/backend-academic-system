import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { Roles, Usuario } from '../../common/decorators';
import { UsuarioActual } from '../../common/auth.types';
import { Rol } from '../../common/enums';
import { CargaDto, CargaUpdateDto, InscribirDto, ValidarCargaDto } from './academico.dto';
import { CargaService } from './carga.service';
import { HorariosService } from './horarios.service';
import { InscripcionesService } from './inscripciones.service';

const opt = (v?: string) => (v ? Number(v) : undefined);

@Controller()
export class AcademicoController {
  constructor(private carga: CargaService, private horarios: HorariosService, private ins: InscripcionesService) {}

  // Carga académica
  @Roles(Rol.ADMIN, Rol.COORDINADOR) @Get('carga')
  listar(@Usuario() u: UsuarioActual, @Query('periodoId') p?: string, @Query('programaId') pr?: string) { return this.carga.listar(u, { periodoId: opt(p), programaId: opt(pr) }); }
  @Roles(Rol.DOCENTE) @Get('carga/mios') mios(@Usuario() u: UsuarioActual, @Query('periodoId') p?: string) { return this.carga.misGrupos(u, opt(p)); }
  @Roles(Rol.ADMIN, Rol.COORDINADOR, Rol.DOCENTE) @Get('carga/:id') obtener(@Param('id', ParseIntPipe) id: number, @Usuario() u: UsuarioActual) { return this.carga.obtener(id, u); }
  @Roles(Rol.COORDINADOR, Rol.ADMIN) @Post('carga/validar') validar(@Body() d: ValidarCargaDto, @Usuario() u: UsuarioActual) { return this.carga.validar(d, u); }
  @Roles(Rol.COORDINADOR, Rol.ADMIN) @Post('carga') crear(@Body() d: CargaDto, @Usuario() u: UsuarioActual) { return this.carga.crear(d, u); }
  @Roles(Rol.COORDINADOR, Rol.ADMIN) @Patch('carga/:id') editar(@Param('id', ParseIntPipe) id: number, @Body() d: CargaUpdateDto, @Usuario() u: UsuarioActual) { return this.carga.editar(id, d, u); }
  @Roles(Rol.COORDINADOR, Rol.ADMIN) @Delete('carga/:id') eliminar(@Param('id', ParseIntPipe) id: number, @Usuario() u: UsuarioActual) { return this.carga.eliminar(id, u); }

  // Horarios
  @Roles(Rol.DOCENTE, Rol.ESTUDIANTE) @Get('horarios/mio') mio(@Usuario() u: UsuarioActual, @Query('periodoId') p?: string) { return this.horarios.mio(u, opt(p)); }
  @Roles(Rol.ADMIN, Rol.COORDINADOR) @Get('horarios/docente/:id') docente(@Param('id', ParseIntPipe) id: number, @Query('periodoId') p?: string) { return this.horarios.deDocente(id, opt(p)); }
  @Roles(Rol.ADMIN, Rol.COORDINADOR) @Get('horarios/estudiante/:id') estudiante(@Param('id', ParseIntPipe) id: number, @Usuario() u: UsuarioActual, @Query('periodoId') p?: string) { return this.horarios.consultarEstudiante(u, id, opt(p)); }
  @Roles(Rol.ADMIN, Rol.COORDINADOR) @Get('horarios/aula/:id') aula(@Param('id', ParseIntPipe) id: number, @Query('periodoId') p?: string) { return this.horarios.deAula(id, opt(p)); }

  // Inscripciones
  @Roles(Rol.ESTUDIANTE) @Get('inscripciones/oferta') oferta(@Usuario() u: UsuarioActual) { return this.ins.oferta(u); }
  @Roles(Rol.ESTUDIANTE) @Get('inscripciones/mias') mias(@Usuario() u: UsuarioActual) { return this.ins.mias(u); }
  @Roles(Rol.ESTUDIANTE) @Post('inscripciones') inscribir(@Body() d: InscribirDto, @Usuario() u: UsuarioActual) { return this.ins.inscribir(u, d.cargaId); }
  @Roles(Rol.ESTUDIANTE) @Delete('inscripciones/:id') retirar(@Param('id', ParseIntPipe) id: number, @Usuario() u: UsuarioActual) { return this.ins.retirar(u, id); }
}
