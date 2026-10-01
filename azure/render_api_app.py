"""Render the monbo-api Container App as an ARM body for `az rest --method put`.

Used by deploy.sh. It is the single definition of the API app: `az containerapp
update --yaml` is broken on az CLI 2.90 and flags can't add volumes, so the whole
app is PUT from this body. Everything comes from environment variables; secrets
travel in the body (a temporary file deploy.sh deletes), never on a command line.

Layer storage (the Azure Files share mounted at /mnt/maps) is added when
MAPS_MOUNT=true, and the layers admin when both ADMIN_* secrets are set.

A PUT replaces the whole app. This body owns the container (image, resources, env
vars, probes, volumes), the secrets, the registry, the scale settings and the basic
ingress; anything else set on those (an env var or secret added in the portal, a
scale rule) is dropped on the next deploy. Settings outside them that are usually
configured by hand are carried over from the current app when EXISTING_APP_FILE
points at its JSON (`az containerapp show`): see CARRIED_OVER.
"""

import json
import os
import sys

MAPS_MOUNT_PATH = "/mnt/maps"

# (path in the app resource, as nested keys) kept from the current app if present.
CARRIED_OVER = [
    ("identity",),
    ("tags",),
    ("properties", "workloadProfileName"),
    ("properties", "configuration", "maxInactiveRevisions"),
    ("properties", "configuration", "dapr"),
    ("properties", "configuration", "ingress", "customDomains"),
    ("properties", "configuration", "ingress", "ipSecurityRestrictions"),
    ("properties", "configuration", "ingress", "corsPolicy"),
    ("properties", "configuration", "ingress", "stickySessions"),
    ("properties", "configuration", "ingress", "clientCertificateMode"),
]


def env(name: str, default: str | None = None) -> str:
    value = os.environ.get(name, default)
    if value is None or value == "":
        sys.exit(f"render_api_app.py: {name} is required")
    return value


def probe(kind: str, path: str = "/health", **timing) -> dict:
    return {"type": kind, "httpGet": {"path": path, "port": 8000}, **timing}


def carry_over(body: dict, existing: dict) -> None:
    """Copy CARRIED_OVER settings from the current app into the body."""
    for path in CARRIED_OVER:
        value = existing
        for key in path:
            value = value.get(key) if isinstance(value, dict) else None
        if value in (None, [], {}):
            continue
        target = body
        for key in path[:-1]:
            target = target.setdefault(key, {})
        target[path[-1]] = value
    identity = body.get("identity")
    if identity:
        # Only the writable part: principalId and tenantId are read-only.
        body["identity"] = {"type": identity.get("type", "None")}
        if identity.get("userAssignedIdentities"):
            body["identity"]["userAssignedIdentities"] = {
                resource_id: {} for resource_id in identity["userAssignedIdentities"]
            }


def main() -> None:
    secrets = [
        {"name": "acr-password", "value": env("ACR_PASSWORD")},
        {"name": "gmaps-api-key", "value": env("GCP_MAPS_PLATFORM_API_KEY")},
        {
            "name": "gmaps-signature-secret",
            "value": env("GCP_MAPS_PLATFORM_SIGNATURE_SECRET"),
        },
    ]
    env_vars = [
        {"name": "GCP_MAPS_PLATFORM_API_KEY", "secretRef": "gmaps-api-key"},
        {
            "name": "GCP_MAPS_PLATFORM_SIGNATURE_SECRET",
            "secretRef": "gmaps-signature-secret",
        },
        {
            "name": "OVERLAP_THRESHOLD_PERCENTAGE",
            "value": env("OVERLAP_THRESHOLD_PERCENTAGE", "1"),
        },
    ]
    container: dict = {
        "name": "api",
        "image": env("API_IMAGE"),
        "resources": {"cpu": float(env("API_CPU", "1")), "memory": env("API_MEMORY", "2Gi")},
        "env": env_vars,
        "probes": [
            probe("Startup", initialDelaySeconds=5, periodSeconds=5, failureThreshold=24),
            probe("Readiness", periodSeconds=15, timeoutSeconds=3, failureThreshold=3),
            # Not /health: it checks the share, and a slow share must not restart
            # the only replica (it only takes it out of rotation via readiness).
            probe(
                "Liveness",
                "/health/live",
                periodSeconds=30,
                timeoutSeconds=5,
                failureThreshold=3,
            ),
        ],
    }
    template: dict = {
        "containers": [container],
        # One replica: the admin's locks, rate limit and ingestion slot live in memory.
        "scale": {"minReplicas": 1, "maxReplicas": 1},
    }

    if os.environ.get("MAPS_MOUNT") == "true":
        template["volumes"] = [
            {
                "name": "maps",
                "storageType": "AzureFile",
                "storageName": env("ENV_STORAGE_NAME", "maps"),
                # The image's appuser is uid/gid 10001 (Dockerfile.prod); chmod is not
                # possible on the share, so ownership and modes come from here.
                "mountOptions": env(
                    "MAPS_MOUNT_OPTIONS", "uid=10001,gid=10001,dir_mode=0750,file_mode=0640"
                ),
            }
        ]
        container["volumeMounts"] = [{"volumeName": "maps", "mountPath": MAPS_MOUNT_PATH}]
        env_vars.append({"name": "MAPS_ROOT", "value": MAPS_MOUNT_PATH})

    if os.environ.get("ADMIN_PASSKEY_HASH") and os.environ.get("ADMIN_SESSION_SECRET"):
        secrets += [
            {"name": "admin-passkey-hash", "value": env("ADMIN_PASSKEY_HASH")},
            {"name": "admin-session-secret", "value": env("ADMIN_SESSION_SECRET")},
        ]
        env_vars += [
            {"name": "ADMIN_PASSKEY_HASH", "secretRef": "admin-passkey-hash"},
            {"name": "ADMIN_SESSION_SECRET", "secretRef": "admin-session-secret"},
            {"name": "ADMIN_ALLOWED_ORIGIN", "value": env("ADMIN_ALLOWED_ORIGIN")},
        ]

    body = {
        "location": env("LOCATION"),
        "properties": {
            "environmentId": env("ENV_ID"),
            "configuration": {
                "activeRevisionsMode": "Single",
                "ingress": {
                    "external": True,
                    "targetPort": 8000,
                    "transport": "auto",
                    "allowInsecure": False,
                },
                "registries": [
                    {
                        "server": env("ACR_SERVER"),
                        "username": env("ACR_USERNAME"),
                        "passwordSecretRef": "acr-password",
                    }
                ],
                "secrets": secrets,
            },
            "template": template,
        },
    }
    existing_file = os.environ.get("EXISTING_APP_FILE")
    if existing_file:
        with open(existing_file, encoding="utf-8") as file:
            carry_over(body, json.load(file))
    json.dump(body, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
