const AWS = require('aws-sdk');
const codecommit = new AWS.CodeCommit({ region: process.env.AWS_REGION });

const repositoryName = process.env.REPOSITORY_NAME;
const pullRequestId = process.env.CODEBUILD_SOURCE_VERSION.split('/')[2]; // プルリクエストID

const badgeUrl = `https://codebuild.${process.env.AWS_REGION}.amazonaws.com/badges/${process.env.CODEBUILD_PROJECT_NAME}/build-badge.svg`;

// プルリクエストにコメントを投稿する関数
const postComment = async (content) => {
    const params = {
        pullRequestId: pullRequestId,
        repositoryName: repositoryName,
        content: content,
    };
    try {
        await codecommit.postCommentForPullRequest(params).promise();
        console.log('Comment posted:', content);
    } catch (err) {
        console.error('Error posting comment:', err);
    }
};

// ビルドバッジをプルリクエストに投稿
const badgeComment = `![Build Status](${badgeUrl})`;

postComment(badgeComment);
