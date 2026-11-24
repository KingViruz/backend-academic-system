import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Auditoria } from '../../database/entities';
import { AcademicoModule } from '../academico/academico.module';
import { AsistenciaModule } from '../asistencia/asistencia.module';
import { MicrocurriculoModule } from '../microcurriculo/microcurriculo.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([Auditoria]), MicrocurriculoModule, AsistenciaModule, AcademicoModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
