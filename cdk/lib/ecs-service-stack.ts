import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
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
  
  public readonly deploymentGroup: codedeploy.EcsDeploymentGroup;
  
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
    
    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'FargateService', {
      cluster: props.cluster,
      taskSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      memoryLimitMiB: 512,
      cpu: 256,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
        containerPort: 80,
        executionRole: taskExecutionRole,
      },
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
    
    fargateService.targetGroup.configureHealthCheck({
      path: "/",
      interval: Duration.seconds(30),
      timeout: Duration.seconds(10),
      healthyThresholdCount: 3,
      unhealthyThresholdCount: 3,
    });
    
    const blueTargetGroup = fargateService.targetGroup;
    const greenTargetGroup = new elbv2.ApplicationTargetGroup(this, 'GreenTargetGroup', {
      vpc: props.vpc,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
    });
    const albSecurityGroup = fargateService.loadBalancer.connections.securityGroups[0];
    albSecurityGroup.addIngressRule(ec2.Peer.ipv4('153.167.241.229/32'), ec2.Port.tcp(443), 'Allow access from specific IP range');

    // グリーン環境 HTTPS: 8443を使用
    const greenListener = fargateService.loadBalancer.addListener('GreenListener', {
      port: 8443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      certificates: [props.certificateStack.certificate],
      open: false,
      defaultTargetGroups: [greenTargetGroup],
    });
    const securityGroupForGreen = new ec2.SecurityGroup(this, 'GreenListenerSG', {
      vpc: props.vpc,
      description: 'Security group for Green',
      allowAllOutbound: true,
    });
    securityGroupForGreen.addIngressRule(ec2.Peer.ipv4('153.167.241.229/32'), ec2.Port.tcp(8443), 'Allow HTTPS access from specific IP range');
    greenListener.node.addDependency(securityGroupForGreen);
    fargateService.loadBalancer.connections.addSecurityGroup(securityGroupForGreen);

    // デプロイ設定
    this.deploymentGroup = new codedeploy.EcsDeploymentGroup(this, 'EcsDeploymentGroup', {
      service: fargateService.service,
      blueGreenDeploymentConfig: {
        blueTargetGroup,
        greenTargetGroup,
        listener: fargateService.listener,
        testListener: greenListener,
        // deploymentApprovalWaitTime: Duration.hours(1),  // デプロイを承認するまでの待機
        terminationWaitTime: Duration.hours(12), // デプロイ成功後にブルー環境を削除するまでの待機時間
      },
      deploymentConfig: codedeploy.EcsDeploymentConfig.ALL_AT_ONCE,
    });
  }
}