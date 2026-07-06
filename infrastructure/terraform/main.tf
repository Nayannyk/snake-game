locals {
  instance_name = "snake-game-kind-${var.environment}"
}

# ---------------------------------------------------------------------------
# Security group
# ---------------------------------------------------------------------------
resource "aws_security_group" "kind" {
  name        = local.instance_name
  description = "Security group for Kind K8s node running snake-game"
  vpc_id      = data.aws_vpc.default.id

  tags = merge(var.tags, {
    Name = local.instance_name
  })
}

# SSH
resource "aws_vpc_security_group_ingress_rule" "ssh" {
  security_group_id = aws_security_group.kind.id
  cidr_ipv4         = var.allowed_ssh_cidr
  from_port         = 22
  to_port           = 22
  ip_protocol       = "tcp"
  description       = "SSH access"
}

# HTTP (Ingress / Kind port mapping 80)
resource "aws_vpc_security_group_ingress_rule" "http" {
  security_group_id = aws_security_group.kind.id
  cidr_ipv4         = var.allowed_http_cidr
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
  description       = "HTTP - Game frontend via Ingress"
}

# HTTPS (Ingress / Kind port mapping 443)
resource "aws_vpc_security_group_ingress_rule" "https" {
  security_group_id = aws_security_group.kind.id
  cidr_ipv4         = var.allowed_http_cidr
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  description       = "HTTPS - Game frontend via Ingress"
}

# NodePort range (frontend exposed on 30080)
resource "aws_vpc_security_group_ingress_rule" "nodeport" {
  security_group_id = aws_security_group.kind.id
  cidr_ipv4         = var.allowed_http_cidr
  from_port         = 30080
  to_port           = 30080
  ip_protocol       = "tcp"
  description       = "K8s NodePort - direct frontend access"
}

# Kubernetes API server (optional - for remote kubectl)
resource "aws_vpc_security_group_ingress_rule" "kube_api" {
  security_group_id = aws_security_group.kind.id
  cidr_ipv4         = var.allowed_ssh_cidr
  from_port         = 6443
  to_port           = 6443
  ip_protocol       = "tcp"
  description       = "Kubernetes API server"
}

# Backend API direct access (optional)
resource "aws_vpc_security_group_ingress_rule" "backend" {
  security_group_id = aws_security_group.kind.id
  cidr_ipv4         = var.allowed_http_cidr
  from_port         = 3000
  to_port           = 3000
  ip_protocol       = "tcp"
  description       = "Backend API direct access"
}

# Allow all outbound traffic
resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.kind.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
  description       = "Allow all outbound traffic"
}

# ---------------------------------------------------------------------------
# Key pair (generated only if key_name not provided)
# ---------------------------------------------------------------------------
resource "tls_private_key" "kind" {
  count     = var.key_name == "" ? 1 : 0
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "kind" {
  count      = var.key_name == "" ? 1 : 0
  key_name   = "${local.instance_name}-${formatdate("YYYYMMDDhhmmss", timestamp())}"
  public_key = tls_private_key.kind[0].public_key_openssh

  tags = var.tags
}

# ---------------------------------------------------------------------------
# EC2 instance
# ---------------------------------------------------------------------------
data "aws_ami" "ubuntu" {
  most_recent = true
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-24.04-*"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
  owners = ["099720109477"]
}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

resource "aws_instance" "kind" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = data.aws_subnets.default.ids[0]
  vpc_security_group_ids = [aws_security_group.kind.id]
  key_name               = var.key_name != "" ? var.key_name : aws_key_pair.kind[0].key_name

  associate_public_ip_address = true

  root_block_device {
    volume_size = var.root_volume_size
    volume_type = "gp3"
    encrypted   = true
  }

  user_data = file("${path.module}/user-data.sh")

  tags = merge(var.tags, {
    Name = local.instance_name
  })
}
