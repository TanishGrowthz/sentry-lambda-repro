// genius-service-infra/index.ts
import * as pulumi from "@pulumi/pulumi";
import { createLambdaFunction } from "./components/lambda";

const config = new pulumi.Config();
const projectName = config.require("projectName");
const environment = config.require("environment");
const serviceName = config.require("serviceName");

const lambdaService = createLambdaFunction({
  projectName,
  environment,
  serviceName,
  lambdaMemorySize: config.getNumber("lambdaMemorySize") || 512,
  lambdaTimeout: config.getNumber("lambdaTimeout") || 900,
  buildContext: "../",
  dockerfilePath: "../Dockerfile",
  environmentVariables: {
    NODE_ENV: "production",
    SENTRY_DSN: pulumi.interpolate`${config.requireSecret("sentryDsn")}`
  },
});

// Export the API endpoint
export const apiEndpoint = lambdaService.functionUrl;
export const apiARN = lambdaService.functionArn;
