import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import pretty from 'pino-pretty';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        autoLogging: false,
        redact: [
          'req.headers.authorization',
          '*.cookie.access_token',
          '*.cookie.refresh_token',
          '*.headers["set-cookie"]',
          '*.password',
        ],
        stream: pretty({
          singleLine: true,
          colorize: process.env.NODE_ENV !== 'production',
          levelFirst: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
          messageFormat: '{context} - {msg}',
          ignore: 'pid,hostname,req,res',
        }),
      },
    }),
  ],
  controllers: [AppController],
})
export class AppModule { }
