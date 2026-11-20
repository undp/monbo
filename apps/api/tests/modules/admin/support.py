"""Shared admin test credentials and request helpers."""

import json
import os

# Passkeys of the countries registered by the `country_root` fixture's `register`.
COUNTRY_PASSKEYS = {
    "CO": "colombia passkey " * 4,
    "EC": "ecuador passkey " * 4,
    "CR": "costa rica passkey " * 4,
}
# The country the `client`/`admin_headers` fixtures log in as.
PASSKEY = COUNTRY_PASSKEYS["CO"]
SECRET = "s" * 48


def login(client, passkey=PASSKEY, ip=None, origin=None):
    headers = {}
    if ip:
        headers["X-Forwarded-For"] = ip
    if origin:
        headers["Origin"] = origin
    return client.post("/admin/session", json={"passkey": passkey}, headers=headers)


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


def write_categories(country, content):
    """Write a country folder's `categories.json` (a list, or raw text), as a hand
    edit of the share would."""
    path = country.root / "categories.json"
    path.write_text(content if isinstance(content, str) else json.dumps(content))
    # A rewrite in the same mtime tick as a cached read must still be seen.
    stat = path.stat()
    os.utime(path, ns=(stat.st_atime_ns, stat.st_mtime_ns + 1_000_000))
