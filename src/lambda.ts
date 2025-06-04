import './instrument';
import { LazyFramework } from '@h4ad/serverless-adapter/frameworks/lazy';
import { FastifyFramework } from '@h4ad/serverless-adapter/frameworks/fastify';
import {
  createDefaultLogger,
  ServerlessAdapter,
} from '@h4ad/serverless-adapter';
import type { Handler } from 'aws-lambda';
import * as Sentry from '@sentry/aws-serverless'
import { setupFastifyErrorHandler } from "@sentry/node"
import { DefaultHandler } from '@h4ad/serverless-adapter/handlers/default';
import { AlbAdapter, ApiGatewayV2Adapter } from '@h4ad/serverless-adapter/adapters/aws';
import { PromiseResolver } from '@h4ad/serverless-adapter/resolvers/promise';
import { bootstrapApp } from './init';

async function initApp() {
  const app = await bootstrapApp();

  // we need to wait until it initializes
  await app.init();

  const nestApp = app.getHttpAdapter().getInstance();
  setupFastifyErrorHandler(nestApp);
  return nestApp;
}

const fastifyFramework = new FastifyFramework();
// the initialization of nestjs is asynchronous, so you can use the lazy framework.
const framework = new LazyFramework(fastifyFramework, initApp);

export const handler: Handler = Sentry.wrapHandler(
  ServerlessAdapter.new(null)
    .setFramework(framework)
    .setLogger(createDefaultLogger())
    .setHandler(new DefaultHandler())
    .setResolver(new PromiseResolver())
    .setRespondWithErrors(true)
    .addAdapter(new ApiGatewayV2Adapter())
    .build(),
  {
    startTrace: true,
    captureAllSettledReasons: true,
    captureTimeoutWarning: true,
    flushTimeout: 10000
  }
);
