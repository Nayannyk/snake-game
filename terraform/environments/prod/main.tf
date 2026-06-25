module "snake_game" {
  source = "../../"

  environment            = "prod"
  docker_registry        = "nayannyk"
  image_tag              = "stable"
  backend_replicas       = 3
  frontend_replicas      = 3
  backend_min_replicas   = 3
  backend_max_replicas   = 10
  frontend_min_replicas  = 3
  frontend_max_replicas  = 10
  kubeconfig_path        = "~/.kube/config"
  kubeconfig_context     = "kind-kind-workers"
  node_port              = 30080
}
