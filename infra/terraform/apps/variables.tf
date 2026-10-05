variable "env" {
  description = "Environment name; must match the platform stack's."
  type        = string
}

# Where the platform stack keeps its state (same values as envs/<env>.backend.hcl).
variable "state_resource_group_name" {
  type    = string
  default = "monbo-tfstate"
}

variable "state_storage_account_name" {
  type = string
}

variable "state_container_name" {
  type    = string
  default = "tfstate"
}

# --- Images (set by infra/deploy.sh on every deploy) ---------------------------

variable "api_image" {
  description = "Full reference of the API image, e.g. <registry>/monbo-api:<sha>."
  type        = string
}

variable "web_image" {
  description = "Full reference of the web image, e.g. <registry>/monbo-front:<sha>."
  type        = string
}

# --- Sizes (valid Container Apps CPU/memory pairs) ------------------------------

variable "api_size" {
  description = "CPU and memory of the API container."
  type = object({
    cpu    = number
    memory = string
  })
  default = { cpu = 1, memory = "2Gi" }

  validation {
    condition = contains(
      ["0.25/0.5Gi", "0.5/1Gi", "0.75/1.5Gi", "1/2Gi", "1.25/2.5Gi", "1.5/3Gi", "1.75/3.5Gi", "2/4Gi"],
      "${var.api_size.cpu}/${var.api_size.memory}",
    )
    error_message = "api_size must be a Container Apps CPU/memory pair, e.g. 0.5/1Gi, 1/2Gi or 2/4Gi."
  }
}

variable "web_size" {
  description = "CPU and memory of the web container."
  type = object({
    cpu    = number
    memory = string
  })
  default = { cpu = 0.5, memory = "1Gi" }

  validation {
    condition = contains(
      ["0.25/0.5Gi", "0.5/1Gi", "0.75/1.5Gi", "1/2Gi", "1.25/2.5Gi", "1.5/3Gi", "1.75/3.5Gi", "2/4Gi"],
      "${var.web_size.cpu}/${var.web_size.memory}",
    )
    error_message = "web_size must be a Container Apps CPU/memory pair, e.g. 0.5/1Gi, 1/2Gi or 2/4Gi."
  }
}

# --- App settings ----------------------------------------------------------------

variable "overlap_threshold_percentage" {
  description = "Polygon overlap tolerance, 0-100. The API and the frontend get the same value."
  type        = number
  default     = 1
}

variable "deforestation_threshold_percentage" {
  description = "Deforestation percentage the frontend flags."
  type        = number
  default     = 1
}

variable "show_testing_environment_warning" {
  description = "Show the frontend's 'testing environment' banner."
  type        = bool
  default     = true
}

variable "max_requests_for_satellite_background" {
  description = "Cap on satellite background requests per deforestation image."
  type        = number
  default     = 210
}

variable "contact_url" {
  description = "Landing page 'Your country could be next' link (https: or mailto:); empty hides it."
  type        = string
  default     = ""
}

variable "admin_allowed_origin" {
  description = "Origin the admin routes accept. Defaults to the web app's Container Apps URL; set it for a custom domain."
  type        = string
  default     = null
}

# --- Secrets (TF_VAR_*; never in tfvars) -------------------------------------------

variable "gcp_maps_platform_api_key" {
  description = "Google Maps Platform key the API uses for satellite backgrounds."
  type        = string
  sensitive   = true
}

variable "gcp_maps_platform_signature_secret" {
  description = "Google Maps Platform URL-signing secret."
  type        = string
  sensitive   = true
}

variable "front_gcp_maps_platform_api_key" {
  description = "Browser-exposed Maps key for the frontend. Defaults to gcp_maps_platform_api_key."
  type        = string
  sensitive   = true
  default     = null
}

variable "admin_session_secret" {
  description = "Signs admin sessions. Unset: the layers admin is off."
  type        = string
  sensitive   = true
  default     = null

  validation {
    condition     = var.admin_session_secret == null || length(coalesce(var.admin_session_secret, "")) >= 32
    error_message = "admin_session_secret must be at least 32 characters."
  }
}
