import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as codedeploy from 'aws-cdk-lib/aws-codedeploy';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { CertificateStack } from './certificate-stack';

interface EcsServiceStackProps extends StackProps {
  vpc: ec2.Vpc;
  cluster: ecs.Cluster;
  certificateStack: CertificateStack;
}

export class EcsServiceStack extends Stack {
  
  public readonly alb: elbv2.ApplicationLoadBalancer;
  
  constructor(scope: Construct, id: string, props: EcsServiceStackProps) {
    super(scope, id, props);

    const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    taskExecutionRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage',
        'ecr:BatchCheckLayerAvailability',
        'ecr:GetAuthorizationToken',
      ],
      resources: ['*'],
    }));

    // ALBの作成とリスナーの設定
    this.alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc: props.vpc,
      internetFacing: true,
    });
    

    // ターゲットグループの作成
    const blueTargetGroup = new elbv2.ApplicationTargetGroup(this, 'BlueTargetGroup', {
      vpc: props.vpc,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
    });

    const greenTargetGroup = new elbv2.ApplicationTargetGroup(this, 'GreenTargetGroup', {
      vpc: props.vpc,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
    });

    // リスナーの作成とデフォルトターゲットグループの設定
    const listener = this.alb.addListener('Listener', {
      port: 443,
      certificates: [props.certificateStack.certificate], // メインの証明書
      open: true,
      defaultTargetGroups: [blueTargetGroup], // デフォルトのターゲットグループを設定
    });
    
    listener.addCertificates('TestAppCertificate', [props.certificateStack.testCertificate]);

    // ブルー環境用のセキュリティグループ
    const blueSecurityGroup = new ec2.SecurityGroup(this, 'BlueSG', {
      vpc: props.vpc,
      description: 'Security group for Blue environment',
      allowAllOutbound: true,
    });
    // ブルー環境へのIP制限を設定
    blueSecurityGroup.addIngressRule(ec2.Peer.ipv4('153.167.241.229/32'), ec2.Port.tcp(80), 'Allow HTTP access to Blue environment');

    // グリーン環境用のセキュリティグループ
    const greenSecurityGroup = new ec2.SecurityGroup(this, 'GreenSG', {
      vpc: props.vpc,
      description: 'Security group for Green environment',
      allowAllOutbound: true,
    });
    // グリーン環境へのIP制限を設定
    greenSecurityGroup.addIngressRule(ec2.Peer.ipv4('153.167.241.229/32'), ec2.Port.tcp(80), 'Allow HTTP access to Green environment');

    // タスク定義を作成
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      executionRole: taskExecutionRole,
      memoryLimitMiB: 512,
      cpu: 256,
    });

    // コンテナの設定
    const container = taskDefinition.addContainer('AppContainer', {
      image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
      memoryLimitMiB: 512,
    });

    container.addPortMappings({
      containerPort: 80,
      protocol: ecs.Protocol.TCP,
    });

    // ブルー環境のFargateサービス
    const blueService = new ecs.FargateService(this, 'BlueFargateService', {
      cluster: props.cluster,
      taskDefinition: taskDefinition,
      desiredCount: 1,
      securityGroups: [blueSecurityGroup],  // ブルー環境用のセキュリティグループ
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      deploymentController: {
        type: ecs.DeploymentControllerType.CODE_DEPLOY,
      },
    });

    // グリーン環境のFargateサービス
    const greenService = new ecs.FargateService(this, 'GreenFargateService', {
      cluster: props.cluster,
      taskDefinition: taskDefinition,
      desiredCount: 1,
      securityGroups: [greenSecurityGroup],  // グリーン環境用のセキュリティグループ
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    // ホストベースルーティングを設定
    listener.addTargetGroups('BlueTG', {
      priority: 10,
      targetGroups: [blueTargetGroup],
      conditions: [elbv2.ListenerCondition.hostHeaders(['app.example.com'])],
    });

    listener.addTargetGroups('GreenTG', {
      priority: 20,
      targetGroups: [greenTargetGroup],
      conditions: [elbv2.ListenerCondition.hostHeaders(['test-app.example.com'])],
    });

    // 各サービスをターゲットグループに関連付け
    blueService.attachToApplicationTargetGroup(blueTargetGroup);
    greenService.attachToApplicationTargetGroup(greenTargetGroup);

    // CodeDeployデプロイグループの作成
    const deploymentGroup = new codedeploy.EcsDeploymentGroup(this, 'EcsDeploymentGroup', {
      service: blueService,
      blueGreenDeploymentConfig: {
        blueTargetGroup: blueTargetGroup,
        greenTargetGroup: greenTargetGroup,
        listener: listener,
        deploymentApprovalWaitTime: Duration.hours(1),
        terminationWaitTime: Duration.minutes(5),
      },
      deploymentConfig: codedeploy.EcsDeploymentConfig.ALL_AT_ONCE,
    });
  }
}
