output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.kind.id
}

output "public_ip" {
  description = "Public IP of the Kind host"
  value       = aws_instance.kind.public_ip
}

output "public_dns" {
  description = "Public DNS of the Kind host"
  value       = aws_instance.kind.public_dns
}

output "security_group_id" {
  description = "Security group ID"
  value       = aws_security_group.kind.id
}

output "ssh_command" {
  description = "SSH command to connect to the instance"
  value       = "ssh -i <key> ubuntu@${aws_instance.kind.public_ip}"
}

output "game_url" {
  description = "URL to access the game"
  value       = "http://${aws_instance.kind.public_ip}"
}

output "key_pair_name" {
  description = "Name of the SSH key pair"
  value       = var.key_name != "" ? var.key_name : aws_key_pair.default[0].key_name
}

output "private_key_pem" {
  description = "Terraform-generated private key PEM. Empty when an external key_name is provided."
  value       = var.key_name == "" ? tls_private_key.default[0].private_key_pem : ""
  sensitive   = true
}
