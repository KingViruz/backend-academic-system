import { Body, Controller, Get, Headers, HttpCode, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { Public, Roles, Usuario } from '../../common/decorators';
import { UsuarioActual } from '../../common/auth.types';
import { Rol } from '../../common/enums';
import { AsistenciaService } from './asistencia.service';
import { AbrirAsistenciaDto, CorregirDto, LecturasDto, ManualDto, QrDto, SensorDto, SensorUpdateDto } from './asistencia.dto';

@Controller()
export class AsistenciaController {
  constructor(private s: AsistenciaService) {}

  @Roles(Rol.DOCENTE) @Post('asistencias') abrir(@Body() d: AbrirAsistenciaDto, @Usuario() u: UsuarioActual) { return this.s.abrir(d, u); }
  @Roles(Rol.DOCENTE) @Get('asistencias/abiertas') abiertas(@Usuario() u: UsuarioActual) { return this.s.abiertasDocente(u); }
  @Roles(Rol.ESTUDIANTE) @Get('asistencias/mias') mias(@Usuario() u: UsuarioActual) { return this.s.mias(u); }
  @Roles(Rol.ESTUDIANTE) @Post('asistencias/qr') @HttpCode(200) marcarQr(@Body() d: QrDto, @Usuario() u: UsuarioActual) { return this.s.marcarQr(d.codigo, u); }
  @Roles(Rol.DOCENTE, Rol.COORDINADOR, Rol.ADMIN) @Get('asistencias/grupo/:cargaId') listar(@Param('cargaId', ParseIntPipe) id: number, @Usuario() u: UsuarioActual) { return this.s.listar(id, u); }
  @Roles(Rol.DOCENTE, Rol.COORDINADOR, Rol.ADMIN) @Get('asistencias/consolidado/:cargaId')
  consolidado(@Param('cargaId', ParseIntPipe) id: number, @Usuario() u: UsuarioActual, @Query('desde') desde?: string, @Query('hasta') hasta?: string) { return this.s.consolidado(id, u, desde, hasta); }
  @Roles(Rol.DOCENTE, Rol.COORDINADOR, Rol.ADMIN) @Get('asistencias/:id') obtener(@Param('id', ParseIntPipe) id: number, @Usuario() u: UsuarioActual) { return this.s.obtener(id, u); }
  @Roles(Rol.DOCENTE) @Get('asistencias/:id/qr') qr(@Param('id', ParseIntPipe) id: number, @Usuario() u: UsuarioActual) { return this.s.qr(id, u); }
  @Roles(Rol.DOCENTE) @Post('asistencias/:id/cerrar') @HttpCode(200) cerrar(@Param('id', ParseIntPipe) id: number, @Usuario() u: UsuarioActual) { return this.s.cerrar(id, u); }
  @Roles(Rol.DOCENTE) @Post('asistencias/:id/manual') @HttpCode(200) manual(@Param('id', ParseIntPipe) id: number, @Body() d: ManualDto, @Usuario() u: UsuarioActual) { return this.s.manual(id, d, u); }
  @Roles(Rol.DOCENTE) @Patch('asistencias/detalle/:id') corregir(@Param('id', ParseIntPipe) id: number, @Body() d: CorregirDto, @Usuario() u: UsuarioActual) { return this.s.corregir(id, d, u); }

  // Dispositivos: se autentican con su código y token, no con JWT.
  @Public() @Post('sensor/heartbeat') @HttpCode(200)
  heartbeat(@Headers('x-sensor-codigo') codigo: string, @Headers('x-sensor-token') token: string) { return this.s.heartbeat(codigo, token); }
  @Public() @Post('sensor/lecturas') @HttpCode(200)
  lecturas(@Headers('x-sensor-codigo') codigo: string, @Headers('x-sensor-token') token: string, @Body() d: LecturasDto) { return this.s.recibirLecturas(codigo, token, d.lecturas); }

  @Roles(Rol.ADMIN) @Get('sensores') sensores() { return this.s.listarSensores(); }
  @Roles(Rol.ADMIN) @Post('sensores') crearSensor(@Body() d: SensorDto, @Usuario() u: UsuarioActual) { return this.s.crearSensor(d, u); }
  @Roles(Rol.ADMIN) @Patch('sensores/:id') editarSensor(@Param('id', ParseIntPipe) id: number, @Body() d: SensorUpdateDto, @Usuario() u: UsuarioActual) { return this.s.editarSensor(id, d, u); }
  @Roles(Rol.ADMIN) @Post('sensores/:id/token') token(@Param('id', ParseIntPipe) id: number, @Usuario() u: UsuarioActual) { return this.s.regenerarToken(id, u); }
  @Roles(Rol.ADMIN) @Get('sensores/:id/lecturas') lecturasSensor(@Param('id', ParseIntPipe) id: number) { return this.s.lecturasSensor(id); }
}
