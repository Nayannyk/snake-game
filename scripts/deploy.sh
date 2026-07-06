#!/bin/bash
set -euo pipefail

NAMESPACE="snake-game"
IMAGE_TAG=${1:-latest}
DOCKER_REGISTRY=${DOCKER_REGISTRY:-nayannyk}

echo "=== Deploying Snake Game to Kind cluster ==="
echo "Image Tag: ${IMAGE_TAG}"
echo ""

echo "1. Creating namespace..."
kubectl apply -f deploy/k8s/namespace.yaml
kubectl wait --for=jsonpath='{.status.phase}'=Active namespace/$NAMESPACE --timeout=30s

echo "2. Installing ingress controller..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.12.0/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s

echo "3. Applying manifests..."
kubectl apply -f deploy/k8s/

echo "4. Verifying rollout..."
kubectl rollout status deployment/snake-backend -n $NAMESPACE --timeout=120s
kubectl rollout status deployment/snake-frontend -n $NAMESPACE --timeout=120s

echo "5. Running smoke test..."
NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[0].address}')
NODE_PORT=$(kubectl get svc frontend -n $NAMESPACE -o jsonpath='{.spec.ports[0].nodePort}')
echo "Game available at: http://${NODE_IP}:${NODE_PORT}"

curl -sf "http://${NODE_IP}:${NODE_PORT}/" > /dev/null && echo "Frontend: OK"
curl -sf "http://${NODE_IP}:${NODE_PORT}/api/scores" > /dev/null && echo "Backend:  OK"

echo "=== Deployment complete! ==="
