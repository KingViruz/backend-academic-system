import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alerta, HorarioClase, SensorAsistencia } from '../../database/entities';
import { AlertasController } from './alertas.controller';
import { AlertasService } from './alertas.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Alerta, SensorAsistencia, HorarioClase])],
  controllers: [AlertasController],
  providers: [AlertasService],
  exports: [AlertasService],
})
export class AlertasModule {}
