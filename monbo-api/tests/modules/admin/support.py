"""Shared admin test credentials and request helpers."""

PASSKEY = "correct horse battery staple " * 3
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
