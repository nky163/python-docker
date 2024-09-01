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
        'ECR_REPO_URI': {
          value: `${cdk.Aws.ACCOUNT_ID}.dkr.ecr.${cdk.Aws.REGION}.amazonaws.com/${props.ecrStack.repository.repositoryName}`
        },
        'TASK_FAMILY': {
          value: props.ecsServiceStack.fargateService.taskDefinition.family
        }
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          pre_build: {
            commands: [
              'echo Logging in to Amazon ECR...',
              `aws ecr get-login-password --region ${cdk.Aws.REGION} | docker login --username AWS --password-stdin $ECR_REPO_URI`,
              'echo Fetching current task definition...',
              'export CURRENT_TASK_DEF_JSON=$(aws ecs describe-task-definition --task-definition $TASK_FAMILY)',
              'echo Current task definition fetched.'
            ],
          },
          build: {
            commands: [
              'echo Build started on `date`',
              'echo Building the Docker image...',
              'docker build -f app/Dockerfile --target production --platform=linux/amd64 --no-cache --progress=plain -t $ECR_REPO_URI:latest .',
              'docker tag $ECR_REPO_URI:latest $ECR_REPO_URI:$CODEBUILD_RESOLVED_SOURCE_VERSION',
            ],
          },
          post_build: {
            commands: [
              'echo Pushing the Docker image...',
              'docker push $ECR_REPO_URI:$CODEBUILD_RESOLVED_SOURCE_VERSION',
              'echo Writing image definitions file...',
              `printf '[{"name":"my-app-container","imageUri":"%s"}]' $ECR_REPO_URI:latest > imagedefinitions.json`,
              'echo Updating task definition with new image...',
              `echo $CURRENT_TASK_DEF_JSON | jq --arg IMAGE_URI "$ECR_REPOSITORY_URI:latest" '.taskDefinition | .containerDefinitions[0].image = $IMAGE_URI' > new-taskdef.json`,
              'echo Task definition updated.',
            ],
          },
        },
        artifacts: {
          files: [
            'new-taskdef.json',
            'imagedefinitions.json'
          ],
        },
      }),
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
        'ecs:RegisterTaskDefinition',
        'ecs:UpdateService',
        'codedeploy:*',
      ],
      resources: ['*'],
    }));

    // パイプラインの定義
    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
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
          appSpecTemplateInput: buildOutput,
          taskDefinitionTemplateInput: buildOutput,
        })
      ]
    });
  }
}
