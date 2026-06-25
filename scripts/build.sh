#!/bin/bash
set -euo pipefail

# REQUIRED SECRETS (set as env vars or Docker logged in):
#   - DOCKER_REGISTRY  (default: nayannyk) — Docker Hub username/org
#   - Run `docker login` before pushing, or use Jenkins docker-hub-credentials
#
IMAGE_TAG=${1:-latest}
DOCKER_REGISTRY=${DOCKER_REGISTRY:-nayannyk}

echo "Building backend image..."
docker build -t "${DOCKER_REGISTRY}/snake-backend:${IMAGE_TAG}" ./backend
docker tag "${DOCKER_REGISTRY}/snake-backend:${IMAGE_TAG}" "${DOCKER_REGISTRY}/snake-backend:build-${BUILD_NUMBER:-local}"

echo "Building frontend image..."
docker build -t "${DOCKER_REGISTRY}/snake-frontend:${IMAGE_TAG}" ./frontend
docker tag "${DOCKER_REGISTRY}/snake-frontend:${IMAGE_TAG}" "${DOCKER_REGISTRY}/snake-frontend:build-${BUILD_NUMBER:-local}"

echo "Pushing images..."
docker push "${DOCKER_REGISTRY}/snake-backend:${IMAGE_TAG}"
docker push "${DOCKER_REGISTRY}/snake-backend:build-${BUILD_NUMBER:-local}"
docker push "${DOCKER_REGISTRY}/snake-frontend:${IMAGE_TAG}"
docker push "${DOCKER_REGISTRY}/snake-frontend:build-${BUILD_NUMBER:-local}"

echo "Build complete for tag: ${IMAGE_TAG}"
