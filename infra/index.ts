// genius-service-infra/index.ts
import * as pulumi from "@pulumi/pulumi";
import { StackReference } from "@pulumi/pulumi";
import { createLambdaFunction } from "./components/lambda";
import { createServiceDnsRecord } from "./components/route53";

const config = new pulumi.Config();
const projectName = config.require("projectName");
const environment = config.require("environment");
const serviceName = config.require("serviceName");

const baseStackRef = new StackReference(config.require("baseStack"));
const vpcId = baseStackRef.getOutput("vpcId");
const privateSubnetIds = baseStackRef.getOutput("privateSubnetIds");
const lambdaSecurityGroupId = baseStackRef.getOutput("lambdaBaseSecurityGroupId");
const sharedAlbListener = baseStackRef.getOutput("sharedAlbListenerArn")
const domainName = baseStackRef.getOutput("domainName");
const loadBalancerDnsName = baseStackRef.getOutput("sharedAlbDnsName");
const zoneId = baseStackRef.getOutput("publicZoneId");


const dnsRecord = createServiceDnsRecord({
  projectName,
  environment,
  serviceName,
  zoneId,
  domainName,
  loadBalancerDnsName,
});

const lambdaService = createLambdaFunction({
  projectName,
  environment,
  serviceName,
  vpcId,
  privateSubnetIds,
  apiEndpoint: dnsRecord.apiEndpoint,
  lambdaMemorySize: config.getNumber("lambdaMemorySize") || 512,
  lambdaTimeout: config.getNumber("lambdaTimeout") || 900,
  lambdaSecurityGroupId,
  sharedAlbListener,
  dockerfilePath: "../Dockerfile",
  environmentVariables: {
    NODE_ENV: "production",
    SENTRY_DSN: pulumi.interpolate`${config.requireSecret("sentryDsn")}`
  },
});

// Export the API endpoint
export const apiEndpoint = dnsRecord.apiEndpoint
