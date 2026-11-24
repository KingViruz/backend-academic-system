import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { UsuarioActual } from '../../common/auth.types';
import { Rol, TipoAlerta } from '../../common/enums';
import { existe, hhmm, num } from '../../common/utils';
import { Alerta, HorarioClase, SensorAsistencia } from '../../database/entities';

export interface NuevaAlerta { tipo: TipoAlerta; clave: string; mensaje: string; programaId?: number | null; estudianteId?: number | null; cargaId?: number | null }

@Injectable()
export class AlertasService {
  private log = new Logger('Alertas');
  constructor(
    @InjectRepository(Alerta) private alertas: Repository<Alerta>,
    @InjectRepository(SensorAsistencia) private sensores: Repository<SensorAsistencia>,
    @InjectRepository(HorarioClase) private horarios: Repository<HorarioClase>,
    private config: ConfigService,
  ) {}

  /** La clave única hace que la misma condición genere una sola alerta. */
  async crear(a: NuevaAlerta, em?: EntityManager) {
    const repo = em ? em.getRepository(Alerta) : this.alertas;
    await repo.createQueryBuilder().insert().into(Alerta).values({
      tipo: a.tipo, clave: a.clave.slice(0, 120), mensaje: a.mensaje.slice(0, 300),
      programaId: a.programaId ?? null, estudianteId: a.estudianteId ?? null, cargaId: a.cargaId ?? null,
    }).orIgnore().updateEntity(false).execute();
  }

  listar(actor: UsuarioActual, f: { atendida?: boolean; tipo?: TipoAlerta }) {
    const qb = this.alertas.createQueryBuilder('a').orderBy('a.createdAt', 'DESC').take(300);
    if (actor.rol === Rol.COORDINADOR) qb.andWhere('(a.programaId = :p OR a.programaId IS NULL)', { p: actor.programaId });
    if (f.atendida !== undefined) qb.andWhere('a.atendida = :at', { at: f.atendida });
    if (f.tipo) qb.andWhere('a.tipo = :t', { t: f.tipo });
    return qb.getMany();
  }

  async atender(id: number, actor: UsuarioActual) {
    const a = existe(await this.alertas.findOneBy({ id }), 'Alerta no encontrada');
    if (actor.rol === Rol.COORDINADOR && a.programaId && a.programaId !== actor.programaId) throw new ForbiddenException('La alerta no es de tu programa');
    await this.alertas.update(id, { atendida: true, atendidaPorId: actor.sub });
    return { ok: true };
  }

  /**
   * A01: sensor sin señal durante una franja de clase. Revisa cada minuto los sensores cuyas aulas
   * tienen clase en este momento y no reportan hace más de SENSOR_SIN_SENAL_MIN minutos.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async revisarSensores() {
    try {
      const limite = num(this.config.get('SENSOR_SIN_SENAL_MIN'), 10);
      const ahora = new Date();
      const dia = ahora.getDay(); // 0 = domingo
      if (dia === 0) return;
      const hora = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
      const enClase = await this.horarios.createQueryBuilder('h').innerJoinAndSelect('h.carga', 'c').innerJoin('c.periodo', 'p')
        .innerJoinAndSelect('h.aula', 'a').where('p.actual = true AND h.dia = :dia AND h.horaInicio <= :hora AND h.horaFin > :hora', { dia, hora }).getMany();
      if (!enClase.length) return;
      const sensores = await this.sensores.find({ where: { activo: true }, relations: { aula: true } });
      for (const h of enClase) {
        for (const s of sensores.filter((x) => x.aulaId === h.aulaId)) {
          const sinSenal = !s.ultimaSenal || ahora.getTime() - s.ultimaSenal.getTime() > limite * 60000;
          if (!sinSenal) continue;
          await this.crear({
            tipo: TipoAlerta.SENSOR, programaId: h.carga.programaId, cargaId: h.cargaId,
            clave: `SENSOR-${s.id}-${ahora.toISOString().slice(0, 10)}-${h.id}`,
            mensaje: `El sensor ${s.codigo} del aula ${s.aula.codigo} no reporta hace más de ${limite} min durante la clase de las ${hhmm(h.horaInicio)}. Usa el registro manual o por QR.`,
          });
        }
      }
    } catch (e) {
      this.log.warn(`No se pudo revisar sensores: ${(e as Error).message}`);
    }
  }
}
