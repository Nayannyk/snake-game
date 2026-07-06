# Snake Royale

Multiplayer snake game with bot AI, deployed on Kind Kubernetes with CI/CD pipeline.

## Architecture

- **Backend**: Node.js + Express + Socket.io + SQLite (better-sqlite3)
- **Frontend**: HTML5 Canvas + Vanilla JS + Socket.io client
- **Infrastructure**: AWS EC2 + Kind Kubernetes cluster with Ingress, HPA
- **CI/CD**: GitHub Actions, GitLab CI/CD, Jenkins
- **Container Registry**: DockerHub (`nayannyk/snake-backend`, `nayannyk/snake-frontend`)

## Project Structure

```
snake-game/
├── backend/                     # Node.js game server (Express + Socket.io)
├── frontend/                    # Client-side game (HTML5 Canvas)
├── deploy/
│   ├── k8s/                     # Kubernetes manifests + Kind config
│   └── docker-compose.yml       # Local dev (bypasses K8s)
├── scripts/                     # Build/deploy/test helpers
├── ci/                          # Jenkins pipeline configuration
├── infrastructure/
│   └── terraform/               # AWS EC2, security group, key pair
├── .github/workflows/           # GitHub Actions workflows
├── .gitlab-ci.yml               # GitLab CI/CD pipeline
├── Makefile
└── README.md
```

## Quick Start (Local Dev)

```bash
docker compose -f deploy/docker-compose.yml up --build
# Frontend: http://localhost:8080
# Backend:  http://localhost:3000
```

## Deploy to Local Kind Cluster

```bash
# 1. Create cluster
kind create cluster --config deploy/k8s/kind-config.yaml

# 2. Install ingress controller + metrics server
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.12.0/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s

# 3. Deploy the app
kubectl apply -f deploy/k8s/namespace.yaml
kubectl wait --for=jsonpath='{.status.phase}'=Active namespace/snake-game --timeout=30s
kubectl apply -f deploy/k8s/

# 4. Verify
kubectl get pods -n snake-game
curl -s http://localhost/
curl -s http://localhost/api/scores
```

## Deploy to AWS EC2 (via GitHub Actions)

The [`full-deploy.yml`](.github/workflows/full-deploy.yml) workflow:
1. Provisions an EC2 instance with Terraform (`infrastructure/terraform/`)
2. Bootstraps Docker, Kind, kubectl via user-data
3. Builds & pushes Docker images to DockerHub
4. Installs ingress controller on the Kind cluster
5. Deploys app manifests via kubectl
6. Runs smoke tests against the public IP

### Required secrets

| Secret | Purpose |
|--------|---------|
| `AWS_ACCESS_KEY_ID` | AWS credentials for Terraform |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials for Terraform |
| `DOCKER_USERNAME` | Docker Hub username |
| `DOCKER_PASSWORD` | Docker Hub access token |

### Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `environment` | `dev` | Environment label |
| `instance_type` | `t2.medium` | EC2 instance type |
| `key_name` | `""` | Existing EC2 KeyPair (empty = auto-generate) |

## CI/CD Pipelines

All pipelines share the same stages:
1. Unit Tests + Lint
2. Build & Push Docker Images
3. Deploy to Kind (namespace, ingress controller, manifests)
4. Rollout Verification
5. Smoke Test
6. Cleanup

### GitHub Actions

Config: [`.github/workflows/full-deploy.yml`](.github/workflows/full-deploy.yml)

Trigger: `workflow_dispatch` (manual) via GitHub UI.

### GitLab CI/CD

Config: [`.gitlab-ci.yml`](.gitlab-ci.yml)

Trigger: Automatic on push to `main` / `develop`. Requires a runner tagged `kind`.

### Jenkins

Config: [`ci/Jenkinsfile`](ci/Jenkinsfile) | [`ci/jenkins/snake-game-pipeline.xml`](ci/jenkins/snake-game-pipeline.xml)

Trigger: SCM poll every 5 min on `main` / `develop`. Agent must have Docker, Kind, kubectl, and a running Kind cluster.
