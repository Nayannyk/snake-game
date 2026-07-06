module "snake_game" {
  source = "../../"

  environment            = "dev"
  docker_registry        = "nayannyk"
  image_tag              = "develop"
  backend_replicas       = 1
  frontend_replicas      = 1
  backend_min_replicas   = 1
  backend_max_replicas   = 4
  frontend_min_replicas  = 1
  frontend_max_replicas  = 4
  kubeconfig_path        = "~/.kube/config"
  kubeconfig_context     = "kind-kind-workers"
  node_port              = 30081
}
