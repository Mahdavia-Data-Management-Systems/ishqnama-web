# Infrastructure

Terraform for the Ishqnama Azure footprint. `environments/dev` and `environments/prod` are
identical in shape and differ only in names, hostnames and image tags; `environments/cloudflare`
manages the `ishqnama.com` zone. Everything runs on free tiers, so each environment has its own
dedicated Azure subscription (the Cosmos DB free tier and the Container Apps monthly grant are
per subscription).

Terraform creates the resource group, Key Vault, Static Web App, Container Apps environment and
app (API plus Postgres sidecar), Log Analytics workspace and Cosmos DB account. Everything below
is **not** in Terraform and has to be done by hand once per environment. `<env>` is `dev` or
`prod`; the examples use prod.

## 1. Azure subscription

Create (or pick) a subscription dedicated to the environment and note its ID. Sign in to the
tenant that owns it:

```bash
az login --tenant <tenant-id>
az account set --subscription <subscription-id>
```

### Register the resource providers

The azurerm provider registers missing providers itself at the start of a run, but on a fresh
subscription that can add several minutes to the first apply, so register them ahead of time:

```bash
for ns in Microsoft.KeyVault Microsoft.Web Microsoft.App Microsoft.OperationalInsights Microsoft.DocumentDB; do
  az provider register --namespace $ns --wait
done
# Should print nothing
az provider list \
  --query "[?registrationState!='Registered' && contains('Microsoft.KeyVault Microsoft.Web Microsoft.App Microsoft.OperationalInsights Microsoft.DocumentDB', namespace)].namespace" \
  -o tsv
```

| Terraform resources                       | Provider namespace              |
| ----------------------------------------- | ------------------------------- |
| Resource group                            | `Microsoft.Resources` (default) |
| Key Vault and secrets                     | `Microsoft.KeyVault`            |
| Static Web App                            | `Microsoft.Web`                 |
| Container Apps environment and app        | `Microsoft.App`                 |
| Log Analytics workspace                   | `Microsoft.OperationalInsights` |
| Cosmos DB account, database and container | `Microsoft.DocumentDB`          |

## 2. Service principal for GitHub Actions

CI authenticates to Azure with OIDC (no client secret) as the app registration **`sp-mdms-github`**,
which is shared by every environment. Adding an environment means giving that one registration a
federated credential for the new GitHub environment and a role on the new subscription.

1. **Client ID**: Entra ID, App registrations, `sp-mdms-github`. Note the application (client) ID
   and the tenant ID for step 3.
2. **Federated credential**: on `sp-mdms-github`, Certificates & secrets, Federated credentials,
   Add credential, scenario *GitHub Actions deploying Azure resources*:
   - Organization: `Mahdavia-Data-Management-Systems`
   - Repository: `ishqnama-web`
   - Entity type: **Environment**, name `prod`
   - The resulting subject is `repo:Mahdavia-Data-Management-Systems/ishqnama-web:environment:prod`
     and the audience is `api://AzureADTokenExchange`. The dev credential is the same with
     `environment:dev`.
3. **Role assignment**: grant `sp-mdms-github` **Contributor** on the environment's subscription.
   Contributor is sufficient: Terraform creates no role assignments and the Key Vault uses access
   policies, not RBAC. Using the object ID avoids ambiguity between the app registration and its
   service principal:

   ```bash
   SP_OBJECT_ID=$(az ad sp list --display-name sp-mdms-github --query "[0].id" -o tsv)
   az role assignment create \
     --assignee-object-id "$SP_OBJECT_ID" \
     --assignee-principal-type ServicePrincipal \
     --role Contributor \
     --scope /subscriptions/<subscription-id>
   ```

   Role assignments can take a couple of minutes to propagate.

The same identity is used by `deploy-frontend.yml` to read the SWA app settings and the
`swa-deployment-token` secret from Key Vault. Terraform grants that Key Vault access policy to
whichever identity ran the apply, so keep the infra and frontend jobs on the same service
principal.

## 3. GitHub environment

Create the GitHub environment `prod` (repository Settings, Environments) and add:

| Kind     | Name                    | Value                                               |
| -------- | ----------------------- | --------------------------------------------------- |
| Variable | `AZURE_CLIENT_ID`       | Client ID of `sp-mdms-github` (step 2)              |
| Variable | `AZURE_TENANT_ID`       | Tenant ID of the subscription                       |
| Variable | `AZURE_SUBSCRIPTION_ID` | Subscription ID from step 1                         |
| Variable | `DOCKERHUB_USERNAME`    | Docker Hub user with pull access to `ishqnama-db`   |
| Variable | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID                               |
| Secret   | `DOCKERHUB_TOKEN`       | Docker Hub access token                             |
| Secret   | `CLOUDFLARE_API_TOKEN`  | Cloudflare token with `Zone:Read` on `ishqnama.com` |
| Secret   | `TF_API_TOKEN`          | Terraform Cloud token (see step 4)                  |

