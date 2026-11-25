# dev's Terraform state account (infra/bootstrap.sh). Its resource group comes from
# TF_VAR_resource_group_name (infra/envs/dev.secrets.env), which infra/lib.sh passes
# with -backend-config.
storage_account_name = "monbodevtfstate"
container_name       = "tfstate"
key                  = "dev/apps.tfstate"
