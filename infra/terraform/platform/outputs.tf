# Read by the apps stack (terraform_remote_state) and by infra/deploy.sh and
# tools/layers-ops.

output "location" {
  value = var.location
}

# The environment's one group: where the apps stack and the scripts find everything.
output "resource_group_name" {
  value = local.group
}

output "storage_account_id" {
  value = azurerm_storage_account.data.id
}

output "storage_account_name" {
  value = azurerm_storage_account.data.name
}

output "maps_share_name" {
  value = azurerm_storage_share.maps.name
}

# Empty without the share backup (share_backup_enabled).
output "backup_vault_name" {
  value = var.share_backup_enabled ? azurerm_recovery_services_vault.backup[0].name : ""
}

output "registry_id" {
  value = azurerm_container_registry.main.id
}

output "registry_name" {
  value = azurerm_container_registry.main.name
}

output "registry_login_server" {
  value = azurerm_container_registry.main.login_server
}

# Whether the apps pull with the registry's admin user (until AcrPull is granted).
output "registry_admin_enabled" {
  value = var.registry_admin_enabled
}

output "log_analytics_workspace_id" {
  value = azurerm_log_analytics_workspace.main.id
}

# For the GitHub Environment's secrets (AZURE_CLIENT_ID, AZURE_TENANT_ID) and for the
# administrator's grant (docs/suggested_deployment.md#the-administrators-grants).
output "deploy_identity_client_id" {
  value = azurerm_user_assigned_identity.deploy.client_id
}

output "deploy_identity_principal_id" {
  value = azurerm_user_assigned_identity.deploy.principal_id
}

output "tenant_id" {
  value = data.azurerm_client_config.current.tenant_id
}
