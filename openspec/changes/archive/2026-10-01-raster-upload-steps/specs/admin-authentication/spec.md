## MODIFIED Requirements

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

