const AWS = require('aws-sdk');
const codecommit = new AWS.CodeCommit({ region: process.env.AWS_REGION });

// 環境変数からリポジトリ名を取得
const repositoryName = process.env.REPOSITORY_NAME;
const pullRequestId = process.env.CODEBUILD_SOURCE_VERSION.split('/')[2]; // PR IDの取得
const buildStatus = process.env.BUILD_STATUS; // CodeBuildのビルドステータス

// バッジURLの決定
let badgeUrl = '';
if (buildStatus === 'SUCCEEDED') {
    badgeUrl = 'https://img.shields.io/badge/build-success-brightgreen';
} else {
    badgeUrl = 'https://img.shields.io/badge/build-failure-red';
}

const commentContent = `ビルドステータス: ${buildStatus} ![ビルドバッジ](${badgeUrl})`;

const params = {
    pullRequestId: pullRequestId,
    repositoryName: repositoryName,
    content: commentContent,
};

codecommit.postCommentForPullRequest(params, (err, data) => {
    if (err) console.log(err, err.stack);
    else console.log(data);
});
