# layers-ops

Operator commands on an environment's layer share (the Azure Files share the API
mounts at `/mnt/maps`). They don't redeploy or restart anything.

```sh
tools/layers-ops/layers-ops.sh dev seed                     # fill the share with the Git layers (empties it first)
tools/layers-ops/layers-ops.sh dev countries list
tools/layers-ops/layers-ops.sh dev countries add PE         # prints PE's admin passkey once
tools/layers-ops/layers-ops.sh dev countries rotate CO
tools/layers-ops/layers-ops.sh dev countries disable|enable CR
tools/layers-ops/layers-ops.sh dev countries unlock         # only after an interrupted command
```

- The storage account, share and resource group come from the environment's Terraform
  platform outputs (`infra/terraform/platform`), so the platform stack must be applied.
  The subscription comes from `ARM_SUBSCRIPTION_ID`, read from
  `infra/envs/<env>.secrets.env` (git-ignored) when it isn't exported.
- `seed` validates every Git-tracked raster, converts it to a Cloud Optimized GeoTIFF,
  splits the layers by country and uploads them. It prints one admin passkey per
  country: put each in the password manager straight away. On a share that already
  has files it asks you to type the share's name, snapshots the share and only then
  empties it. It needs the real rasters (`git lfs pull`).
- `countries` edits the country registry (`countries.json`) through a temporary copy,
  and aborts without uploading if someone else changed it meanwhile.
- **Never run these from CI**: passkeys would end up in the logs.

Requirements: az CLI (logged in), Terraform ≥ 1.16, uv, python3. Details:
[docs/suggested_deployment.md](../../docs/suggested_deployment.md) and
[docs/maps.md](../../docs/maps.md#countries).
