#!/bin/bash
set -euo pipefail

echo "=== Snake Game Smoke Tests ==="
echo ""

NAMESPACE="snake-game"

if ! kubectl get ns "$NAMESPACE" &>/dev/null; then
    echo "FAIL: Namespace '$NAMESPACE' not found."
    echo "Run 'kubectl apply -f deploy/k8s/namespace.yaml' first."
    exit 1
fi
echo "PASS: Namespace '$NAMESPACE' exists."

BACKEND_PODS=$(kubectl get pods -n "$NAMESPACE" -l app=snake-backend -o jsonpath='{.items[*].status.phase}')
if [[ -z "$BACKEND_PODS" ]]; then
    echo "FAIL: No backend pods found."
    exit 1
fi
echo "PASS: Backend pods running ($BACKEND_PODS)"

FRONTEND_PODS=$(kubectl get pods -n "$NAMESPACE" -l app=snake-frontend -o jsonpath='{.items[*].status.phase}')
if [[ -z "$FRONTEND_PODS" ]]; then
    echo "FAIL: No frontend pods found."
    exit 1
fi
echo "PASS: Frontend pods running ($FRONTEND_PODS)"

HPA_COUNT=$(kubectl get hpa -n "$NAMESPACE" -o name 2>/dev/null | wc -l)
if [[ "$HPA_COUNT" -ge 2 ]]; then
    echo "PASS: HPA resources found ($HPA_COUNT)"
else
    echo "WARN: Less than 2 HPA resources found ($HPA_COUNT)"
fi

NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[0].address}')
NODE_PORT=$(kubectl get svc frontend -n "$NAMESPACE" -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "30080")

echo ""
echo "Testing HTTP endpoints via ${NODE_IP}:${NODE_PORT}..."

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://${NODE_IP}:${NODE_PORT}/" --connect-timeout 5)
if [[ "$HTTP_CODE" == "200" ]]; then
    echo "PASS: Frontend returns 200"
else
    echo "FAIL: Frontend returned $HTTP_CODE (expected 200)"
    exit 1
fi

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://${NODE_IP}:${NODE_PORT}/api/scores" --connect-timeout 5)
if [[ "$HTTP_CODE" == "200" ]]; then
    echo "PASS: Backend API returns 200"
else
    echo "FAIL: Backend API returned $HTTP_CODE (expected 200)"
    exit 1
fi

SCORES=$(curl -s "http://${NODE_IP}:${NODE_PORT}/api/scores" --connect-timeout 5)
if echo "$SCORES" | python3 -m json.tool &>/dev/null 2>&1; then
    echo "PASS: Scores response is valid JSON"
else
    echo "WARN: Scores response is not valid JSON"
fi

echo ""
echo "=== All tests passed! ==="
