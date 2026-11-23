# The production environment, deployed from the main branch. The subscription comes from
# ARM_SUBSCRIPTION_ID (infra/envs/prod.secrets.env), not from this file.
env = "prod"
# East US, as agreed with UNDP (dev, and the variable's default, use eastus2).
location = "eastus"
# unique_suffix = ""  # only if monboproddata / monboprodacr are ever taken

# Where this environment's Terraform state lives (as in envs/prod.backend.hcl): its own
# account, in prod's subscription (infra/bootstrap.sh monboprodtfstate).
state_storage_account_name = "monboprodtfstate"
