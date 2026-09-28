# Admin Authentication

## Purpose

Define how the layers admin is enabled and how an administrator proves who they are: a long
shared passkey stored only as a hash, short-lived signed session tokens, a login rate limit and an
Origin check on the admin routes.

## Requirements

### Requirement: Admin feature is opt-in

The admin routes SHALL be registered only when `ADMIN_PASSKEY_HASH` and `ADMIN_SESSION_SECRET` are both configured. When either is missing, every `/admin/*` route SHALL respond 404 and SHALL NOT appear in the OpenAPI schema. The API's public behavior SHALL be unchanged in that case.

#### Scenario: Unconfigured deployment

- **WHEN** the API starts without `ADMIN_PASSKEY_HASH`
- **THEN** `POST /admin/session` returns 404 and `/docs` lists no admin routes

#### Scenario: Partially configured deployment

- **WHEN** `ADMIN_PASSKEY_HASH` is set but `ADMIN_SESSION_SECRET` is not
- **THEN** the admin routes are not registered and a startup warning explains why

### Requirement: Passkey stored only as a hash

The API SHALL store and receive only the lowercase hex SHA-256 hash of the admin passkey, through `ADMIN_PASSKEY_HASH`. The plaintext passkey SHALL never be persisted or logged by the API. The project SHALL provide a command that generates a random passkey of at least 64 characters and prints it together with its hash.

#### Scenario: Generate credentials

- **WHEN** an operator runs the passkey generation command
- **THEN** it prints a random passkey of at least 64 characters and its SHA-256 hex hash, and writes nothing to disk

### Requirement: Login exchanges the passkey for a short-lived session token

`POST /admin/session` SHALL accept a passkey, hash it, and compare the hash with the configured hash in constant time. On a match it SHALL return a token signed with HMAC-SHA256 using `ADMIN_SESSION_SECRET`, together with its expiry. The token lifetime SHALL be `ADMIN_SESSION_TTL_MINUTES` (default 60). On a mismatch it SHALL return 401 without saying which part failed.

#### Scenario: Correct passkey

- **WHEN** a client posts the correct passkey
- **THEN** the response is 200 with a `token` and an `expiresAt` 60 minutes in the future

#### Scenario: Wrong passkey

- **WHEN** a client posts an incorrect passkey
- **THEN** the response is 401 with a generic message

### Requirement: Admin routes require a valid Bearer token

Every `/admin/*` route except `POST /admin/session` SHALL require an `Authorization: Bearer <token>` header whose signature is valid and whose expiry has not passed. Otherwise it SHALL respond 401. Rotating `ADMIN_SESSION_SECRET` SHALL invalidate all previously issued tokens.

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

### Requirement: Session check

`GET /admin/session` SHALL require a valid admin token and SHALL return the session's expiry, so the admin UI can check a stored token before using it.

#### Scenario: Stored token still valid

- **WHEN** the admin UI calls `GET /admin/session` with a valid token
- **THEN** the response is 200 with the token's `expiresAt`

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

The API SHALL allow the `GET`, `POST`, `PUT`, and `PATCH` methods and the `Authorization` and `Content-Type` headers in CORS, without credentials (cookies). When `ADMIN_ALLOWED_ORIGIN` is set, admin routes, including the login, SHALL reject with 403 any request whose `Origin` header is present and differs from that value.

#### Scenario: Admin call from the configured frontend

- **WHEN** the admin UI at the configured origin calls `PUT /admin/layers/3` with a valid token
- **THEN** the preflight succeeds and the request is processed

#### Scenario: Admin call from another origin

- **WHEN** a request with a valid token arrives with `Origin: https://evil.example`
- **THEN** the response is 403

### Requirement: Admin session handling in the frontend

The admin UI SHALL keep the session token only in `sessionStorage`, SHALL never store the passkey, and SHALL send the user back to the admin login when the token expires or any admin call returns 401. Logging out SHALL remove the token.

#### Scenario: Session expiry

- **WHEN** an admin call returns 401
- **THEN** the UI clears the token and shows the admin login page

