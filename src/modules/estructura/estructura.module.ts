import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Aula, CargaAcademica, Facultad, Materia, Periodo, Programa, Sede } from '../../database/entities';
import { EstructuraController } from './estructura.controller';
import { EstructuraService } from './estructura.service';

@Module({
  imports: [TypeOrmModule.forFeature([Facultad, Programa, Materia, Sede, Aula, Periodo, CargaAcademica])],
  controllers: [EstructuraController],
  providers: [EstructuraService],
  exports: [EstructuraService],
})
export class EstructuraModule {}
