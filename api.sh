curl -X PUT "https://<bucket>.s3-ap-northeast-1.amazonaws.com/nakayatest.txt" \
--header "Host: nakaya-test-1.s3.amazonaws.com" \
--header "x-amz-date: $(date -u +"%Y%m%dT%H%M%SZ")" \
--header "Content-Type: application/octet-stream" \
--data-binary "@nakayatest.txt" \
--aws-sigv4 "aws:amz:ap-northeast-1:s3" \
--user "<aaa>/<iii>"
