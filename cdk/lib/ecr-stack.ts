import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

export class EcrStack extends cdk.Stack {
  public readonly repository: ecr.Repository;
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.repository = new ecr.Repository(this, 'MyRepository', {
      repositoryName: 'my-ecr-repo',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      lifecycleRules: [
        {
          // main または deploy タグがついているイメージは削除しない
          tagPrefixList: ['main', 'deploy'],
          rulePriority: 1,
          description: 'Keep images with main or deploy tags',
          maxImageCount: undefined,  // 削除しないため maxImageCount は指定しない
        },
        {
          // develop. で始まるタグがついているイメージは7世代残す
          tagPrefixList: ['develop.'],
          rulePriority: 2,
          description: 'Keep 7 images with tags starting with develop.',
          maxImageCount: 7,
        },
        {
          // その他のイメージは7日で削除
          rulePriority: 3,
          description: 'Remove images after 7 days',
          maxImageAge: cdk.Duration.days(7),
        }
      ]
    });
  }
}
