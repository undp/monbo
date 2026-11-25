variable "env" {
  description = "Environment name (dev, prod...). Prefixes every resource name."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9]{1,7}$", var.env))
    error_message = "env must be 2-8 lowercase letters or digits, starting with a letter."
  }
}

variable "location" {
  description = "Azure region for every resource."
  type        = string
  default     = "eastus2"
}

# The storage account and registry names are global across Azure (they are DNS names)
# and can't contain hyphens: monbo<env>data, monbo<env>acr. Set a suffix only if one is
# taken, e.g. in a fork deployed to another organization's subscription.
variable "unique_suffix" {
  description = "Optional suffix for the globally unique storage account and registry names."
  type        = string
  default     = ""

  validation {
    condition     = can(regex("^[a-z0-9]{0,8}$", var.unique_suffix))
    error_message = "unique_suffix must be up to 8 lowercase letters or digits."
  }
}

variable "share_quota_gb" {
  description = "Quota of the maps share, in GiB."
  type        = number
  default     = 10
}

variable "log_retention_days" {
  description = "Days the Log Analytics workspace keeps logs."
  type        = number
  default     = 30
}

variable "github_repository" {
  description = "owner/name of the GitHub repository whose deploy workflow may use the deploy identity."
  type        = string
  default     = "undp/monbo"
}

# The environment's one resource group. It must exist: infra/bootstrap.sh creates it
# when the operators can (dev); otherwise it is the one granted (prod). Configuration of
# the environment, not of the repository: TF_VAR_resource_group_name, from
# infra/envs/<env>.secrets.env or the GitHub Environment.
variable "resource_group_name" {
  description = "The existing resource group every resource of the environment goes in. Read only: never modified or locked."
  type        = string
}

variable "registry_admin_enabled" {
  description = "Pull images with the registry's admin user. Only until an administrator grants AcrPull to the pull identity."
  type        = bool
  default     = false
}

variable "share_backup_enabled" {
  description = "Daily Azure Backup of the share (30 days). Configuring it puts a lock on the storage account, which needs more than Contributor."
  type        = bool
  default     = false
}
