# The production environment, deployed from the main branch. The subscription comes from
# ARM_SUBSCRIPTION_ID (infra/envs/prod.secrets.env), not from this file.
env = "prod"
# Confirm against the regions the subscription's Azure Policy allows.
location = "eastus2"
# unique_suffix = ""  # only if monboproddata / monboprodacr are ever taken

# Where this environment's Terraform state lives (as in envs/prod.backend.hcl): its own
# account, in prod's subscription (infra/bootstrap.sh monboprodtfstate).
state_storage_account_name = "monboprodtfstate"
