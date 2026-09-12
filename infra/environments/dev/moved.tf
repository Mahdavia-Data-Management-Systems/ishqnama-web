# The former single `aca` module (environment + app) was split into `aca-environment` and
# `aca-app`. These blocks re-address the existing resources in state so the running Postgres
# environment and app are neither destroyed nor recreated. Safe to delete once every workspace
# using this configuration has applied the split.

moved {
  from = module.aca.azurerm_log_analytics_workspace.this
  to   = module.aca_environment.azurerm_log_analytics_workspace.this
}

moved {
  from = module.aca.azurerm_container_app_environment.this
  to   = module.aca_environment.azurerm_container_app_environment.this
}

moved {
  from = module.aca.azurerm_container_app.this
  to   = module.db.azurerm_container_app.this
}
