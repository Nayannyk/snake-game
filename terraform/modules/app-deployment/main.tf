resource "kubernetes_namespace" "snake_game" {
  metadata {
    name = "snake-game"
  }
}

resource "kubernetes_deployment" "backend" {
  metadata {
    name      = "snake-backend"
    namespace = kubernetes_namespace.snake_game.metadata[0].name
    labels = {
      app = "snake-backend"
    }
  }

  spec {
    replicas = var.backend_replicas

    selector {
      match_labels = {
        app = "snake-backend"
      }
    }

    template {
      metadata {
        labels = {
          app = "snake-backend"
        }
      }

      spec {
        container {
          name              = "backend"
          image             = "${var.docker_registry}/snake-backend:${var.image_tag}"
          image_pull_policy = "Always"

          port {
            container_port = 3000
          }

          env {
            name  = "PORT"
            value = "3000"
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "64Mi"
            }
            limits = {
              cpu    = "300m"
              memory = "128Mi"
            }
          }

          liveness_probe {
            http_get {
              path = "/health"
              port = 3000
            }
            initial_delay_seconds = 5
            period_seconds        = 10
          }

          readiness_probe {
            http_get {
              path = "/health"
              port = 3000
            }
            initial_delay_seconds = 3
            period_seconds        = 5
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "backend" {
  metadata {
    name      = "backend"
    namespace = kubernetes_namespace.snake_game.metadata[0].name
  }

  spec {
    selector = {
      app = "snake-backend"
    }

    port {
      port        = 3000
      target_port = 3000
    }

    type = "ClusterIP"
  }
}

resource "kubernetes_deployment" "frontend" {
  metadata {
    name      = "snake-frontend"
    namespace = kubernetes_namespace.snake_game.metadata[0].name
    labels = {
      app = "snake-frontend"
    }
  }

  spec {
    replicas = var.frontend_replicas

    selector {
      match_labels = {
        app = "snake-frontend"
      }
    }

    template {
      metadata {
        labels = {
          app = "snake-frontend"
        }
      }

      spec {
        container {
          name              = "frontend"
          image             = "${var.docker_registry}/snake-frontend:${var.image_tag}"
          image_pull_policy = "Always"

          port {
            container_port = 80
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "64Mi"
            }
            limits = {
              cpu    = "300m"
              memory = "128Mi"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "frontend" {
  metadata {
    name      = "frontend"
    namespace = kubernetes_namespace.snake_game.metadata[0].name
  }

  spec {
    selector = {
      app = "snake-frontend"
    }

    port {
      port        = 80
      target_port = 80
      node_port   = var.node_port
    }

    type = "NodePort"
  }
}

resource "kubernetes_horizontal_pod_autoscaler_v2" "backend_hpa" {
  metadata {
    name      = "snake-backend-hpa"
    namespace = kubernetes_namespace.snake_game.metadata[0].name
  }

  spec {
    scale_target_ref {
      api_version = "apps/v1"
      kind        = "Deployment"
      name        = kubernetes_deployment.backend.metadata[0].name
    }

    min_replicas = var.backend_min_replicas
    max_replicas = var.backend_max_replicas

    metric {
      type = "Resource"
      resource {
        name = "cpu"
        target {
          type                = "Utilization"
          average_utilization = 50
        }
      }
    }

    metric {
      type = "Resource"
      resource {
        name = "memory"
        target {
          type                = "Utilization"
          average_utilization = 70
        }
      }
    }
  }
}

resource "kubernetes_horizontal_pod_autoscaler_v2" "frontend_hpa" {
  metadata {
    name      = "snake-frontend-hpa"
    namespace = kubernetes_namespace.snake_game.metadata[0].name
  }

  spec {
    scale_target_ref {
      api_version = "apps/v1"
      kind        = "Deployment"
      name        = kubernetes_deployment.frontend.metadata[0].name
    }

    min_replicas = var.frontend_min_replicas
    max_replicas = var.frontend_max_replicas

    metric {
      type = "Resource"
      resource {
        name = "cpu"
        target {
          type                = "Utilization"
          average_utilization = 50
        }
      }
    }

    metric {
      type = "Resource"
      resource {
        name = "memory"
        target {
          type                = "Utilization"
          average_utilization = 70
        }
      }
    }
  }
}
