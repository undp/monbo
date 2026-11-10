# The dev environment, deployed from the dev branch. The subscription comes from
# ARM_SUBSCRIPTION_ID (infra/envs/dev.secrets.env), not from this file.
env      = "dev"
location = "eastus2"
# unique_suffix = ""  # only if monbodevdata / monbodevacr are ever taken

# Where this environment's Terraform state lives (as in envs/dev.backend.hcl).
state_storage_account_name = "monbotfstate"
