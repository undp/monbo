# Country Registry

## Purpose

Define which countries exist and who administers them: the `countries.json` registry of a
per-country layers root, the command that adds, rotates, disables and enables countries, how the
running API picks up its changes, and the public list of countries a visitor can analyze.

## Requirements
### Requirement: Country registry file

The countries that exist in a per-country maps root SHALL be listed in `MAPS_ROOT/countries.json`. Each entry SHALL contain:

- `code`: an uppercase ISO 3166-1 alpha-2 code, unique in the file;
- `passkey_hash`: the lowercase hex SHA-256 of that country's admin passkey;
- `enabled`: a boolean.

The file SHALL never contain a plaintext passkey. Every registered country SHALL have a folder named after its code under `MAPS_ROOT`.

#### Scenario: Registry after migration

- **WHEN** the current layers are migrated to the per-country layout
- **THEN** `countries.json` lists CO, CR, and EC, each with a 64-character hex hash and `enabled: true`, and the folders `CO/`, `CR/`, and `EC/` exist

### Requirement: Registry changes apply without a restart

The API SHALL read the registry through the layer store and SHALL pick up changes to `countries.json` on the next request, without a redeploy or a restart. The API SHALL NOT write `countries.json`. When the file cannot be parsed, the API SHALL log an error, SHALL keep using the last valid version it read, and SHALL keep serving the public routes.

#### Scenario: Country added while the API runs

- **WHEN** an operator adds PE to the registry while the API is running
- **THEN** the next login with PE's passkey succeeds without restarting the API

#### Scenario: Corrupted registry

- **WHEN** `countries.json` is replaced by invalid JSON while the API is running
- **THEN** `GET /maps` keeps working and admin logins are checked against the last valid registry

### Requirement: Add a country from the command line

The project SHALL provide a command `countries add <CC>`, run as `uv run python -m app.modules.admin.countries add <CC> [--root PATH]` with `--root` defaulting to `MAPS_ROOT`. The command SHALL:

- reject codes that are not valid ISO 3166-1 alpha-2 codes, and codes already registered;
- create `<CC>/` with an empty `index.json` and the metadata and raster folders;
- register the country with `enabled: true` and the hash of a new random passkey of at least 64 characters;
- print the passkey once, and write it nowhere.

#### Scenario: Add Peru

- **WHEN** an operator runs `countries add PE`
- **THEN** `PE/index.json` exists and is an empty list, `countries.json` lists PE as enabled, and the passkey is printed only to the terminal

#### Scenario: Invalid code

- **WHEN** an operator runs `countries add XX`
- **THEN** the command fails with a message that XX is not an ISO 3166-1 alpha-2 code, and nothing is written

#### Scenario: Country already registered

- **WHEN** an operator runs `countries add CO` and CO is registered
- **THEN** the command fails and the registry and `CO/` are unchanged

### Requirement: List, rotate, disable, and enable countries

The same command SHALL provide:

- `list`: shows each country's code, name, enabled state, number of layers, and number of enabled layers;
- `rotate <CC>`: replaces the country's passkey hash with that of a new random passkey and prints the new passkey once;
- `disable <CC>` and `enable <CC>`: change only the `enabled` flag.

None of these commands SHALL delete a country's folder or its layers.

#### Scenario: Rotate a leaked passkey

- **WHEN** an operator runs `countries rotate CR`
- **THEN** a new passkey is printed, logins with the old CR passkey fail, and CO and EC are unaffected

#### Scenario: Disable a country

- **WHEN** an operator runs `countries disable EC`
- **THEN** EC's layers remain on disk and are still resolvable by id, EC disappears from `GET /countries`, and EC's admin can no longer log in

### Requirement: Public list of countries

`GET /countries` SHALL return the countries that are enabled in the registry and have at least one enabled layer, as a list of objects with a `code` field, sorted by code. It SHALL NOT require authentication.

#### Scenario: Current countries

- **WHEN** CO, CR, and EC each have at least one enabled layer
- **THEN** `GET /countries` returns `[{"code": "CO"}, {"code": "CR"}, {"code": "EC"}]`

#### Scenario: New country without published layers

- **WHEN** PE was just added and has no enabled layer
- **THEN** `GET /countries` does not include PE

#### Scenario: Country published

- **WHEN** PE's admin uploads a raster and enables the layer
- **THEN** `GET /countries` includes PE

### Requirement: Frontend reads the available countries from the API

The frontend SHALL take the countries it highlights and offers (the landing map, its list, and the header selector) from `GET /countries`. It SHALL fetch the layer list with the selected country as the `country` filter.

#### Scenario: Country published by its admin

- **WHEN** PE becomes listed by `GET /countries`
- **THEN** the landing page highlights Peru and it can be selected, without a frontend deploy

