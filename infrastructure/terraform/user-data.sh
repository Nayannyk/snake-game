#!/bin/bash
set -euo pipefail

# ---------------------------------------------------------------
# Bootstrap script for the Kind K8s host
# Installs: Docker, Kind, kubectl, Terraform, Helm, NGINX Ingress
# ---------------------------------------------------------------
export DEBIAN_FRONTEND=noninteractive

echo ">>> Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

echo ">>> Installing dependencies..."
apt-get install -y -qq \
  apt-transport-https \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  git \
  jq \
  unzip

# ---------------------------------------------------------------
# Docker
# ---------------------------------------------------------------
if ! command -v docker &>/dev/null; then
  echo ">>> Installing Docker..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  usermod -aG docker ubuntu
  systemctl enable docker
fi

# ---------------------------------------------------------------
# Kind
# ---------------------------------------------------------------
KIND_VERSION="v0.27.0"
if ! command -v kind &>/dev/null; then
  echo ">>> Installing Kind ${KIND_VERSION}..."
  curl -sLo /usr/local/bin/kind "https://kind.sigs.k8s.io/dl/${KIND_VERSION}/kind-linux-amd64"
  chmod +x /usr/local/bin/kind
fi

# ---------------------------------------------------------------
# kubectl
# ---------------------------------------------------------------
KUBECTL_VERSION="$(curl -sL https://dl.k8s.io/release/stable.txt)"
if ! command -v kubectl &>/dev/null; then
  echo ">>> Installing kubectl ${KUBECTL_VERSION}..."
  curl -sLo /usr/local/bin/kubectl "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl"
  chmod +x /usr/local/bin/kubectl
fi

# ---------------------------------------------------------------
# Terraform
# ---------------------------------------------------------------
TERRAFORM_VERSION="1.11.3"
if ! command -v terraform &>/dev/null; then
  echo ">>> Installing Terraform ${TERRAFORM_VERSION}..."
  curl -sLo /tmp/terraform.zip "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip"
  unzip -q /tmp/terraform.zip -d /usr/local/bin/
  rm /tmp/terraform.zip
fi

# ---------------------------------------------------------------
# Helm (optional)
# ---------------------------------------------------------------
if ! command -v helm &>/dev/null; then
  echo ">>> Installing Helm..."
  curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
fi

# ---------------------------------------------------------------
# Clone repo & deploy
# ---------------------------------------------------------------
if [ ! -d /home/ubuntu/snake-game ]; then
  echo ">>> Cloning snake-game repo..."
  su - ubuntu -c "git clone https://github.com/Nayannyk/snake-game.git /home/ubuntu/snake-game"
  chown -R ubuntu:ubuntu /home/ubuntu/snake-game
fi

echo ">>> Bootstrap complete!"
echo ">>> Log out and back in (or run 'newgrp docker') for Docker group to take effect."
echo ">>> Then run: cd ~/snake-game && make cluster-create && make deploy"
