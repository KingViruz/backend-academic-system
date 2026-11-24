import { DataSourceOptions } from 'typeorm';
import { ENTITIES } from './entities';
import { SnakeNamingStrategy } from './naming.strategy';

export function opcionesBD(env: NodeJS.ProcessEnv = process.env): DataSourceOptions {
  return {
    type: 'mysql',
    host: env.DB_HOST ?? 'localhost',
    port: Number(env.DB_PORT ?? 3306),
    username: env.DB_USER ?? 'root',
    password: env.DB_PASSWORD ?? '',
    database: env.DB_NAME ?? 'academic_system',
    entities: ENTITIES,
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: env.DB_SYNC === 'true',
    charset: 'utf8mb4_unicode_ci',
    timezone: 'Z',
    dateStrings: ['DATE'],
    logging: env.DB_LOG === 'true' ? ['query', 'error'] : ['error'],
  };
}
