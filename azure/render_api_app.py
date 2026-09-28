"""Render the monbo-api Container App as an ARM body for `az rest --method put`.

Used by deploy.sh. It is the single definition of the API app: `az containerapp
update --yaml` is broken on az CLI 2.90 and flags can't add volumes, so the whole
app is PUT from this body. Everything comes from environment variables; secrets
travel in the body (a temporary file deploy.sh deletes), never on a command line.

Layer storage (the Azure Files share mounted at /mnt/maps) is added when
MAPS_MOUNT=true, and the layers admin when both ADMIN_* secrets are set.
"""

import json
import os
import sys

MAPS_MOUNT_PATH = "/mnt/maps"


def env(name: str, default: str | None = None) -> str:
    value = os.environ.get(name, default)
    if value is None or value == "":
        sys.exit(f"render_api_app.py: {name} is required")
    return value


def probe(kind: str, **timing) -> dict:
    return {"type": kind, "httpGet": {"path": "/health", "port": 8000}, **timing}


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
            probe("Liveness", periodSeconds=30, timeoutSeconds=5, failureThreshold=3),
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
    json.dump(body, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
