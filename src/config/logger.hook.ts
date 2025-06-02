import { Injectable, OnModuleInit } from '@nestjs/common';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Logger } from 'nestjs-pino';

@Injectable()
export class LoggingHook implements OnModuleInit {
  constructor(private readonly logger: Logger) {}

  onModuleInit() {
    this.logger.log('LoggingHook initialized', 'System');
  }

  setupLogging(fastify: FastifyInstance) {
    fastify.addHook(
      'preHandler',
      (request: FastifyRequest, _reply: FastifyReply, done) => {
        request['startTime'] = process.hrtime();

        // Parse cookies into an object so we can use them pino redact
        const cookies: Record<string, string> = {};
        if (request.headers.cookie) {
          request.headers.cookie.split('; ').forEach((cookie) => {
            const [key, value] = cookie.split('=');
            cookies[key.trim()] = value;
          });
        }

        const logData = {
          type: 'Request',
          method: request.method,
          url: request.url,
          headers: {
            ...request.headers,
            cookie: cookies,
          },
          query: request.query,
          body:
            request.body && Object.keys(request.body).length
              ? request.body
              : undefined,
        };
        if (logData.url !== '/health') {
          this.logger.log(logData.url);
          this.logger.log(logData, 'HTTP');
        }
        done();
      },
    );

    fastify.addHook(
      'onSend',
      (request: FastifyRequest, reply: FastifyReply, payload, done) => {
        const startTime = request['startTime'] || process.hrtime();
        const duration = process.hrtime(startTime);
        const durationMs = duration[0] * 1000 + duration[1] / 1_000_000;

        let parsedBody: unknown;
        try {
          parsedBody = JSON.parse(payload as string);
        } catch {
          parsedBody = undefined; // we don't wanna log anything that is not json
        }

        const logData = {
          type: 'Response',
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          duration: `${durationMs.toFixed(2)}ms`,
          headers: reply.getHeaders(),
          body: parsedBody,
        };

        if (logData.url !== '/health') {
          this.logger.log(logData.url);
          this.logger.log(logData, 'HTTP');
        }
        done();
      },
    );
  }
}
