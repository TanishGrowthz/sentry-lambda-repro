import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import fastifyHelmet from '@fastify/helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';
import { LoggingHook } from './config/logger.hook';
import { Logger } from 'nestjs-pino';

export async function bootstrapApp() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ disableRequestLogging: true }),
    { bufferLogs: true },
  );

  const fastify = app.getHttpAdapter().getInstance();

  const logger = app.get(Logger);
  app.useLogger(logger);
  app.flushLogs();

  // Set up custom logging hooks
  const loggingHook = new LoggingHook(logger);
  loggingHook.setupLogging(fastify);

  // Register helmet with Swagger compatibility
  // @ts-ignore
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: [`'self'`],
        styleSrc: [`'self'`, `'unsafe-inline'`, 'cdn.jsdelivr.net'],
        imgSrc: [`'self'`, 'data:', 'validator.swagger.io'],
        scriptSrc: [`'self'`, `https: 'unsafe-inline'`, 'cdn.jsdelivr.net'],
      },
    },
  });

  // Health check endpoint
  app.getHttpAdapter().get('/health', async (_, res) => {
    try {
      res.status(200).send({ status: 'ok' });
    } catch (error) {
      res.status(500).send({ status: 'error', error: error.message });
    }
  });

  // API versioning and prefix
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Set up Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle('Lambda Instrumentation')
    .setDescription(
      'Test service to demonstrate how to instrument AWS Lambda functions using sentry',
    )
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const swaggerCDN = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.18.2';
  SwaggerModule.setup('api', app, document, {
    customCssUrl: [`${swaggerCDN}/swagger-ui.css`],
    customJs: [
      `${swaggerCDN}/swagger-ui-bundle.js`,
      `${swaggerCDN}/swagger-ui-standalone-preset.js`,
    ],
  });

  app.useGlobalPipes(new ValidationPipe());

  // CORS configuration
  app.enableCors();

  return app;
}
