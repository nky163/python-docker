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
    
    const cdkBuildProject = new codebuild.PipelineProject(this, 'CdkBuildProject', {
      environment: {
        buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_5,
      },
      buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec-cdk.yaml'),
      environmentVariables: {}
    })
    
    
    const dockerBuildProject = new codebuild.PipelineProject(this, 'DockerBuildProject', {
      environment: {
        buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_5,
        privileged: true,
      },
      buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec-docker.yaml'),
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
    });
    
    dockerBuildProject.addToRolePolicy(new iam.PolicyStatement({
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
    const cdkBuildOutput = new codepipeline.Artifact();
    pipeline.addStage({
      stageName: 'CDKDeploy',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'CDKDeploy',
          project: cdkBuildProject,
          input: sourceOutput,
          outputs: [cdkBuildOutput],
        }),
      ]
    });
    
    const dockerBuildOutput = new codepipeline.Artifact();
    pipeline.addStage({
      stageName: 'DockerBuild',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'Build',
          project: dockerBuildProject,
          input: sourceOutput,
          outputs: [dockerBuildOutput],
        })
      ]
    });

    // デプロイステージ
    pipeline.addStage({
      stageName: 'ECSDeploy',
      actions: [
        new codepipeline_actions.CodeDeployEcsDeployAction({
          actionName: 'Deploy',
          deploymentGroup: props.ecsServiceStack.deploymentGroup,
          appSpecTemplateFile: dockerBuildOutput.atPath('appspec.yaml'),
          taskDefinitionTemplateFile: dockerBuildOutput.atPath('taskdef.json'),
          containerImageInputs: [
            {
              input: dockerBuildOutput,
              taskDefinitionPlaceholder: "IMAGE1_NAME",
            }
          ]
        })
      ]
    });
  }
}
