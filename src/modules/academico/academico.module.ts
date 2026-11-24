import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Aula, Calificacion, CargaAcademica, Docente, Estudiante, HorarioClase, Inscripcion, Materia, Microcurriculo, Periodo, Programa } from '../../database/entities';
import { AcademicoController } from './academico.controller';
import { CargaService } from './carga.service';
import { HorariosService } from './horarios.service';
import { InscripcionesService } from './inscripciones.service';

@Module({
  imports: [TypeOrmModule.forFeature([CargaAcademica, HorarioClase, Inscripcion, Docente, Aula, Materia, Programa, Periodo, Estudiante, Microcurriculo, Calificacion])],
  controllers: [AcademicoController],
  providers: [CargaService, HorariosService, InscripcionesService],
  exports: [CargaService, HorariosService, InscripcionesService],
})
export class AcademicoModule {}
