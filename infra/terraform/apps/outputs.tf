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
  value = azurerm_resource_group.apps.name
}

output "api_app_name" {
  value = azurerm_container_app.api.name
}

output "web_app_name" {
  value = azurerm_container_app.web.name
}
