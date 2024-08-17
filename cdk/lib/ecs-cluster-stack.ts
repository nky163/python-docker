import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

interface EcsClusterStackProps extends StackProps {
  vpc: ec2.Vpc;
}

export class EcsClusterStack extends Stack {
  public readonly cluster: ecs.Cluster;

  constructor(scope: Construct, id: string, props: EcsClusterStackProps) {
    super(scope, id, props);

    this.cluster = new ecs.Cluster(this, 'MyCluster', {
      vpc: props.vpc,
    });
  }
}
