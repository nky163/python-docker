import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';
import { EcsClusterStack } from '../lib/ecs-cluster-stack';
import { EcsServiceStack } from '../lib/ecs-service-stack';
import { CertificateStack } from '../lib/certificate-stack';
import { Route53Stack } from '../lib/route53-stack';
import { EcrStack } from '../lib/ecr-stack';
import { Tags } from 'aws-cdk-lib';

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
});

const ecrStack = new EcrStack(app, `${appName}-${stage}-EcrStack`, {
  env,
})

const route53Stack = new Route53Stack(app, `${appName}-${stage}-Route53-Stack`, {
  env,
  alb: ecsServiceStack.alb,
  certificateStack: certificateStack,
})

ecsClusterStack.addDependency(vpcStack);
ecsServiceStack.addDependency(ecsClusterStack);
ecsServiceStack.addDependency(certificateStack);
ecsServiceStack.addDependency(ecrStack);
route53Stack.addDependency(certificateStack);
route53Stack.addDependency(ecsServiceStack);

Tags.of(app).add('Project', 'MyApp');
Tags.of(app).add('Stage', stage);