import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asistencia, Aula, CargaAcademica, DetalleAsistencia, Estudiante, HorarioClase, Inscripcion, LecturaSensor, SensorAsistencia } from '../../database/entities';
import { AsistenciaController } from './asistencia.controller';
import { AsistenciaService } from './asistencia.service';

@Module({
  imports: [TypeOrmModule.forFeature([Asistencia, DetalleAsistencia, CargaAcademica, HorarioClase, Inscripcion, Estudiante, SensorAsistencia, LecturaSensor, Aula])],
  controllers: [AsistenciaController],
  providers: [AsistenciaService],
  exports: [AsistenciaService],
})
export class AsistenciaModule {}
