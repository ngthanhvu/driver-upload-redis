#!/usr/bin/env sh
set -e

echo "🧹 Remove old override file"
rm -f docker-compose.override.yml

echo "🚀 Build & deploy containers"
docker compose -f docker-compose.prod.yml up -d --build

echo "🧹 Cleanup unused Docker resources"
docker image prune -f
docker container prune -f
docker builder prune -f

echo "✅ Deploy & cleanup done"
