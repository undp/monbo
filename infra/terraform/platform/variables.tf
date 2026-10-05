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
