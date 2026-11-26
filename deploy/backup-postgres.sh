
#!/usr/bin/env bash

set -euo pipefail
umask 077

PROJECT_DIR="/home/ssm-user/techops"
AWS_REGION="ap-southeast-1"
S3_BUCKET="techops-db-backups-797601398239"

cd "$PROJECT_DIR"

BACKUP_DIR=$(mktemp -d)
trap 'rm -rf -- "$BACKUP_DIR"' EXIT

BACKUP_NAME="techops-$(date -u +%Y%m%d-%H%M%S).dump"
BACKUP_FILE="$BACKUP_DIR/$BACKUP_NAME"

COMPOSE=(docker compose --env-file .env.ec2 -f compose.ec2.yml)

echo "Starting PostgreSQL backup..."

"${COMPOSE[@]}" exec -T postgres \
    pg_dump -U techops -d techops -Fc > "$BACKUP_FILE"

test -s "$BACKUP_FILE"

"${COMPOSE[@]}" exec -T postgres \
    pg_restore --list < "$BACKUP_FILE" > /dev/null

echo "Backup archive validated. Uploading to S3..."

aws s3 cp "$BACKUP_FILE" \
    "s3://$S3_BUCKET/postgres/$BACKUP_NAME" \
    --region "$AWS_REGION" \
    --sse AES256 \
    --only-show-errors

echo "Backup completed: $BACKUP_NAME"
