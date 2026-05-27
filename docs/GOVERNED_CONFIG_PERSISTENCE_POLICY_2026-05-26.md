# Governed Config Persistence Policy

Status: Active
Date: 2026-05-26
Owner: Platform / Data Pond / Keeper Governance

## Purpose

Keep governed, non-secret machine-readable configuration in git while preserving the repo's default protection against accidental credential commits.

The repo intentionally ignores `config/*` by default because that folder contains historical local credentials, OAuth material, screenshots, generated files, and environment-specific setup files. Governed config files must be allowlisted one by one.

## Current Allowlisted Governed Config

These files are non-secret governance artifacts and should be persisted:

- `/Users/mark/Property_Analytics/config/captain_active_routine_manifest.json`
- `/Users/mark/Property_Analytics/config/captain_signal_flow_manifest.json`
- `/Users/mark/Property_Analytics/config/data_warehouse_property_code_resolution.json`
- `/Users/mark/Property_Analytics/config/manual_source_replacement_manifest.json`
- `/Users/mark/Property_Analytics/config/property_identity_matrix.json`
- `/Users/mark/Property_Analytics/config/release_reconcile_snapshot.json`

Previously tracked governed manifests under `config/` remain tracked by git even if they predate this policy, including system landscape, service operations, release, deployment, outcome, and gap-register manifests.

## Must Stay Ignored

Do not allowlist:

- API keys
- OAuth tokens or pickles
- service-account JSON
- local credential YAML
- raw password files
- generated screenshots/images
- one-off local registry backups
- environment-specific exports unless reviewed and documented as non-secret governance artifacts

Examples that remain ignored:

- `/Users/mark/Property_Analytics/config/OpenAI_Key.txt`
- `/Users/mark/Property_Analytics/config/gsc_token.pickle`
- `/Users/mark/Property_Analytics/config/google-ads.yaml.example`
- `/Users/mark/Property_Analytics/config/generated/`

## Review Checklist Before Allowlisting

Before adding a `!config/...` exception:

1. Confirm the file is governance/configuration, not a credential or generated sensitive output.
2. Run JSON/YAML validation when applicable.
3. Search for secret-bearing terms:

```bash
rg -n -i "password|secret|token|api[_ -]?key|client_secret|private_key|credential|pwd" path/to/file
```

4. Confirm `git check-ignore -v path/to/file` shows the intended allowlist behavior.
5. Update this policy when the allowlist changes.

## Captain/Data Warehouse Decision

On 2026-05-26, the following were allowlisted because they are required for the Data Warehouse-to-Captain advisory flow to survive across branches and future sessions:

- `config/property_identity_matrix.json`
- `config/captain_active_routine_manifest.json`
- `config/captain_signal_flow_manifest.json`
- `config/manual_source_replacement_manifest.json`
- `config/data_warehouse_property_code_resolution.json`

The broad `config/*` ignore remains in place.
