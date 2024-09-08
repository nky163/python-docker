// lib/vpc-stack.ts
import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export class VpcStack extends Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // VPCの作成
    this.vpc = new ec2.Vpc(this, 'MyVpc', {
      maxAzs: 2, // 使用するアベイラビリティゾーンの数
      natGateways: 1, // NAT Gatewayの数
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public-subnet',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private-subnet',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, // インターネットアクセスが可能なプライベートサブネット
        },
        {
          cidrMask: 28,
          name: 'rds-subnet',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED, // インターネットアクセスができない完全なプライベートサブネット
        }
      ],
    });
  }
}
