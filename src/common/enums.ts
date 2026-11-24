export enum Rol {
  ADMIN = 'ADMIN',
  COORDINADOR = 'COORDINADOR',
  DOCENTE = 'DOCENTE',
  ESTUDIANTE = 'ESTUDIANTE',
}

export enum EstadoMicrocurriculo {
  BORRADOR = 'BORRADOR',
  PUBLICADO = 'PUBLICADO',
}

export enum EstadoAsistencia {
  ABIERTA = 'ABIERTA',
  CERRADA = 'CERRADA',
}

export enum EstadoAsistente {
  PRESENTE = 'PRESENTE',
  TARDE = 'TARDE',
  AUSENTE = 'AUSENTE',
  EXCUSADO = 'EXCUSADO',
}

export enum OrigenRegistro {
  SENSOR = 'SENSOR',
  MANUAL = 'MANUAL',
  QR = 'QR',
  SISTEMA = 'SISTEMA',
}

export enum EstadoLectura {
  PROCESADA = 'PROCESADA',
  DUPLICADA = 'DUPLICADA',
  RECHAZADA = 'RECHAZADA',
  PENDIENTE = 'PENDIENTE',
}

export enum EstadoSolicitud {
  PENDIENTE = 'PENDIENTE',
  APROBADA = 'APROBADA',
  RECHAZADA = 'RECHAZADA',
}

export enum TipoAlerta {
  INASISTENCIA = 'INASISTENCIA',
  NOTA_BAJA = 'NOTA_BAJA',
  SENSOR = 'SENSOR',
  SEGURIDAD = 'SEGURIDAD',
}
