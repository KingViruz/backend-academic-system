import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from './common/common.module';
import { JwtAuthGuard, RolesGuard } from './common/guards';
import { opcionesBD } from './database/typeorm.config';
import { AcademicoModule } from './modules/academico/academico.module';
import { AlertasModule } from './modules/alertas/alertas.module';
import { AsistenciaModule } from './modules/asistencia/asistencia.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EstructuraModule } from './modules/estructura/estructura.module';
import { MicrocurriculoModule } from './modules/microcurriculo/microcurriculo.module';
import { NotasModule } from './modules/notas/notas.module';
import { PersonasModule } from './modules/personas/personas.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({ inject: [ConfigService], useFactory: () => opcionesBD(process.env) }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({ secret: c.get('JWT_SECRET') ?? 'dev-secret', signOptions: { expiresIn: (c.get('JWT_EXPIRES') ?? '8h') as never } }),
    }),
    ScheduleModule.forRoot(),
    CommonModule,
    AlertasModule,
    AuthModule,
    EstructuraModule,
    PersonasModule,
    AcademicoModule,
    MicrocurriculoModule,
    AsistenciaModule,
    NotasModule,
    DashboardModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
