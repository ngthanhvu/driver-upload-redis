#!/usr/bin/env sh
set -e

# Cleanup old override file from previous deployment strategy
rm -f docker-compose.override.yml

docker compose -f docker-compose.prod.yml up -d --build
