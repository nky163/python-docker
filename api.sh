#!/bin/bash

# 設定変数
BUCKET_NAME="your-bucket-name"   # S3バケット名
OBJECT_KEY="myfile.txt"          # アップロードするファイル名
REGION="us-east-1"               # S3のリージョンを指定
AWS_ACCESS_KEY_ID="your-access-key-id"     # IAMユーザーのアクセスキーID
AWS_SECRET_ACCESS_KEY="your-secret-access-key" # IAMユーザーのシークレットアクセスキー

# 日付の取得
DATE=$(date -u +"%Y%m%dT%H%M%SZ")
SHORT_DATE=$(date -u +"%Y%m%d")

# 署名の作成
SERVICE="s3"
REQUEST_METHOD="PUT"
CONTENT_TYPE="text/plain"
SIGNED_HEADERS="host;x-amz-content-sha256;x-amz-date"
CANONICAL_URI="/${OBJECT_KEY}"
CANONICAL_QUERY_STRING=""
CANONICAL_HEADERS="host:${BUCKET_NAME}.s3.amazonaws.com\nx-amz-content-sha256:UNSIGNED-PAYLOAD\nx-amz-date:${DATE}\n"
PAYLOAD_HASH="UNSIGNED-PAYLOAD"

CANONICAL_REQUEST="${REQUEST_METHOD}\n${CANONICAL_URI}\n${CANONICAL_QUERY_STRING}\n${CANONICAL_HEADERS}\n${SIGNED_HEADERS}\n${PAYLOAD_HASH}"
CANONICAL_REQUEST_HASH=$(echo -n "${CANONICAL_REQUEST}" | openssl dgst -sha256 | awk '{print $2}')

STRING_TO_SIGN="AWS4-HMAC-SHA256\n${DATE}\n${SHORT_DATE}/${REGION}/${SERVICE}/aws4_request\n${CANONICAL_REQUEST_HASH}"

# 署名キーの作成
K_SECRET="AWS4${AWS_SECRET_ACCESS_KEY}"
K_DATE=$(echo -n "${SHORT_DATE}" | openssl dgst -sha256 -hmac "${K_SECRET}" | awk '{print $2}')
K_REGION=$(echo -n "${REGION}" | openssl dgst -sha256 -hmac "${K_DATE}" | awk '{print $2}')
K_SERVICE=$(echo -n "${SERVICE}" | openssl dgst -sha256 -hmac "${K_REGION}" | awk '{print $2}')
K_SIGNING=$(echo -n "aws4_request" | openssl dgst -sha256 -hmac "${K_SERVICE}" | awk '{print $2}')

# 最終署名の生成
SIGNATURE=$(echo -n "${STRING_TO_SIGN}" | openssl dgst -sha256 -hmac "${K_SIGNING}" | awk '{print $2}')

# 認証ヘッダーの生成
AUTH_HEADER="AWS4-HMAC-SHA256 Credential=${AWS_ACCESS_KEY_ID}/${SHORT_DATE}/${REGION}/${SERVICE}/aws4_request, SignedHeaders=${SIGNED_HEADERS}, Signature=${SIGNATURE}"

# cURLコマンドを実行してS3にファイルをアップロード
curl -X ${REQUEST_METHOD} \
     -H "Host: ${BUCKET_NAME}.s3.amazonaws.com" \
     -H "x-amz-content-sha256: UNSIGNED-PAYLOAD" \
     -H "x-amz-date: ${DATE}" \
     -H "Authorization: ${AUTH_HEADER}" \
     --upload-file ${OBJECT_KEY} \
     https://${BUCKET_NAME}.s3.amazonaws.com/${OBJECT_KEY}
