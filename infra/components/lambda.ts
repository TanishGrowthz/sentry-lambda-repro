import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as awsx from '@pulumi/awsx'
import * as path from "path";

export interface LambdaArgs {
  projectName: string;
  environment: string;
  serviceName: string;
  vpcId: pulumi.Input<string>;
  privateSubnetIds: pulumi.Input<string[]>;
  lambdaMemorySize: number;
  lambdaTimeout: number;
  environmentVariables: Record<string, pulumi.Input<string>>;
  lambdaSecurityGroupId: pulumi.Input<string>;
  s3BucketArn?: pulumi.Input<string>;
  sharedAlbListener: pulumi.Input<string>;
  apiEndpoint: pulumi.Input<string>;
  sqsQueueArns?: pulumi.Input<string[]>;
  lambdaLayerArns?: pulumi.Input<pulumi.Input<string>[]>;
  // New optional parameters for SQS event source configuration
  sqsEventSourceBatchSize?: number;
  sqsEventSourceBatchWindow?: number;
  dockerfilePath: string;
  buildContext?: string;
}

export interface LambdaOutputs {
  roleName: pulumi.Output<string>;
  functionArn: pulumi.Output<string>;
  eventSourceMappingIds?: pulumi.Output<string[]>;
}

export function createLambdaFunction(args: LambdaArgs): LambdaOutputs {

  // Create ECR Repository
  const repoName = `${args.projectName}-${args.environment}-${args.serviceName}`
    .slice(0, 200)
    .replace(/[^a-zA-Z0-9-_]/g, '');

  const repo = new aws.ecr.Repository(repoName, {
    name: repoName,
    forceDelete: true,
    imageScanningConfiguration: {
      scanOnPush: true,
    },
  });

  // Create ECR lifecycle policy
  new aws.ecr.LifecyclePolicy(`${repoName}-lifecycle`, {
    repository: repo.name,
    policy: JSON.stringify({
      rules: [{
        rulePriority: 1,
        description: "Keep last 5 images",
        selection: {
          tagStatus: "any",
          countType: "imageCountMoreThan",
          countNumber: 5
        },
        action: {
          type: "expire"
        }
      }]
    })
  });

  // Build and push the Docker image
  const image = new awsx.ecr.Image(`${args.serviceName}-image`, {
    repositoryUrl: repo.repositoryUrl,
    dockerfile: args.dockerfilePath,
    context: args.buildContext || path.dirname(args.dockerfilePath),
    platform: "linux/amd64",
    args: {
      "provenance": "false"
    }
  });

  // Create IAM role for Lambda
  const lambdaRole = new aws.iam.Role(`${args.projectName}-${args.environment}-${args.serviceName}-role`, {
    assumeRolePolicy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Action: "sts:AssumeRole",
          Effect: "Allow",
          Principal: { Service: "lambda.amazonaws.com" },
        },
      ],
    }),
  });

  // Attach basic execution policy
  new aws.iam.RolePolicyAttachment(`${args.projectName}-${args.environment}-${args.serviceName}-policy-basic-exec`, {
    role: lambdaRole.name,
    policyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
  });

  // Attach VPC access policy
  new aws.iam.RolePolicyAttachment(`${args.projectName}-${args.environment}-${args.serviceName}-policy-vpc-access`, {
    role: lambdaRole.name,
    policyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole",
  });

  new aws.iam.RolePolicyAttachment(`${args.projectName}-${args.environment}-${args.serviceName}-xray-policy`, {
    role: lambdaRole.name,
    policyArn: "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess",
  });

  // If S3 bucket is provided, add S3 permissions
  if (args.s3BucketArn) {
    new aws.iam.RolePolicy(`${args.projectName}-${args.environment}-${args.serviceName}-s3-permissions`, {
      role: lambdaRole.id,
      policy: pulumi.interpolate`{
        "Version": "2012-10-17",
        "Statement": [
          {
            "Effect": "Allow",
            "Action": [
              "s3:PutObject",
              "s3:GetObject",
              "s3:DeleteObject",
              "s3:ListBucket"
            ],
            "Resource": [
              "${args.s3BucketArn}",
              "${args.s3BucketArn}/*"
            ]
          }
        ]
      }`,
    });
  }

  // If SQS queues are provided, add SQS permissions
  pulumi.all([args.sqsQueueArns]).apply(([queueArns]) => {
    if (queueArns && queueArns.length > 0) {
      new aws.iam.RolePolicy(`${args.projectName}-${args.environment}-${args.serviceName}-sqs-permissions`, {
        role: lambdaRole.id,
        policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: [
                "sqs:ReceiveMessage",
                "sqs:DeleteMessage",
                "sqs:GetQueueAttributes",
                "sqs:SendMessage",
                "sqs:GetQueueUrl",
                "sqs:ChangeMessageVisibility",
                "sqs:ListQueueTags",
                "sqs:ListDeadLetterSourceQueues",
                "sqs:SendMessageBatch",
              ],
              Resource: [
                ...queueArns,
                // Add a wildcard version to account for name prefix differences
                ...queueArns.map(arn => {
                  // Extract the base ARN without the queue name
                  const baseArn = arn.substring(0, arn.lastIndexOf(':') + 1);
                  // Return a wildcard ARN that matches any queue
                  return `${baseArn}*`;
                })
              ]
            }
          ]
        }),
      });
    }
  });

  // Create Lambda function
  const lambdaFunc = new aws.lambda.Function(`${args.projectName}-${args.environment}-${args.serviceName}`, {
    name: `${args.projectName}-${args.environment}-${args.serviceName}`,
    imageUri: image.imageUri,
    packageType: 'Image',
    memorySize: args.lambdaMemorySize,
    timeout: args.lambdaTimeout,
    role: lambdaRole.arn,
    environment: {
      variables: args.environmentVariables,
    },
    vpcConfig: {
      subnetIds: args.privateSubnetIds,
      securityGroupIds: [args.lambdaSecurityGroupId]
    },
    layers: args.lambdaLayerArns,
    // tracingConfig: {
    //   mode: "Active",
    // }
  });

  // Create Target Group for Lambda
  const targetGroup = new aws.lb.TargetGroup(`${args.projectName}-${args.environment}-${args.serviceName}-tg`, {
    name: `${args.projectName}-${args.environment}-${args.serviceName}-tg`,
    targetType: "lambda",
  });

  // Create ALB listener rule
  new aws.lb.ListenerRule(`${args.projectName}-${args.environment}-${args.serviceName}-rule`, {
    listenerArn: args.sharedAlbListener,
    actions: [{
      type: "forward",
      targetGroupArn: targetGroup.arn,
    }],
    conditions: [
      {
        hostHeader: {
          values: [pulumi.interpolate`${args.apiEndpoint}`],
        },
      },
    ],
  });

  // Add permission for ALB to invoke Lambda
  const permission = new aws.lambda.Permission(`${args.projectName}-${args.environment}-alb-permission`, {
    action: "lambda:InvokeFunction",
    function: lambdaFunc.arn,
    principal: "elasticloadbalancing.amazonaws.com",
    sourceArn: targetGroup.arn,
    statementId: "AllowALBInvocation",
  });

  // Attach Lambda to target group
  new aws.lb.TargetGroupAttachment(`${args.projectName}-${args.environment}-tg-attachment`, {
    targetGroupArn: targetGroup.arn,
    targetId: lambdaFunc.arn,
  }, {
    dependsOn: [permission]
  });

  return {
    roleName: lambdaRole.name,
    functionArn: lambdaFunc.arn,
  };
}
