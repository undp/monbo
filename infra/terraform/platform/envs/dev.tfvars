# The dev environment, deployed from the dev branch. The subscription comes from
# ARM_SUBSCRIPTION_ID and its resource group from TF_VAR_resource_group_name
# (infra/envs/dev.secrets.env), not from this file.
#
# dev is the test environment of prod: the same layout and the same switches, so what
# dev deploys is what prod will run (envs/prod.tfvars).
env      = "dev"
location = "eastus"
# unique_suffix = ""  # only if monbodevdata / monbodevacr are ever taken

# Set to false once monbo-dev-pull holds AcrPull, then apply this stack and deploy.
registry_admin_enabled = true
# As in prod, no Azure Backup: the layers can be seeded again from Git.
share_backup_enabled = false
