#!/bin/bash
set -euo pipefail

IMAGE_TAG=${1:-latest}
DOCKER_REGISTRY=${DOCKER_REGISTRY:-<your-dockerhub-username>}

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
