import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

export interface Route53ServiceArgs {
  projectName: string;
  environment: string;
  serviceName: string;
  zoneId: pulumi.Input<string>;
  domainName: pulumi.Input<string>;
  loadBalancerDnsName: pulumi.Input<string>;
}

export interface Route53ServiceOutputs {
  apiEndpoint: pulumi.Output<string>;
}

export function createServiceDnsRecord(args: Route53ServiceArgs): Route53ServiceOutputs {
  const dnsRecord = new aws.route53.Record(
    `${args.projectName}-${args.environment}-${args.serviceName}-dns`,
    {
      zoneId: args.zoneId,
      name: pulumi.interpolate`${args.serviceName}-${args.environment}.api.${args.domainName}`,
      type: "CNAME",
      ttl: 300,
      records: [args.loadBalancerDnsName],
    }
  );

  return {
    apiEndpoint: pulumi.interpolate`${args.serviceName}-${args.environment}.api.${args.domainName}`
  }
}

