import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as iam from 'aws-cdk-lib/aws-iam';
import { EcsServiceStack } from './ecs-service-stack';
import { EcrStack } from './ecr-stack';

interface PipelineStackProps extends cdk.StackProps {
  ecsServiceStack: EcsServiceStack;
  ecrStack: EcrStack;
}

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);
    
    const githubToken = cdk.SecretValue.secretsManager('my-github-token');
    
    const buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
        privileged: true,
      },
      environmentVariables: {
        'AWS_DEFAULT_REGION': {
          value: `${cdk.Aws.REGION}`
        },
        'ECR_REPO_URI': {
          value: `${cdk.Aws.ACCOUNT_ID}.dkr.ecr.${cdk.Aws.REGION}.amazonaws.com/${props.ecrStack.repository.repositoryName}`
        },
        'EXECUTION_ROLE_ARN': {
          value: props.ecsServiceStack.fargateService.taskDefinition.executionRole?.roleArn
        },
        'TASK_ROLE_ARN': {
          value: props.ecsServiceStack.fargateService.taskDefinition.taskRole.roleArn
        },
        'TASK_FAMILY': {
          value: props.ecsServiceStack.fargateService.taskDefinition.family
        },
        'CONTAINER_NAME': {
          value: props.ecsServiceStack.fargateService.serviceName
        },
        'LOG_GROUP': {
          value: props.ecsServiceStack.fargateService.taskDefinition.defaultContainer?.logDriverConfig?.options?.['awslogs-group']
        },
      },
      buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yaml'),
    });
    
    buildProject.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'ecr:BatchCheckLayerAvailability',
        'ecr:CompleteLayerUpload',
        'ecr:GetDownloadUrlForLayer',
        'ecr:InitiateLayerUpload',
        'ecr:PutImage',
        'ecr:UploadLayerPart',
        'ecr:GetAuthorizationToken',
      ],
      resources: ['*'],
    }));

    // パイプラインの定義
    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineType: codepipeline.PipelineType.V2,
      pipelineName: 'MyAppPipeline',
      restartExecutionOnUpdate: true,
    });

    // ソースステージ
    const sourceOutput = new codepipeline.Artifact();
    pipeline.addStage({
      stageName: 'Source',
      actions: [
        new codepipeline_actions.GitHubSourceAction({
          actionName: 'GitHub_Source',
          owner: 'nky163',
          repo: 'python-docker',
          branch: 'main', // 使用するブランチ名
          oauthToken: githubToken, // GitHubトークン
          output: sourceOutput,
        })
      ]
    });

    // ビルドステージ
    const buildOutput = new codepipeline.Artifact();
    pipeline.addStage({
      stageName: 'Build',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'Build',
          project: buildProject,
          input: sourceOutput,
          outputs: [buildOutput],
        })
      ]
    });

    // デプロイステージ
    pipeline.addStage({
      stageName: 'Deploy',
      actions: [
        new codepipeline_actions.CodeDeployEcsDeployAction({
          actionName: 'Deploy',
          deploymentGroup: props.ecsServiceStack.deploymentGroup,
          appSpecTemplateFile: buildOutput.atPath('appspec.yaml'),
          taskDefinitionTemplateFile: buildOutput.atPath('taskdef.json'),
          containerImageInputs: [
            {
              input: buildOutput,
              taskDefinitionPlaceholder: "IMAGE1_NAME",
            }
          ]
        })
      ]
    });
  }
}
