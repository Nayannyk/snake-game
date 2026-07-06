# Snake Royale

Multiplayer snake game with bot AI, deployed on Kind Kubernetes with CI/CD pipeline.

## Architecture

- **Backend**: Node.js + Express + Socket.io + SQLite (better-sqlite3)
- **Frontend**: HTML5 Canvas + Vanilla JS + Socket.io client
- **Infrastructure**: Kind Kubernetes cluster with HPA, Ingress
- **CI/CD**: Jenkins pipeline with Terraform reusable modules
- **Container Registry**: DockerHub (`nayannyk/snake-backend`, `nayannyk/snake-frontend`)

## Project Structure

```
snake-game-kube/
├── backend/              # Node.js game server (Express + Socket.io)
│   ├── Dockerfile
│   ├── package.json
│   └── server.js
├── frontend/             # Client-side game (HTML5 Canvas)
│   ├── Dockerfile
│   ├── index.html
│   ├── nginx.conf
│   ├── script.js
│   └── style.css
├── kubernetes/           # K8s manifests
│   ├── namespace.yaml
│   ├── backend-deployment.yaml
│   ├── frontend-deployment.yaml
│   ├── hpa.yaml
│   └── ingress.yaml
├── terraform/            # Terraform reusable modules
│   ├── main.tf
│   ├── providers.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── modules/app-deployment/
│   └── environments/{dev,prod}/
├── scripts/              # Build/deploy/test helpers
│   ├── build.sh
│   ├── deploy.sh
│   └── test.sh
├── jenkins/              # Jenkins pipeline config
│   └── snake-game-pipeline.xml
├── docker-compose.yml    # Local dev (bypasses K8s)
├── Jenkinsfile           # CI/CD pipeline definition
└── README.md
```

## Game Features

- 3 difficulties: Easy, Medium, Hard
- Multiplayer (2 players, head-to-body collision kills)
- Solo mode vs AI bots (3+ bots, respawn on death)
- Infinite wrapping world (no walls)
- Snake-like graphics with eyes, pupils, food glow
- Mobile-friendly with joystick controls
- High scores via REST API

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Kind](https://kind.sigs.k8s.io/docs/user/quick-start/#installation)
- [kubectl](https://kubernetes.io/docs/tasks/tools/#kubectl)
- [Helm](https://helm.sh/docs/intro/install/) (optional, for alternative metrics-server install)

## Quick Start (Local Dev)

```bash
docker-compose up --build
# Frontend: http://localhost:8080
# Backend:  http://localhost:3000
```

## Deploy to Kind

### 1. Create Kind Cluster

```bash
kind create cluster --config kind-config.yaml
```

This creates a 3-node cluster with port 80 and 443 mapped from the host to `kind-worker`, so the ingress is accessible at `http://localhost`.

### 2. Label Worker Nodes for Ingress

```bash
kubectl label node kind-worker ingress-ready=true
kubectl label node kind-worker2 ingress-ready=true
```

### 3. Install NGINX Ingress Controller

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.12.0/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller --timeout=120s
```

### 4. Install Metrics Server (for HPA)

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl patch deployment metrics-server -n kube-system --type='json' \
  -p='[{"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--kubelet-insecure-tls"}]'
kubectl wait --namespace kube-system --for=condition=ready pod \
  --selector=k8s-app=metrics-server --timeout=120s
```

### 5. Deploy the Application

```bash
# One-shot deploy (builds images and runs Terraform)
./scripts/deploy.sh dev latest

# Or step by step:
kubectl apply -f kubernetes/namespace.yaml
kubectl apply -f kubernetes/backend-deployment.yaml
kubectl apply -f kubernetes/frontend-deployment.yaml
kubectl apply -f kubernetes/ingress.yaml
kubectl apply -f kubernetes/hpa.yaml
```

### 6. Verify

```bash
# Check all pods are running
kubectl get pods -n snake-game

# Check HPA picks up metrics (may take ~1 min)
kubectl get hpa -n snake-game

# Test endpoints via ingress
curl -s -o /dev/null -w "%{http_code}" http://localhost/
curl -s -o /dev/null -w "%{http_code}" http://localhost/api/scores
```

Open **http://localhost** in your browser to play.

## CI/CD Pipeline (Jenkins)

The Jenkinsfile defines 9 stages:
1. Checkout
2. Unit Tests
3. Build & Push Docker Images
4. Load Images into Kind
5. Terraform Init
6. Terraform Plan
7. Terraform Apply
8. Rollout Verification
9. Smoke Test
10. Cleanup

Triggers: every 5 min SCM poll on main/develop branches.
