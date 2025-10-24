output "zone_id" {
  description = "Route53 hosted zone ID"
  value       = data.aws_route53_zone.main.zone_id
}

output "zone_name" {
  description = "Route53 hosted zone name"
  value       = data.aws_route53_zone.main.name
}

output "name_servers" {
  description = "Route53 name servers"
  value       = data.aws_route53_zone.main.name_servers
}

