import { Logger } from 'nestjs-pino';
import { bootstrapApp } from './init';
import { AddressInfo } from 'net';

async function bootstrap() {
  const app = await bootstrapApp();
  const logger = app.get(Logger);

  app
    .listen(process.env.PORT ?? 3000, '0.0.0.0')
    .then(() => {
      const address = app
        .getHttpAdapter()
        .getInstance()
        .server.address() as AddressInfo;
      logger.log(`🚀 Server listening on ${address.address}:${address.port}`);
    })
    .catch((err) => {
      console.log(err);
      logger.error('❌ Error starting server:', err);
      process.exit(1);
    });
}

// Start the application
bootstrap();
