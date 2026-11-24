import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Auditoria } from '../database/entities';

export interface RegistroAuditoria {
  usuarioId?: number | null;
  accion: string;
  entidad: string;
  entidadId?: string | number | null;
  antes?: unknown;
  despues?: unknown;
  ip?: string | null;
}

@Injectable()
export class AuditoriaService {
  constructor(@InjectRepository(Auditoria) private repo: Repository<Auditoria>) {}

  /** Registra un cambio. Acepta un EntityManager para quedar dentro de la misma transacción. */
  async registrar(r: RegistroAuditoria, em?: EntityManager) {
    const repo = em ? em.getRepository(Auditoria) : this.repo;
    await repo.insert({
      usuarioId: r.usuarioId ?? null,
      accion: r.accion,
      entidad: r.entidad,
      entidadId: r.entidadId == null ? null : String(r.entidadId),
      valorAnterior: (r.antes ?? null) as object,
      valorNuevo: (r.despues ?? null) as object,
      ip: r.ip ?? null,
    });
  }
}
