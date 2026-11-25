## MODIFIED Requirements

### Requirement: Admin feature is opt-in

The admin routes SHALL be registered only when `ADMIN_SESSION_SECRET` is configured and the maps root uses the per-country layout. Otherwise, every `/admin/*` route SHALL respond 404 and SHALL NOT appear in the OpenAPI schema, and the API's public behavior SHALL be unchanged. `ADMIN_PASSKEY_HASH` SHALL no longer be read. When it is set, the API SHALL log a startup warning saying it is ignored and that passkeys now live in the country registry.

#### Scenario: Unconfigured deployment

- **WHEN** the API starts without `ADMIN_SESSION_SECRET`
- **THEN** `POST /admin/session` returns 404 and `/docs` lists no admin routes

#### Scenario: Legacy root

- **WHEN** `ADMIN_SESSION_SECRET` is set but the maps root has the legacy flat layout
- **THEN** the admin routes are not registered and a startup warning explains why

#### Scenario: Leftover passkey hash

- **WHEN** the API starts with `ADMIN_PASSKEY_HASH` set
- **THEN** a startup warning says the variable is ignored, and that value is not accepted at login

### Requirement: Passkey stored only as a hash

Each country's admin passkey SHALL be stored only as its lowercase hex SHA-256 hash, in the country registry. The plaintext passkey SHALL never be persisted or logged by the API or by the registry commands. The registry commands SHALL generate random passkeys of at least 64 characters and print them only to the operator's terminal.

#### Scenario: Generate credentials for a country

- **WHEN** an operator adds or rotates a country
- **THEN** the command prints a random passkey of at least 64 characters, and only its SHA-256 hex hash is written to `countries.json`

### Requirement: Login exchanges the passkey for a short-lived session token

`POST /admin/session` SHALL accept a passkey, hash it, and compare the hash in constant time with the hash of every enabled country in the registry. The comparison SHALL NOT stop at the first match. On a match it SHALL return a token signed with HMAC-SHA256 using `ADMIN_SESSION_SECRET`, together with its expiry and the matched country's code. The token SHALL carry the country and a fingerprint made of the first 16 hex characters of that country's passkey hash. The token lifetime SHALL be `ADMIN_SESSION_TTL_MINUTES` (default 60). When no enabled country matches, it SHALL return 401 without saying which part failed.

#### Scenario: Correct passkey

- **WHEN** a client posts CO's passkey
- **THEN** the response is 200 with a `token`, an `expiresAt` 60 minutes in the future, and `country: "CO"`

#### Scenario: Wrong passkey

- **WHEN** a client posts a passkey that matches no country
- **THEN** the response is 401 with a generic message

#### Scenario: Disabled country

- **WHEN** a client posts EC's passkey while EC is disabled
- **THEN** the response is 401 with the same generic message

### Requirement: Admin routes require a valid Bearer token

Every `/admin/*` route except `POST /admin/session` SHALL require an `Authorization: Bearer <token>` header that meets all of these conditions:

- its signature is valid;
- its expiry has not passed;
- its country is registered and enabled;
- its fingerprint matches the start of that country's current passkey hash.

Otherwise the route SHALL respond 401. Rotating `ADMIN_SESSION_SECRET` SHALL invalidate all previously issued tokens. Rotating or disabling a country SHALL invalidate that country's tokens on their next use.

#### Scenario: Missing token

- **WHEN** a client calls `GET /admin/layers` without an Authorization header
- **THEN** the response is 401

#### Scenario: Expired token

- **WHEN** a client calls an admin route with a token whose expiry has passed
- **THEN** the response is 401

#### Scenario: Tampered token

- **WHEN** a client calls an admin route with a token whose payload was modified
- **THEN** the response is 401

#### Scenario: Secret rotation

- **WHEN** `ADMIN_SESSION_SECRET` changes and a new revision starts
- **THEN** tokens issued before the change are rejected with 401

#### Scenario: Country passkey rotated

- **WHEN** CR's passkey is rotated while a CR admin holds an unexpired token
- **THEN** that admin's next call returns 401, and CO's sessions keep working

#### Scenario: Token from the previous release

- **WHEN** a client calls an admin route with a validly signed token that has no country
- **THEN** the response is 401

### Requirement: Session check

`GET /admin/session` SHALL require a valid admin token and SHALL return the session's expiry and country, so the admin UI can check a stored token before using it and show which country it administers.

#### Scenario: Stored token still valid

- **WHEN** the admin UI calls `GET /admin/session` with a valid CO token
- **THEN** the response is 200 with the token's `expiresAt` and `country: "CO"`

#### Scenario: Stored token no longer valid

- **WHEN** the admin UI calls `GET /admin/session` with an expired token
- **THEN** the response is 401
