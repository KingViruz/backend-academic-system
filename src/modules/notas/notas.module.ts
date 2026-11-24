import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Calificacion, CargaAcademica, Inscripcion, Microcurriculo, SolicitudCambioNota } from '../../database/entities';
import { NotasController } from './notas.controller';
import { NotasService } from './notas.service';

@Module({
  imports: [TypeOrmModule.forFeature([Calificacion, Inscripcion, CargaAcademica, Microcurriculo, SolicitudCambioNota])],
  controllers: [NotasController],
  providers: [NotasService],
})
export class NotasModule {}
