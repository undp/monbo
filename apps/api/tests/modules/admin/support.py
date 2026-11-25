"""Shared admin test credentials and request helpers."""

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
