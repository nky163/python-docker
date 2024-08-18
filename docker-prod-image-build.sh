#!/bin/bash -x
docker build -f app/Dockerfile --target production --platform=linux/amd64 --no-cache --progress=plain . -t myapp-prod:latest
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin 142196353354.dkr.ecr.ap-northeast-1.amazonaws.com
docker tag myapp-prod:latest 142196353354.dkr.ecr.ap-northeast-1.amazonaws.com/my-ecr-repo:latest
docker push 142196353354.dkr.ecr.ap-northeast-1.amazonaws.com/my-ecr-repo:latest