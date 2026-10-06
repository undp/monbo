# The Terraform state account (infra/bootstrap.sh).
resource_group_name  = "monbo-tfstate"
storage_account_name = "monbotfstate"
container_name       = "tfstate"
key                  = "dev/apps.tfstate"
