terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    # Partial configuration — bucket, key, region passed via -backend-config
  }
}

provider "aws" {
  region = var.aws_region
}
