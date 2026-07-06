.PHONY: build deploy test cluster-create cluster-delete dev help

build:
	./scripts/build.sh

deploy:
	./scripts/deploy.sh

test:
	./scripts/test.sh

cluster-create:
	kind create cluster --config deploy/k8s/kind-config.yaml
	kubectl label node kind-worker ingress-ready=true
	kubectl label node kind-worker2 ingress-ready=true
	kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.12.0/deploy/static/provider/kind/deploy.yaml
	kubectl wait --namespace ingress-nginx --for=condition=ready pod \
	  --selector=app.kubernetes.io/component=controller --timeout=120s
	kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
	kubectl patch deployment metrics-server -n kube-system --type='json' \
	  -p='[{"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--kubelet-insecure-tls"}]'
	kubectl wait --namespace kube-system --for=condition=ready pod \
	  --selector=k8s-app=metrics-server --timeout=120s

cluster-delete:
	kind delete cluster

dev:
	docker compose -f deploy/docker-compose.yml up --build

help:
	@echo "Targets:"
	@echo "  build          - Build Docker images"
	@echo "  deploy         - Deploy to Kind via Terraform"
	@echo "  test           - Run smoke tests"
	@echo "  cluster-create - Create Kind cluster with ingress + metrics-server"
	@echo "  cluster-delete - Delete Kind cluster"
	@echo "  dev            - Run locally with Docker Compose"
