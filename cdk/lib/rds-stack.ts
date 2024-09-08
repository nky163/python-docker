// lib/rds-stack.ts
import { Stack, StackProps, Duration, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

interface RdsStackProps extends StackProps {
  vpc: ec2.Vpc;
  stage: string;
}

export class RdsStack extends Stack {
  public readonly cluster: rds.DatabaseCluster;
  
  constructor(scope: Construct, id: string, props: RdsStackProps) {
    super(scope, id, props);

    // RDSの認証情報をSecrets Managerで管理
    const credentials = new rds.DatabaseSecret(this, 'DBSecret', {
      username: 'admin',
    });

    // RDS Aurora MySQL クラスターの作成
    this.cluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
      engine: rds.DatabaseClusterEngine.auroraMysql({
        version: rds.AuroraMysqlEngineVersion.VER_3_07_0,
      }),
      credentials: rds.Credentials.fromSecret(credentials),
      defaultDatabaseName: 'myappdb',
      instances: 1,
      instanceProps: {
        vpc: props.vpc,
        vpcSubnets: {
          subnetGroupName: 'rds-subnet'
        },
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.MEDIUM),
      },
      removalPolicy: RemovalPolicy.DESTROY, // 環境削除時にRDSを削除
    });
    
    new CfnOutput(this, `RdsSg-${props.stage}`, {
      exportName: `RdsSg-${props.stage}`,
      value: this.cluster.connections.securityGroups[0].securityGroupId,
    });
  }
}