Variables map to `TF_VAR_*` in `deploy-infra.yml` and `destroy-infra.yml`. The workflows apply
with `-auto-approve`, so what keeps an unintended change away from Azure is the environment's
own protection — a required reviewer and a deployment branch policy. See **Repository
protection** below.

## Repository protection

The repository is public and every deploy job applies with `-auto-approve`, so the settings below
are what stop an unintended change from reaching Azure and costing money. None of them live in
Terraform; they are GitHub settings, recorded here so they can be recreated. `$R` is
`Mahdavia-Data-Management-Systems/ishqnama-web`.

**Deployment branch policies — the control that matters most.** Each environment (`dev`, `prod`,
`cloudflare`) allows deployments from `main` only. Because the federated credential subject is
`...:environment:<env>` (step 2), an environment restricted to `main` means no other ref can mint
an Azure token, read an environment variable, or even start the job — the run is blocked before
its first step. Recreate with:

```bash
gh api -X PUT repos/$R/environments/<env> --input - <<'JSON'
{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}
JSON
gh api -X POST repos/$R/environments/<env>/deployment-branch-policies -f name=main -f type=branch
```

A `PUT` on an environment replaces its protection rules, so re-send `"reviewers"` in the same call
for `prod` or the required reviewer is silently wiped.

**Required reviewer on `prod`.** `prod` additionally requires a review before any deployment job
starts, which is what makes `prod-release.yml` park on "Review pending" before it applies.
`prevent_self_review` stays `false`: the sole maintainer is also the only reviewer.

**Every apply runs inside an environment.** `deploy-cloudflare-zone.yml` used to be the exception;
it now declares `environment: cloudflare`. Any new workflow that applies Terraform, pushes an
image or deploys the SWA must declare an environment, or it inherits none of the above.

**Actions allowlist.** Only GitHub-owned actions plus `docker/*`, `Azure/*`,
`hashicorp/setup-terraform@*` and `dorny/paths-filter@*` may run, so a workflow cannot pull in an
arbitrary third-party action. Actions are referenced by major version tag rather than by commit
SHA, which leaves a residual risk: a tag is mutable, so whoever controls one could move it onto
code that reads the OIDC token or the SWA deployment token. Enabling **Require actions to be
pinned to a full-length commit SHA** (Settings, Actions, General) would close that, at the cost of
pinning every `uses:` and relying on `.github/dependabot.yml` to keep the pins current.

```bash
gh api -X PUT repos/$R/actions/permissions -F enabled=true -f allowed_actions=selected
gh api -X PUT repos/$R/actions/permissions/selected-actions --input - <<'JSON'
{"github_owned_allowed":true,"verified_allowed":false,
 "patterns_allowed":["docker/*","Azure/*","hashicorp/setup-terraform@*","dorny/paths-filter@*"]}
JSON
```

**Fork pull requests.** `pr-validation.yml` is the only workflow a fork can trigger. It is
deliberately inert: `pull_request` (never `pull_request_target`), `contents: read`, no environment
and no secrets, so a fork PR cannot deploy. As a second layer, approval is required for all
external contributors:

```bash
gh api -X PUT repos/$R/actions/permissions/fork-pr-contributor-approval \
  -f approval_policy=all_external_contributors
```

**Rulesets.** "No pushing on main" requires a pull request with one approval and code-owner review
(`.github/CODEOWNERS` assigns `/.github/` and `/infra/`), and blocks deletion and force-push. The
sole maintainer is a bypass actor because GitHub will not accept a PR author's own approval; the
deployment branch policies above still apply to whatever is merged. "Protect api-v tags" blocks
deletion and force-moves of `api-v*` tags, since `ci.yml` resolves the newest such tag to decide
which image the Container App runs — a moved tag would silently change what gets deployed. Tag
creation stays open because `build-backend.yml` pushes those tags.

**Secret scope.** `TF_API_TOKEN`, `DOCKERHUB_TOKEN` and `CLOUDFLARE_API_TOKEN` are currently
**organization** secrets, so any job in this repository can read them whether or not it declares an
environment. Re-creating them as environment secrets on `dev`, `prod` and `cloudflare` would put
them behind the branch policies as well; it needs org-admin rights.

## 4. Terraform Cloud

State lives in the `MDMS` organization on Terraform Cloud; the GitHub runner executes Terraform
itself and only uses Terraform Cloud as a backend.

1. Create the workspace named in `environments/prod/versions.tf` (`ishqnama-web-prod`) as a
   **CLI-driven** workspace and set its **execution mode to Local**. With remote execution the
   `TF_VAR_*` values from GitHub would never reach the run.
2. Make sure the workspace whose outputs provide the Entra External ID tenant (`core-prod` by
   default, overridable with the `mdms_core_workspace` variable) exists and exposes
   `tenant_domain` and `tenant_id` as outputs. If prod shares the dev tenant, point the variable
   at `core-dev` instead of duplicating the workspace.
