## MODIFIED Requirements

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
