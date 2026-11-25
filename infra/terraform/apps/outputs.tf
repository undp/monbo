output "api_url" {
  value = local.api_url
}

output "web_url" {
  value = local.web_url
}

output "default_domain" {
  value = azurerm_container_app_environment.main.default_domain
}

output "resource_group_name" {
  value = local.group
}

# For the administrator's AcrPull grant (docs/suggested_deployment.md#production).
output "pull_identity_principal_id" {
  value = azurerm_user_assigned_identity.pull.principal_id
}

output "api_app_name" {
  value = azurerm_container_app.api.name
}

output "web_app_name" {
  value = azurerm_container_app.web.name
}
