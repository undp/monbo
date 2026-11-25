# prod's Terraform state account (infra/bootstrap.sh). Its resource group, the one
# UNDP granted, comes from TF_VAR_resource_group_name (infra/envs/prod.secrets.env),
# which infra/lib.sh passes with -backend-config: it isn't committed.
storage_account_name = "monboprodtfstate"
container_name       = "tfstate"
key                  = "prod/apps.tfstate"
