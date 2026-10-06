# The dev environment, deployed from the dev branch. Secrets (and the subscription)
# come from infra/envs/dev.secrets.env or the GitHub Environment, never from this file.
env = "dev"

state_storage_account_name = "monbotfstate"

api_size = { cpu = 1, memory = "2Gi" }
web_size = { cpu = 0.5, memory = "1Gi" }

overlap_threshold_percentage          = 1
deforestation_threshold_percentage    = 2
show_testing_environment_warning      = true
max_requests_for_satellite_background = 90
contact_url                           = "mailto:contact@monbo.org"
