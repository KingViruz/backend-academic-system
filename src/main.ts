import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','), credentials: true });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    // Devuelve el primer mensaje de cada campo, en español, para mostrarlo tal cual en el formulario.
    exceptionFactory: (errors) => {
      const plano = (es: typeof errors, prefijo = ''): { campo: string; mensaje: string }[] =>
        es.flatMap((e) => [
          ...Object.values(e.constraints ?? {}).slice(0, 1).map((m) => ({ campo: prefijo + e.property, mensaje: m })),
          ...plano(e.children ?? [], `${prefijo}${e.property}.`),
        ]);
      const lista = plano(errors);
      return new BadRequestException({ message: lista[0]?.mensaje ?? 'Datos inválidos', errores: lista });
    },
  }));
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  Logger.log(`API lista en http://localhost:${port}/api`, 'Sistema Académico');
}
bootstrap();
