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
# REMOVED: Access should go through Ingress (port 80), not directly via NodePort

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

resource "random_id" "key_suffix" {
  count       = var.key_name == "" ? 1 : 0
  byte_length = 4
}

resource "aws_key_pair" "kind" {
  count      = var.key_name == "" ? 1 : 0
  key_name   = "${local.instance_name}-${random_id.key_suffix[0].hex}"
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
    values = ["ubuntu/images/hvm-ssd*/ubuntu-*-24.04-amd64-server-*"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
  filter {
    name   = "architecture"
    values = ["x86_64"]
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
  }

  # Test: remove user_data to see if instance launches without it
  # user_data = file("${path.module}/user-data.sh")

  tags = merge(var.tags, {
    Name = local.instance_name
  })

  lifecycle {
    ignore_changes = [
      ami,
      user_data,
      user_data_base64,
    ]
  }
}
