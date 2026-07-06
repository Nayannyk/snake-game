output "namespace" {
  value = kubernetes_namespace.snake_game.metadata[0].name
}

output "backend_service" {
  value = kubernetes_service.backend.metadata[0].name
}

output "frontend_service" {
  value = kubernetes_service.frontend.metadata[0].name
}

output "frontend_node_port" {
  value = kubernetes_service.frontend.spec[0].port[0].node_port
}
