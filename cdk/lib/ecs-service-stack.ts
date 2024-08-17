import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53_targets from 'aws-cdk-lib/aws-route53-targets';
import { CertificateStack } from './certificate-stack';

interface EcsServiceStackProps extends StackProps {
  vpc: ec2.Vpc;
  cluster: ecs.Cluster;
  certificateStack: CertificateStack;
}

export class EcsServiceStack extends Stack {
  constructor(scope: Construct, id: string, props: EcsServiceStackProps) {
    super(scope, id, props);
    
    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'MyFargateService', {
      cluster: props.cluster,
      taskSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      memoryLimitMiB: 512,
      cpu: 256,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
      },
      publicLoadBalancer: true,
      certificate: props.certificateStack.certificate,
      domainName: props.certificateStack.fqdn,
      domainZone: props.certificateStack.hostedZone,
    });
  }
}
