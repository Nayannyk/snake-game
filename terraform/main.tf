locals {
  effective_image_tag = var.image_tag != "" ? var.image_tag : var.environment == "prod" ? "stable" : "latest"
}

module "app_deployment" {
  source = "./modules/app-deployment"

  environment        = var.environment
  docker_registry    = var.docker_registry
  image_tag          = local.effective_image_tag
  backend_replicas   = var.backend_replicas
  frontend_replicas  = var.frontend_replicas
  backend_min_replicas  = var.backend_min_replicas
  backend_max_replicas  = var.backend_max_replicas
  frontend_min_replicas = var.frontend_min_replicas
  frontend_max_replicas = var.frontend_max_replicas
  node_port          = var.node_port
}
