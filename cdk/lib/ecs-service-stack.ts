import { Stack, StackProps, Duration, RemovalPolicy, CfnOutput, Fn } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as codedeploy from 'aws-cdk-lib/aws-codedeploy';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs'
import { CertificateStack } from './certificate-stack';
import { ALLOW_IPS } from '../variables/allow-ips';
import { RdsStack } from './rds-stack';
interface EcsServiceStackProps extends StackProps {
  vpc: ec2.IVpc;
  cluster: ecs.Cluster;
  certificateStack: CertificateStack;
  stage: string;
  suffix: string;
}

export class EcsServiceStack extends Stack {
  
  public readonly deploymentGroup: codedeploy.EcsDeploymentGroup;
  public readonly fargateService: ecs.FargateService;
  
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
        'secretsmanager:GetSecretValue',  // シークレットマネージャーのアクセス許可
        'secretsmanager:DescribeSecret'
      ],
      resources: ['*'],
    }));
    const albFargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, `FargateService-${props.stage}${props.suffix}`, {
      cluster: props.cluster,
      taskSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      memoryLimitMiB: 512,
      cpu: 256,
      taskImageOptions: {
        family: `${props.stage}${props.suffix}-taskdef`,
        containerName: `${props.stage}${props.suffix}-container`,
        image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
        containerPort: 80,
        executionRole: taskExecutionRole,
        logDriver: new ecs.AwsLogDriver({
          streamPrefix: 'container',
          logGroup: new logs.LogGroup(this, 'LogGroup', {
            logGroupName: `/aws/ecs/${props.stage}${props.suffix}`,
            removalPolicy: RemovalPolicy.DESTROY, // ロググループをスタック削除時に削除するオプション
            retention: logs.RetentionDays.ONE_WEEK, // 必要に応じてログの保持期間を設定
          }),
        }),
      },
      serviceName: `${props.stage}${props.suffix}-service`,
      loadBalancerName: `${props.stage}${props.suffix}-lb`,
      publicLoadBalancer: true,
      openListener:false,
      deploymentController: {
        type: ecs.DeploymentControllerType.CODE_DEPLOY,
      },
      certificate: props.certificateStack.certificate,
      domainName: props.certificateStack.fqdn,
      domainZone: props.certificateStack.hostedZone,
      desiredCount: 1,
    });
    this.fargateService = albFargateService.service;
    
    
    albFargateService.targetGroup.configureHealthCheck({
      path: "/",
      interval: Duration.seconds(30),
      timeout: Duration.seconds(10),
      healthyThresholdCount: 3,
      unhealthyThresholdCount: 3,
    });
    
    const blueTargetGroup = albFargateService.targetGroup;
    const greenTargetGroup = new elbv2.ApplicationTargetGroup(this, 'GreenTargetGroup', {
      vpc: props.vpc,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
    });
    ALLOW_IPS[props.stage].blue.forEach(() => {
      albFargateService.loadBalancer.connections.allowFrom(ec2.Peer.ipv4('153.167.241.229/32'), ec2.Port.tcp(443), 'Allow access from specific IP range');
    })

    // グリーン環境 HTTPS: 8443を使用
    const greenListener = albFargateService.loadBalancer.addListener('GreenListener', {
      port: 8443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      certificates: [props.certificateStack.certificate],
      open: false,
      defaultTargetGroups: [greenTargetGroup],
    });
    
    ALLOW_IPS[props.stage].green.forEach(() => {
      albFargateService.loadBalancer.connections.allowFrom(ec2.Peer.ipv4('153.167.241.229/32'), ec2.Port.tcp(8443), 'Allow HTTPS access from specific IP range');
    })
    

    // デプロイ設定
    this.deploymentGroup = new codedeploy.EcsDeploymentGroup(this, 'EcsDeploymentGroup', {
      service: albFargateService.service,
      deploymentGroupName: `${props.stage}${props.suffix}-codedeploy-group`,
      blueGreenDeploymentConfig: {
        blueTargetGroup,
        greenTargetGroup,
        listener: albFargateService.listener,
        testListener: greenListener,
        // deploymentApprovalWaitTime: Duration.hours(1),  // デプロイを承認するまでの待機
        // terminationWaitTime: Duration.hours(12), // デプロイ成功後にブルー環境を削除するまでの待機時間
      },
      deploymentConfig: codedeploy.EcsDeploymentConfig.ALL_AT_ONCE,
    });
    
    
    const rdsSg = ec2.SecurityGroup.fromSecurityGroupId(this, `RdsSg`, Fn.importValue(`RdsSg-${props.stage}`))
    rdsSg.addIngressRule(
      this.fargateService.connections.securityGroups[0],
      ec2.Port.tcp(3306),
      'Allow Fargate access to RDS'
    );
    
  }
}