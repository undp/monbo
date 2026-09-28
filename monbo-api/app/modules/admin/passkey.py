"""Generate admin credentials. Prints them; writes nothing to disk.

    uv run python -m app.modules.admin.passkey

- ADMIN_PASSKEY: what the admin types to log in. Keep it in a password manager;
  it is never stored by the API or in Azure.
- ADMIN_PASSKEY_HASH / ADMIN_SESSION_SECRET: configure these in the API (Container
  App secrets in Azure, `.env` locally).
"""

import secrets

from app.modules.admin.auth import hash_passkey

PASSKEY_BYTES = 48  # 64 URL-safe characters
SESSION_SECRET_BYTES = 48


def generate() -> dict[str, str]:
    passkey = secrets.token_urlsafe(PASSKEY_BYTES)
    return {
        "ADMIN_PASSKEY": passkey,
        "ADMIN_PASSKEY_HASH": hash_passkey(passkey),
        "ADMIN_SESSION_SECRET": secrets.token_urlsafe(SESSION_SECRET_BYTES),
    }


def main() -> None:
    credentials = generate()
    print("# Give this to the admin (password manager). Do NOT store it in Azure:")
    print(f"ADMIN_PASSKEY={credentials['ADMIN_PASSKEY']}")
    print()
    print("# Configure these in the API:")
    print(f"ADMIN_PASSKEY_HASH={credentials['ADMIN_PASSKEY_HASH']}")
    print(f"ADMIN_SESSION_SECRET={credentials['ADMIN_SESSION_SECRET']}")


if __name__ == "__main__":
    main()
