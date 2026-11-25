# Admin Authentication

## Purpose

Define how the layers admin is enabled and how each country's administrator proves who they are:
one long passkey per country stored only as a hash in the country registry, short-lived signed
session tokens bound to that country and passkey, a login rate limit and an Origin check on the
admin routes.
## Requirements
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

### Requirement: Login attempts are rate-limited and logged

The API SHALL allow at most 5 failed login attempts per client IP within 15 minutes. Further attempts from that IP SHALL receive 429 with a `Retry-After` header until the window passes. The client IP SHALL be taken from the last `X-Forwarded-For` hop when that header is present, and from the connection peer otherwise. Every login attempt SHALL be logged with its outcome, the client IP, and a timestamp, and never with the submitted passkey.

#### Scenario: Brute force blocked

- **WHEN** one IP submits 6 wrong passkeys within 15 minutes
- **THEN** the sixth attempt receives 429 with `Retry-After`, even if the passkey is correct

#### Scenario: Attempts logged without secrets

- **WHEN** any login attempt occurs
- **THEN** a log line records the outcome and IP, and does not contain the submitted passkey

### Requirement: CORS and origin checks for admin routes

The API SHALL allow the `GET`, `POST`, `PUT`, `PATCH`, and `DELETE` methods and the `Authorization` and `Content-Type` headers in CORS, without credentials (cookies). When `ADMIN_ALLOWED_ORIGIN` is set, admin routes, including the login, SHALL reject with 403 any request whose `Origin` header is present and differs from that value.

#### Scenario: Admin call from the configured frontend

- **WHEN** the admin UI at the configured origin calls `PUT /admin/layers/3` with a valid token
- **THEN** the preflight succeeds and the request is processed

#### Scenario: Cancelling a job from the admin UI

- **WHEN** the admin UI at the configured origin sends the preflight for `DELETE /admin/jobs/{jobId}`
- **THEN** the preflight allows `DELETE`

#### Scenario: Admin call from another origin

- **WHEN** a request with a valid token arrives with `Origin: https://evil.example`
- **THEN** the response is 403

### Requirement: Admin session handling in the frontend

The admin UI SHALL keep the session token only in `sessionStorage`, SHALL never store the passkey, and SHALL send the user back to the admin login when the token expires or any admin call returns 401. Logging out SHALL remove the token. The session SHALL end at the token's expiry and not before, whatever the configured TTL. That includes lifetimes longer than the browser's maximum timer delay (2³¹−1 ms, about 24.8 days).

#### Scenario: Session expiry

- **WHEN** an admin call returns 401
- **THEN** the UI clears the token and shows the admin login page

#### Scenario: Session ends at its expiry

- **WHEN** a session expires in 60 minutes
- **THEN** it is still active after 59 minutes and is cleared at 60

#### Scenario: A session longer than the maximum timer delay

- **WHEN** an admin logs in with a session that expires in 30 days
- **THEN** the session is still active one second later and one day later, and is cleared once the 30 days have passed

