import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Coordinador, Docente, Estudiante, Usuario } from '../../database/entities';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario, Docente, Estudiante, Coordinador])],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
