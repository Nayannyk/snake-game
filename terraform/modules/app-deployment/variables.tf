variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "docker_registry" {
  description = "Docker registry URL (e.g., nayannyk)"
  type        = string
}

variable "image_tag" {
  description = "Docker image tag"
  type        = string
  default     = "latest"
}

variable "backend_replicas" {
  description = "Number of backend replicas"
  type        = number
  default     = 2
}

variable "frontend_replicas" {
  description = "Number of frontend replicas"
  type        = number
  default     = 2
}

variable "backend_min_replicas" {
  description = "Minimum backend replicas for HPA"
  type        = number
  default     = 2
}

variable "backend_max_replicas" {
  description = "Maximum backend replicas for HPA"
  type        = number
  default     = 8
}

variable "frontend_min_replicas" {
  description = "Minimum frontend replicas for HPA"
  type        = number
  default     = 2
}

variable "frontend_max_replicas" {
  description = "Maximum frontend replicas for HPA"
  type        = number
  default     = 8
}

variable "node_port" {
  description = "NodePort for the frontend service"
  type        = number
  default     = 30080
}
