import * as cdk from 'aws-cdk-lib';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';

export class CodeCommitPrPipelineStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // CodeCommitリポジトリの定義
        const repo = codecommit.Repository.fromRepositoryName(this, 'MyRepo', 'my-repo-name');

        // CodeBuildプロジェクトの定義
        const project = new codebuild.PipelineProject(this, 'MyProject', {
            environment: {
                buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
                computeType: codebuild.ComputeType.SMALL,
                environmentVariables: {
                    REPOSITORY_NAME: {
                        value: repo.repositoryName,  // 環境変数としてリポジトリ名を設定
                    },
                },
            },
            buildSpec: codebuild.BuildSpec.fromObject({
                version: '0.2',
                phases: {
                    install: {
                        commands: [
                            'npm install aws-sdk',
                        ],
                    },
                    build: {
                        commands: [
                            'echo "Build started"',
                        ],
                    },
                    post_build: {
                        commands: [
                            'if [ $? -eq 0 ]; then export BUILD_STATUS=SUCCEEDED; else export BUILD_STATUS=FAILED; fi',
                            'node post-build.js', // 環境変数として渡すので引数は不要
                        ],
                    },
                },
            }),
        });

        // プルリクエストへのコメント追加に必要なポリシーをプロジェクトのロールにアタッチ
        project.addToRolePolicy(new iam.PolicyStatement({
            actions: ['codecommit:PostCommentForPullRequest'],
            resources: [repo.repositoryArn],
        }));

        // CodePipelineの定義
        const pipeline = new codepipeline.Pipeline(this, 'MyPipeline', {
            pipelineName: 'MyPrPipeline',
        });

        // ソースステージの定義
        const sourceOutput = new codepipeline.Artifact();
        const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
            actionName: 'CodeCommit_Source',
            repository: repo,
            output: sourceOutput,
            trigger: codepipeline_actions.CodeCommitTrigger.NONE,  // 自動トリガーなし
        });

        // CodeBuildステージの定義
        const buildAction = new codepipeline_actions.CodeBuildAction({
            actionName: 'CodeBuild',
            project: project,
            input: sourceOutput,
        });

        // ステージの追加
        pipeline.addStage({
            stageName: 'Source',
            actions: [sourceAction],
        });

        pipeline.addStage({
            stageName: 'Build',
            actions: [buildAction],
        });

        // EventBridgeルールの作成
        const rule = new events.Rule(this, 'CodeCommitPrRule', {
            eventPattern: {
                source: ['aws.codecommit'],
                detailType: ['CodeCommit Pull Request State Change', 'CodeCommit Pull Request Source Branch Updated'],
                resources: [repo.repositoryArn],
                detail: {
                    event: [
                        'pullRequestCreated',
                        'pullRequestSourceBranchUpdated',
                        'pullRequestMerged',
                    ],
                },
            },
        });

        // CodePipelineのターゲットをEventBridgeルールに追加
        rule.addTarget(new targets.CodePipeline(pipeline));
    }
}

const app = new cdk.App();
new CodeCommitPrPipelineStack(app, 'CodeCommitPrPipelineStack');
app.synth();
