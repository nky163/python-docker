import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';
import { EcsClusterStack } from '../lib/ecs-cluster-stack';
import { EcsServiceStack } from '../lib/ecs-service-stack';
import { CertificateStack } from '../lib/certificate-stack';
import { EcrStack } from '../lib/ecr-stack';
import { Tags } from 'aws-cdk-lib';
import { PipelineStack } from '../lib/pipeline-stack';
import { RdsStack } from '../lib/rds-stack';

const app = new cdk.App();
const appName = 'MyApp';
const stage = app.node.tryGetContext('stage') as string;
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION
};

const vpcStack = new VpcStack(app, `${appName}-${stage}-VpcStack`, {
  env,
});

const rdsStack = new RdsStack(app, `${appName}-${stage}-RdsStack`, { // RDSスタックを追加
  env,
  vpc: vpcStack.vpc,
});

const certificateStack = new CertificateStack(app, `${appName}-${stage}-CertificateStack`, {
  env,
  domainName: app.node.tryGetContext('domainName'),
  subDomainName: stage,
});

const ecsClusterStack = new EcsClusterStack(app, `${appName}-${stage}-EcsClusterStack`, {
  env,
  vpc: vpcStack.vpc,
});

const ecsServiceStack = new EcsServiceStack(app, `${appName}-${stage}-EcsServiceStack`, {
  env,
  vpc: vpcStack.vpc,
  cluster: ecsClusterStack.cluster,
  certificateStack: certificateStack,
  stage: stage,
  rdsCluster: rdsStack.cluster
});

// ECRは全環境共通
const ecrStack = new EcrStack(app, `${appName}-EcrStack`, {
  env,
})

const pipelineStack = new PipelineStack(app, `${appName}-${stage}-PipelineStack`, {
  env,
  ecsServiceStack: ecsServiceStack,
  ecrStack: ecrStack,
})

ecsClusterStack.addDependency(vpcStack);
ecsServiceStack.addDependency(ecsClusterStack);
ecsServiceStack.addDependency(certificateStack);
// pipelineStack.addDependency(ecrStack);
// pipelineStack.addDependency(ecsServiceStack);

Tags.of(app).add('Project', 'MyApp');
Tags.of(app).add('Stage', stage);