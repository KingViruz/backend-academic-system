import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { AuditoriaService } from '../../common/auditoria.service';
import { UsuarioActual } from '../../common/auth.types';
import { Rol } from '../../common/enums';
import { num, regla } from '../../common/utils';
import { Coordinador, Docente, Estudiante, Usuario } from '../../database/entities';

const MSG_INVALIDAS = 'Credenciales inválidas';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario) private usuarios: Repository<Usuario>,
    @InjectRepository(Docente) private docentes: Repository<Docente>,
    @InjectRepository(Estudiante) private estudiantes: Repository<Estudiante>,
    @InjectRepository(Coordinador) private coordinadores: Repository<Coordinador>,
    private jwt: JwtService,
    private config: ConfigService,
    private auditoria: AuditoriaService,
  ) {}

  async login(email: string, password: string, ip: string) {
    const maxIntentos = num(this.config.get('LOGIN_MAX_INTENTOS'), 5);
    const bloqueoMin = num(this.config.get('LOGIN_BLOQUEO_MIN'), 15);
    const u = await this.usuarios.createQueryBuilder('u').addSelect('u.passwordHash')
      .where('u.email = :email', { email: email.trim().toLowerCase() }).getOne();

    // Mismo mensaje si el correo no existe: no revela qué cuentas están registradas (CP-01 D).
    if (!u) {
      await this.auditoria.registrar({ accion: 'LOGIN_FALLIDO', entidad: 'usuario', despues: { email }, ip });
      throw new UnauthorizedException(MSG_INVALIDAS);
    }
    if (u.bloqueadoHasta && u.bloqueadoHasta > new Date()) {
      const min = Math.ceil((u.bloqueadoHasta.getTime() - Date.now()) / 60000);
      throw new ForbiddenException(`Cuenta bloqueada por intentos fallidos. Intenta de nuevo en ${min} min`);
    }
    if (!u.activo) throw new ForbiddenException('Tu cuenta está inactiva. Contacta al administrador');

    const ok = await bcrypt.compare(password, u.passwordHash);
    if (!ok) {
      const intentos = u.intentosFallidos + 1;
      const bloquear = intentos >= maxIntentos;
      await this.usuarios.update(u.id, {
        intentosFallidos: bloquear ? 0 : intentos,
        bloqueadoHasta: bloquear ? new Date(Date.now() + bloqueoMin * 60000) : null,
      });
      await this.auditoria.registrar({ usuarioId: u.id, accion: bloquear ? 'CUENTA_BLOQUEADA' : 'LOGIN_FALLIDO', entidad: 'usuario', entidadId: u.id, despues: { intentos }, ip });
      if (bloquear) throw new ForbiddenException(`Cuenta bloqueada por ${bloqueoMin} minutos tras ${maxIntentos} intentos fallidos`);
      throw new UnauthorizedException(MSG_INVALIDAS);
    }

    await this.usuarios.update(u.id, { intentosFallidos: 0, bloqueadoHasta: null, ultimoAcceso: new Date() });
    await this.auditoria.registrar({ usuarioId: u.id, accion: 'LOGIN', entidad: 'usuario', entidadId: u.id, ip });
    const payload = await this.construirPayload(u);
    return { token: await this.jwt.signAsync(payload), usuario: payload };
  }

  /** Incluye en el token los ids del perfil para que cada endpoint filtre sin consultar de nuevo. */
  private async construirPayload(u: Usuario): Promise<UsuarioActual> {
    const p: UsuarioActual = { sub: u.id, rol: u.rol, email: u.email, nombre: `${u.nombres} ${u.apellidos}` };
    if (u.rol === Rol.DOCENTE) {
      const d = await this.docentes.findOne({ where: { usuarioId: u.id } });
      if (d) p.docenteId = d.id;
    } else if (u.rol === Rol.ESTUDIANTE) {
      const e = await this.estudiantes.findOne({ where: { usuarioId: u.id } });
      if (e) { p.estudianteId = e.id; p.programaId = e.programaId; }
    } else if (u.rol === Rol.COORDINADOR) {
      const c = await this.coordinadores.findOne({ where: { usuarioId: u.id } });
      if (c) p.programaId = c.programaId;
    }
    return p;
  }

  async perfil(user: UsuarioActual) {
    const u = await this.usuarios.findOne({ where: { id: user.sub } });
    return { ...user, usuario: u };
  }

  async cambiarPassword(user: UsuarioActual, actual: string, nueva: string) {
    const u = await this.usuarios.createQueryBuilder('u').addSelect('u.passwordHash').where('u.id = :id', { id: user.sub }).getOneOrFail();
    regla(await bcrypt.compare(actual, u.passwordHash), 'La contraseña actual no es correcta');
    await this.usuarios.update(u.id, { passwordHash: await bcrypt.hash(nueva, 10) });
    await this.auditoria.registrar({ usuarioId: u.id, accion: 'CAMBIO_PASSWORD', entidad: 'usuario', entidadId: u.id });
    return { ok: true };
  }
}