3. The token stored as `TF_API_TOKEN` must be able to write state in `ishqnama-web-prod` and
   read state in the core workspace (a team token with those workspace permissions, or a user
   token of a member who has them).

## 5. Container images

- **API**: `noormahdi/ishqnama-api`. CI builds and tags every push to `main` as a semantic version
  (`api-v*` git tag, `:<version>` and `:dev` image tags) and deploys it to dev. `prod-release.yml`
  does not build; it promotes one of those versions (the newest by default, or the
  `api_image_version` input), retags it as `:latest` and passes it to Terraform as
  `api_image_tag`. Release a version only after it has run in dev.
- **Postgres sidecar**: `noormahdi/ishqnama-db` is private and is built in its own repository.
  The tag in `db_image_tag` (default `latest`) must exist. Container Apps never re-pulls a
  re-pushed tag, so a new database build needs a new tag value to roll a revision.

## 6. Entra External ID (CIAM) app registrations

Prod defaults to the same SPA (`entra_spa_client_id`) and API (`entra_api_client_id`) app
registrations as dev. On the **SPA** registration add the prod redirect URIs under
Authentication, Single-page application:

- `https://ishqnama.com`
- `https://www.ishqnama.com`
- `https://<swa-default-hostname>` (from the `swa_default_hostname` output, useful before DNS is live)

Nothing changes on the API registration. If you create separate prod registrations instead, set
the two variables and grant the new SPA the `access_as_user` scope of the new API.

## 7. First deployment

Run the **Prod Release** workflow (`prod-release.yml`, manual trigger). Leave `api_image_version`
empty to release the newest CI-built API version, or enter one (for example `0.1.5`) to pin it.
The workflow verifies the version, applies `environments/prod` with it and then builds and
deploys the frontend. Record the outputs of the apply
(also visible in the Terraform Cloud workspace):

- `swa_default_hostname`
- `api_fqdn`
- `api_custom_domain_verification_id` (marked sensitive, so it is hidden in the apply log; read it
  with `terraform output -raw api_custom_domain_verification_id` from `environments/prod`, or with
  `az containerapp show -n ca-ishqnama-api-prod -g rg-ishqnama-prod --query properties.customDomainVerificationId -o tsv`)

## 8. Custom domains (after the first apply)

All DNS is in the `ishqnama.com` Cloudflare zone, **DNS-only** (grey cloud): Azure issues the
certificates and Cloudflare proxying would break validation.

### API: `api.ishqnama.com`

1. TXT record `asuid.api` with the value of `api_custom_domain_verification_id`.
2. CNAME record `api` pointing at `api_fqdn`.
3. In the Container App `ca-ishqnama-api-prod`, Custom domains, Add, hostname `api.ishqnama.com`,
   CNAME validation, then bind with an Azure **managed certificate** (free).

The frontend calls `https://api.ishqnama.com/api`, which is `local.api_url` in
`environments/prod/ishqnama-api.tf` and is baked into the SWA app settings.

### Frontend: `ishqnama.com` and `www.ishqnama.com`

In the Static Web App `swa-ishqnama-prod`, Custom domains:

1. Add `www.ishqnama.com` with CNAME validation: CNAME record `www` pointing at
   `swa_default_hostname`.
2. Add the apex `ishqnama.com` with TXT validation: add the TXT record Azure shows, then an
   ALIAS/ANAME-style record. Cloudflare supports CNAME flattening at the apex, so a DNS-only
   CNAME `@` to `swa_default_hostname` works.
3. Optionally set `www` as the default domain so the apex redirects to it.

CORS on the API already allows both hostnames and the SWA default hostname
(`local.api_cors_allowed_origins`).

## 9. Tearing down

`destroy-infra.yml` (manual, type `DESTROY`) removes everything Terraform created. The custom
domain records in Cloudflare, the Entra redirect URIs, and the federated credential and role
assignment of `sp-mdms-github` are left behind and must be cleaned up by hand if the environment
is retired for good.

## Troubleshooting

**`AuthorizationFailed ... does not have authorization to perform action
'Microsoft.Resources/subscriptions/providers/read'`** during `terraform plan`
The OIDC login worked but `sp-mdms-github` has no role on the subscription. Complete the
Contributor role assignment in step 2 and re-run after a couple of minutes.

**`AADSTS70021: No matching federated identity record found`** during Azure login
The federated credential subject does not match. It must name the GitHub environment
(`...:environment:prod`), not the branch, because every deploy job runs inside an environment.
A branch-scoped credential never matches, even on `main`: GitHub mints the token with an
`environment:` subject the moment a job declares one.

**A deploy job is "Waiting" or blocked before its first step**
The environment allows deployments from `main` only. This is working as intended — a run on any
other ref cannot reach Azure. Merge to `main`, or add the ref to the environment's deployment
branch policy if it genuinely needs to deploy.

**Resource provider still registering** on the first apply
Run the registration loop in step 1 and wait for `--wait` to return, then re-run the workflow.
