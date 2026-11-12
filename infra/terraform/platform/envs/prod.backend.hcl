# The Terraform state account of prod (infra/bootstrap.sh monboprodtfstate).
resource_group_name  = "monbo-tfstate"
storage_account_name = "monboprodtfstate"
container_name       = "tfstate"
key                  = "prod/platform.tfstate"
