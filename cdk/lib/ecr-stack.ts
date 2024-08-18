import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

export class EcrStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const repository = new ecr.Repository(this, 'MyRepository', {
      repositoryName: 'my-ecr-repo',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      lifecycleRules: [{ maxImageAge: cdk.Duration.days(30) }]
    });
  }
}