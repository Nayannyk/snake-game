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
snake-game/
├── backend/                     # Node.js game server (Express + Socket.io)
│   ├── Dockerfile
│   ├── package.json
│   └── server.js
├── frontend/                    # Client-side game (HTML5 Canvas)
│   ├── Dockerfile
│   ├── index.html
│   ├── nginx.conf
│   ├── script.js
│   └── style.css
├── deploy/                      # All deployment & infrastructure artifacts
│   ├── k8s/                     # Kubernetes manifests + Kind config
│   │   ├── namespace.yaml
│   │   ├── backend-deployment.yaml
│   │   ├── frontend-deployment.yaml
│   │   ├── hpa.yaml
│   │   ├── ingress.yaml
│   │   └── kind-config.yaml
│   ├── terraform/               # Infrastructure as Code (Terraform)
│   │   ├── main.tf
│   │   ├── providers.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   ├── modules/app-deployment/
│   │   └── environments/{dev,prod}/
│   └── docker-compose.yml       # Local dev (bypasses K8s)
├── scripts/                     # Build/deploy/test helpers
│   ├── build.sh
│   ├── deploy.sh
│   └── test.sh
├── ci/                          # CI/CD pipeline configuration
│   ├── Jenkinsfile
│   └── jenkins/
│       └── snake-game-pipeline.xml
├── Makefile                     # Standard build automation
├── .gitignore
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
# Using Make:
make dev

# Or directly:
docker compose -f deploy/docker-compose.yml up --build
# Frontend: http://localhost:8080
# Backend:  http://localhost:3000
```

## Deploy to Kind

### 1. Create Kind Cluster (one command)

```bash
make cluster-create
```

This creates a 3-node Kind cluster with port 80/443 mapped to the host, installs the NGINX Ingress Controller, and deploys the Metrics Server for HPA support.

### 2. Deploy the Application

```bash
# Via Makefile:
make deploy

# Or step by step with raw kubectl:
kubectl apply -f deploy/k8s/namespace.yaml
kubectl apply -f deploy/k8s/backend-deployment.yaml
kubectl apply -f deploy/k8s/frontend-deployment.yaml
kubectl apply -f deploy/k8s/ingress.yaml
kubectl apply -f deploy/k8s/hpa.yaml
```

### 3. Verify

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

### Other Make Targets

| Target           | Description                              |
|------------------|------------------------------------------|
| `make build`     | Build and push Docker images             |
| `make deploy`    | Deploy to Kind via Terraform             |
| `make test`      | Run smoke tests                          |
| `make dev`       | Run locally with Docker Compose          |
| `make cluster-delete` | Delete the Kind cluster             |

## CI/CD Pipeline (Jenkins)

Pipeline definition: [`ci/Jenkinsfile`](ci/Jenkinsfile)

Defines 10 stages:
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
