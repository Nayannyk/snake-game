#!/bin/bash
set -euo pipefail

ENVIRONMENT=${1:-dev}
IMAGE_TAG=${2:-latest}
DOCKER_REGISTRY=${DOCKER_REGISTRY:-nayannyk}
KIND_CLUSTER=${KIND_CLUSTER:-kind-workers}
TF_DIR="deploy/terraform/environments/${ENVIRONMENT}"

echo "=== Deploying Snake Game to Kind cluster ==="
echo "Environment: ${ENVIRONMENT}"
echo "Image Tag:   ${IMAGE_TAG}"
echo ""

echo "1. Loading images into Kind..."
kind load docker-image "${DOCKER_REGISTRY}/snake-backend:${IMAGE_TAG}" --name "${KIND_CLUSTER}"
kind load docker-image "${DOCKER_REGISTRY}/snake-frontend:${IMAGE_TAG}" --name "${KIND_CLUSTER}"

echo "2. Running Terraform..."
cd "$TF_DIR"
terraform init -reconfigure
terraform plan -var="image_tag=${IMAGE_TAG}" -out=tfplan
terraform apply -auto-approve tfplan

echo "3. Verifying rollout..."
kubectl rollout status deployment/snake-backend -n snake-game --timeout=120s
kubectl rollout status deployment/snake-frontend -n snake-game --timeout=120s

echo "4. Running smoke test..."
NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[0].address}')
NODE_PORT=$(kubectl get svc frontend -n snake-game -o jsonpath='{.spec.ports[0].nodePort}')
echo "Game available at: http://${NODE_IP}:${NODE_PORT}"

curl -sf "http://${NODE_IP}:${NODE_PORT}/" > /dev/null && echo "Frontend: OK"
curl -sf "http://${NODE_IP}:${NODE_PORT}/api/scores" > /dev/null && echo "Backend:  OK"

echo "=== Deployment complete! ==="
