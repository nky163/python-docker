import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';
import { EcsClusterStack } from '../lib/ecs-cluster-stack';
import { EcsServiceStack } from '../lib/ecs-service-stack';
import { CertificateStack } from '../lib/certificate-stack';
import { EcrStack } from '../lib/ecr-stack';
import { Tags } from 'aws-cdk-lib';
import { PipelineStack } from '../lib/pipeline-stack';
import { RdsStack } from '../lib/rds-stack';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

const app = new cdk.App();
const appName = 'MyApp';
const stage = app.node.tryGetContext('stage') as string;
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION
};

const suffix = '-nakaya';

const vpcStack = new VpcStack(app, `${appName}-${stage}-VpcStack`, {
  env,
});

const rdsStack = new RdsStack(app, `${appName}-${stage}-RdsStack`, { // RDSスタックを追加
  env,
  vpc: vpcStack.vpc,
  stage,
});

// ECRは全環境共通
const ecrStack = new EcrStack(app, `${appName}-EcrStack`, {
  env,
})

const certificateStack = new CertificateStack(app, `${appName}-${stage}${suffix}-CertificateStack`, {
  env,
  domainName: app.node.tryGetContext('domainName'),
  subDomainName: `${stage}${suffix}`,
});

const ecsClusterStack = new EcsClusterStack(app, `${appName}-${stage}${suffix}-EcsClusterStack`, {
  env,
  vpc: vpcStack.vpc,
});

const ecsServiceStack = new EcsServiceStack(app, `${appName}-${stage}${suffix}-EcsServiceStack`, {
  env,
  vpc: vpcStack.vpc,
  cluster: ecsClusterStack.cluster,
  certificateStack: certificateStack,
  stage: stage,
  suffix: suffix,
});

// const pipelineStack = new PipelineStack(app, `${appName}-${stage}-PipelineStack`, {
//   env,
//   ecsServiceStack: ecsServiceStack,
//   ecrStack: ecrStack,
// })

ecsClusterStack.addDependency(vpcStack);
ecsServiceStack.addDependency(ecsClusterStack);
ecsServiceStack.addDependency(certificateStack);
ecsServiceStack.addDependency(rdsStack);
// pipelineStack.addDependency(ecrStack);
// pipelineStack.addDependency(ecsServiceStack);

Tags.of(app).add('Project', 'MyApp');
Tags.of(app).add('Stage', stage);