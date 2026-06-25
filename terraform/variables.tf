variable "environment" {
  description = "Deployment environment (dev, prod)"
  type        = string
  default     = "dev"
}

variable "kubeconfig_path" {
  description = "Path to kubeconfig file"
  type        = string
  default     = "~/.kube/config"
}

variable "kubeconfig_context" {
  description = "Kubeconfig context to use"
  type        = string
  default     = "kind-kind-workers"
}

variable "docker_registry" {
  description = "Docker registry (DockerHub username)"
  type        = string
  default     = "nayannyk"
}

variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

variable "backend_replicas" {
  description = "Backend replicas"
  type        = number
  default     = 2
}

variable "frontend_replicas" {
  description = "Frontend replicas"
  type        = number
  default     = 2
}

variable "backend_min_replicas" {
  description = "Minimum backend replicas (HPA)"
  type        = number
  default     = 2
}

variable "backend_max_replicas" {
  description = "Maximum backend replicas (HPA)"
  type        = number
  default     = 8
}

variable "frontend_min_replicas" {
  description = "Minimum frontend replicas (HPA)"
  type        = number
  default     = 2
}

variable "frontend_max_replicas" {
  description = "Maximum frontend replicas (HPA)"
  type        = number
  default     = 8
}

variable "node_port" {
  description = "NodePort for the frontend service"
  type        = number
  default     = 30080
}
