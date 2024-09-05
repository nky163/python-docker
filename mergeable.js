const AWS = require('aws-sdk');
const codecommit = new AWS.CodeCommit({ region: process.env.AWS_REGION });

const repositoryName = process.env.REPOSITORY_NAME;
const pullRequestId = process.env.CODEBUILD_SOURCE_VERSION.split('/')[2]; // PR IDを取得

const params = {
    pullRequestId: pullRequestId,
    repositoryName: repositoryName,
};

codecommit.getPullRequest(params, (err, data) => {
    if (err) {
        console.log('Error fetching pull request:', err);
        process.exit(1); // エラーが発生した場合、ビルドを失敗させる
    } else {
        const pr = data.pullRequest;
        const isMergeable = pr.pullRequestStatus === 'OPEN' && pr.isMergeable;

        if (isMergeable) {
            console.log('The pull request is mergeable.');
            process.exit(0); // マージ可能な場合、ビルドを成功させる
        } else {
            console.log('The pull request is not mergeable.');
            process.exit(1); // マージ不可の場合、ビルドを失敗させる
        }
    }
});
