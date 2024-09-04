// lib/rds-stack.ts
import { Stack, StackProps, Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

interface RdsStackProps extends StackProps {
  vpc: ec2.Vpc;
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
        version: rds.AuroraMysqlEngineVersion.VER_3_03_0,
      }),
      credentials: rds.Credentials.fromSecret(credentials),
      defaultDatabaseName: 'myappdb',
      instances: 2,
      instanceProps: {
        vpc: props.vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED, // プライベートサブネットを使用
        },
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
      },
      removalPolicy: RemovalPolicy.DESTROY, // 環境削除時にRDSを削除
    });
  }
}