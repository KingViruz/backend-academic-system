import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Calificacion, CargaAcademica, DetallePlanMicrocurriculo, Inscripcion, Materia, Microcurriculo, PlanMicrocurriculo, UnidadTematica } from '../../database/entities';
import { MicrocurriculoController } from './microcurriculo.controller';
import { MicrocurriculoService } from './microcurriculo.service';

@Module({
  imports: [TypeOrmModule.forFeature([Microcurriculo, UnidadTematica, PlanMicrocurriculo, DetallePlanMicrocurriculo, CargaAcademica, Materia, Inscripcion, Calificacion])],
  controllers: [MicrocurriculoController],
  providers: [MicrocurriculoService],
  exports: [MicrocurriculoService],
})
export class MicrocurriculoModule {}
