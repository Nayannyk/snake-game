output "namespace" {
  value = module.app_deployment.namespace
}

output "backend_service" {
  value = module.app_deployment.backend_service
}

output "frontend_service" {
  value = module.app_deployment.frontend_service
}

output "frontend_node_port" {
  value = module.app_deployment.frontend_node_port
}
