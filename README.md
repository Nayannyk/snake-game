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

## Quick Start (Local Dev)

```bash
docker-compose up --build
# Frontend: http://localhost:8080
# Backend:  http://localhost:3000
```

## Deploy to Kind

```bash
# One-shot deploy
./scripts/deploy.sh dev latest

# Or step by step:
# 1. Build & push images
./scripts/build.sh latest
# 2. Load into Kind
kind load docker-image nayannyk/snake-backend:latest --name kind-workers
kind load docker-image nayannyk/snake-frontend:latest --name kind-workers
# 3. Apply with Terraform
cd terraform/environments/dev
terraform init -reconfigure
terraform plan -var="image_tag=latest" -out=tfplan
terraform apply -auto-approve tfplan
# 4. Verify
kubectl rollout status deployment/snake-backend -n snake-game
kubectl rollout status deployment/snake-frontend -n snake-game
```

## Prerequisites — Secrets & Credentials

Before running CI/CD, create these secrets in the respective tools:

### Jenkins (Manage Jenkins → Credentials)
| ID | Type | Purpose |
|---|---|---|
| `docker-hub-credentials` | Username with password | Push images to Docker Hub |
| `github-credentials` | Secret text (GitHub PAT) | Checkout code from GitHub |
| `team@example.com` | (update in Jenkinsfile) | Email notifications on build |

### Jenkins (pipeline config)
- **Auth Token**: `snake-game-pipeline-token` — used for triggering the pipeline via webhook.

### Docker Hub
- Account with push access to `nayannyk/snake-backend` and `nayannyk/snake-frontend` repos.

### GitHub
- **Personal Access Token** with `repo` scope — used by Jenkins to clone the repo.

### Kubernetes (Kind)
- No cloud secrets needed for local Kind clusters.
- For production EKS: configure AWS credentials (`aws configure`) and update `kubeconfig_context` in `terraform/variables.tf`.

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
