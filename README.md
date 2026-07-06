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
├── infrastructure/              # AWS infrastructure as code
│   └── terraform/               #   EC2, security group, key pair for Kind host
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

### Local Development
- [Docker](https://docs.docker.com/get-docker/)
- [Kind](https://kind.sigs.k8s.io/docs/user/quick-start/#installation)
- [kubectl](https://kubernetes.io/docs/tasks/tools/#kubectl)
- [Helm](https://helm.sh/docs/intro/install/) (optional, for alternative metrics-server install)

### CI/CD Pipelines

Each pipeline needs its own setup. See the [CI/CD](#cicd) section below.

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

## Provision AWS Infrastructure (EC2 for Kind)

Use the Terraform config in [`infrastructure/terraform/`](infrastructure/terraform/) to spin up an EC2 instance that will host the Kind cluster. The instance comes pre-configured with Docker, Kind, kubectl, Terraform, and Helm via user-data.

### What it creates

| Resource | Detail |
|----------|--------|
| EC2 instance | Ubuntu 24.04, default `t3.medium` |
| Root volume | 20 GB gp3, encrypted |
| Security group | Opens ports: 22 (SSH), 80/443 (Ingress), 30080 (NodePort), 6443 (K8s API), 3000 (Backend) |
| Key pair | Uses existing PEM if `key_name` is provided, otherwise generates a new one |

### Usage

```bash
cd infrastructure/terraform

# Using an existing key pair:
terraform init
terraform apply -var="key_name=my-key-pair"

# Or let Terraform generate a new key pair:
terraform init
terraform apply
# The private key is in the output (sensitive):
terraform output private_key_pem > ~/.ssh/snake-game-kind-dev.pem
chmod 600 ~/.ssh/snake-game-kind-dev.pem

# SSH into the instance:
terraform output ssh_command
```

After SSH'ing in, deploy the cluster:

```bash
cd ~/snake-game
make cluster-create
make deploy
```

### Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `aws_region` | `ap-south-1` | AWS region |
| `environment` | `dev` | Environment label |
| `instance_type` | `t3.medium` | EC2 instance type |
| `root_volume_size` | `20` | Root volume in GB |
| `key_name` | `""` | Existing EC2 KeyPair name (leave empty to auto-generate) |
| `allowed_ssh_cidr` | `0.0.0.0/0` | CIDR allowed for SSH |
| `allowed_http_cidr` | `0.0.0.0/0` | CIDR allowed for HTTP/game access |

---

## Secrets Management

All three CI/CD pipelines require secrets to be stored in their respective secret stores. Below is the full list.

### Required secrets across all pipelines

| Secret | Purpose | Where to create |
|--------|---------|-----------------|
| `DOCKER_USERNAME` | Docker Hub username for pushing images | [Docker Hub](https://hub.docker.com) account |
| `DOCKER_PASSWORD` | Docker Hub access token or password | [Docker Hub → Account Settings → Security](https://hub.docker.com/settings/security) — create an **Access Token** |
| SSH private key | Access to the EC2 Kind host (for self-hosted runners) | Generated by Terraform or your existing PEM |

### Where to store them per pipeline

| Pipeline | Secret Store | How to configure |
|----------|-------------|------------------|
| **Jenkins** | Jenkins Credentials | `Dashboard → Manage Jenkins → Credentials → System → Global credentials → Add Credentials` |
| **GitHub Actions** | GitHub Secrets | `Repo → Settings → Secrets and variables → Actions → New repository secret` |
| **GitLab CI/CD** | GitLab CI/CD Variables | `Repo → Settings → CI/CD → Variables → Add variable` |

### Quick reference table

| Pipeline | DOCKER_USERNAME | DOCKER_PASSWORD | SSH Key (for runner → EC2) |
|----------|----------------|-----------------|---------------------------|
| **Jenkins** | Credential ID: `docker-hub-credentials` (Username with password) | Same credential | Add PEM to `~/.ssh/` on Jenkins agent |
| **GitHub Actions** | Secret name: `DOCKER_USERNAME` | Secret name: `DOCKER_PASSWORD` | Add PEM to self-hosted runner's `~/.ssh/` |
| **GitLab CI** | Variable key: `DOCKER_USERNAME` | Variable key: `DOCKER_PASSWORD` (masked) | Add PEM to runner's `~/.ssh/` |

## CI/CD

Three CI/CD pipelines are provided — one per VCS. Each pipeline builds Docker images, deploys to Kind via Terraform, and runs smoke tests.

| Branch | Pipeline | Config File |
|--------|----------|-------------|
| `main` | Jenkins | [`ci/Jenkinsfile`](ci/Jenkinsfile) |
| `github-actions` | GitHub Actions | [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) |
| `gitlab-ci` | GitLab CI/CD | [`.gitlab-ci.yml`](.gitlab-ci.yml) |

All pipelines share the same stages:
1. Unit Tests + Lint
2. Build & Push Docker Images to Docker Hub
3. Load Images into Kind
4. Terraform Init / Plan / Apply
5. Rollout Verification
6. Smoke Test
7. Cleanup

---

### Jenkins (`main` branch)

**Trigger:** Automatic — SCM poll every 5 min on `main` and `develop` branches.  
**Config:** [`ci/Jenkinsfile`](ci/Jenkinsfile) | [`ci/jenkins/snake-game-pipeline.xml`](ci/jenkins/snake-game-pipeline.xml)

#### What you need to set up in Jenkins

| Item | Value |
|------|-------|
| Pipeline definition | Pipeline script from SCM |
| SCM | Git, repo: `https://github.com/Nayannyk/snake-game.git` |
| Branch | `*/main` (or `*/develop`) |
| Script Path | `ci/Jenkinsfile` |
| Credentials | `docker-hub-credentials` (Docker Hub username + password/token) |
| Agent | Must have Docker, Kind, kubectl, Terraform installed and `kind` cluster running |

#### Trigger manually
```bash
# Via Jenkins UI: "Build Now"

# Or via CLI:
curl -X POST "http://<jenkins-url>/job/snake-game/job/main/build" --user user:token
```

---

### GitHub Actions (`github-actions` branch)

**Trigger:** Automatic on push/PR to `main` or `develop` branches.  
**Config:** [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)

#### What you need to set up in GitHub

| Item | Where | Value |
|------|-------|-------|
| `DOCKER_USERNAME` | Settings → Secrets & variables → Actions | Your Docker Hub username |
| `DOCKER_PASSWORD` | Settings → Secrets & variables → Actions | Docker Hub access token (or password) |
| Self-hosted runner | Settings → Actions → Runners | Linux runner with Docker, Kind, kubectl, Terraform, and a running `kind` cluster |

> **Note:** The `deploy` job runs on `self-hosted` — it will be skipped on GitHub-hosted runners. Only the `test` and `build-and-push` jobs run on `ubuntu-latest`. If you don't have a self-hosted runner, push is enough; deploy elsewhere.

#### Add a self-hosted runner

```bash
# On your Kind host machine:
# 1. Go to GitHub repo → Settings → Actions → Runners → "New self-hosted runner"
# 2. Follow the download & configure steps (Linux ×64)
# 3. Start the runner:
./run.sh
```

#### Trigger manually
```bash
# Push to the branch:
git checkout github-actions
git push origin github-actions

# Or via GitHub UI: Actions → "Deploy Snake Game" → "Run workflow"
```

---

### GitLab CI/CD (`gitlab-ci` branch)

**Trigger:** Automatic on push to `main` or `develop` branches.  
**Config:** [`.gitlab-ci.yml`](.gitlab-ci.yml)

#### What you need to set up in GitLab

| Item | Where | Value |
|------|-------|-------|
| `DOCKER_USERNAME` | Settings → CI/CD → Variables | Your Docker Hub username |
| `DOCKER_PASSWORD` | Settings → CI/CD → Variables | Docker Hub access token (masked) |
| Runner tagged `kind` | Settings → CI/CD → Runners | Linux runner with Docker, Kind, kubectl, Terraform, and a running `kind` cluster |

> **Note:** The deploy stages (`load-images`, `terraform-*`, `verify-*`, `smoke-test`) require a runner with the `kind` tag. Build stages use the default `docker:24` image and can run on any shared runner.

#### Add a runner with the `kind` tag

```bash
# On your Kind host machine:
# 1. Register a runner with tag "kind":
gitlab-runner register \
  --url https://gitlab.com \
  --registration-token <your-token> \
  --executor shell \
  --tag-list kind \
  --description "Kind K8s runner"
# 2. Start the runner:
gitlab-runner run
```

#### Trigger manually
```bash
# Push to the branch:
git checkout gitlab-ci
git push origin gitlab-ci

# Or via GitLab UI: CI/CD → Pipelines → "Run pipeline"
```
