#!/bin/bash

# 環境変数の使用
REGION=${REGION}
ECR_REPO_URI=${ECR_REPO_URI}
IMAGE_TAG=${IMAGE_TAG}

# AWS CLIでECRにログイン
$(aws ecr get-login --no-include-email --region $REGION)

# イメージにdeployタグを付ける
docker pull ${ECR_REPO_URI}:${IMAGE_TAG}
docker tag ${ECR_REPO_URI}:${IMAGE_TAG} ${ECR_REPO_URI}:deploy
docker push ${ECR_REPO_URI}:deploy
