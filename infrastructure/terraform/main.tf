locals {
  instance_name = "snake-game-kind-${var.environment}"
}

# ---------------------------------------------------------------------------
# Security group
# ---------------------------------------------------------------------------
resource "aws_security_group" "kind" {
  name_prefix = "${local.instance_name}-"
  description = "Security group for Kind K8s node running snake-game"
  vpc_id      = data.aws_vpc.default.id

  tags = merge(var.tags, {
    Name = local.instance_name
  })

  lifecycle {
    create_before_destroy = true
  }
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
# EC2 instance
# ---------------------------------------------------------------------------

data "aws_vpc" "default" {
  default = true
}

data "aws_ssm_parameter" "ubuntu_ami" {
  name = "/aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp2/ami-id"
}

data "aws_ec2_instance_type_offerings" "selected" {
  filter {
    name   = "instance-type"
    values = [var.instance_type]
  }

  location_type = "availability-zone"
}

data "aws_subnets" "compatible_default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }

  filter {
    name   = "default-for-az"
    values = ["true"]
  }

  filter {
    name   = "availability-zone"
    values = data.aws_ec2_instance_type_offerings.selected.locations
  }
}

resource "random_id" "key_suffix" {
  count       = var.key_name == "" ? 1 : 0
  byte_length = 4

  keepers = {
    environment   = var.environment
    instance_name = local.instance_name
  }
}

resource "tls_private_key" "default" {
  count     = var.key_name == "" ? 1 : 0
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "default" {
  count      = var.key_name == "" ? 1 : 0
  key_name   = "${local.instance_name}-${random_id.key_suffix[0].hex}-key"
  public_key = tls_private_key.default[0].public_key_openssh

  tags = merge(var.tags, {
    Name = "${local.instance_name}-${random_id.key_suffix[0].hex}-key"
  })
}

resource "aws_instance" "kind" {
  ami           = data.aws_ssm_parameter.ubuntu_ami.value
  instance_type = var.instance_type
  subnet_id     = sort(data.aws_subnets.compatible_default.ids)[length(data.aws_subnets.compatible_default.ids) - 1]
  key_name      = var.key_name != "" ? var.key_name : aws_key_pair.default[0].key_name

  vpc_security_group_ids = [aws_security_group.kind.id]

  associate_public_ip_address = true

  root_block_device {
    volume_size = var.root_volume_size
  }

  user_data = file("${path.module}/user-data.sh")

  tags = merge(var.tags, {
    Name = local.instance_name
  })

  timeouts {
    create = "10m"
  }

  lifecycle {
    precondition {
      condition     = length(data.aws_subnets.compatible_default.ids) > 0
      error_message = "No default subnet is available in an Availability Zone that supports the selected instance_type."
    }

    ignore_changes = [
      ami,
      user_data,
      user_data_base64,
    ]
  }
}
