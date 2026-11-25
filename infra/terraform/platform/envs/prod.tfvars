# The production environment, deployed from the main branch. The subscription comes from
# ARM_SUBSCRIPTION_ID and its resource group from TF_VAR_resource_group_name
# (infra/envs/prod.secrets.env), not from this file.
env = "prod"
# East US, as agreed with UNDP.
location = "eastus"
# unique_suffix = ""  # only if monboproddata / monboprodacr are ever taken

# Set to false once monbo-prod-pull holds AcrPull, then apply this stack and deploy.
registry_admin_enabled = true
# Set to true once the operator can configure Azure Files backup on monboproddata
# (Storage Account Backup Contributor), then apply this stack.
share_backup_enabled = false
