"""Operator-only clinician provisioning. Never exposed through an HTTP or model tool."""

import argparse
import asyncio
from uuid import UUID, uuid4

from .auth import DEMO_CLINICIAN_SUBJECT
from .config import Settings
from .domain import stamp
from .storage import SqlStore, engine_for


async def seed(subject: str, display_name: str) -> str:
    settings = Settings()
    engine = engine_for(settings.database_url, settings)
    try:
        async with engine.begin() as connection:
            store = SqlStore(connection)
            user = await store.get("users", auth_subject=subject)
            if user and (user["role"] != "clinician" or user["disabled_at"]):
                raise SystemExit(
                    "Existing identity is not an enabled clinician; no role change made"
                )
            if not user:
                user = await store.add(
                    "users",
                    id=str(uuid4()),
                    auth_subject=subject,
                    role="clinician",
                    disabled_at=None,
                    created_at=stamp(),
                )
            if not await store.get("clinician_profiles", clinician_id=user["id"]):
                await store.add(
                    "clinician_profiles",
                    clinician_id=user["id"],
                    display_name=display_name,
                    verified_at=stamp(),
                    verified_by=user["id"],
                )
            return user["id"]
    finally:
        await engine.dispose()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--auth-subject", type=UUID)
    group.add_argument("--fictional-demo", action="store_true")
    parser.add_argument("--display-name", default="Fictional development clinician")
    args = parser.parse_args()
    settings = Settings()
    if args.fictional_demo and (not settings.demo_auth or settings.environment != "development"):
        raise SystemExit(
            "Fictional clinician requires development environment and RE_DEMO_AUTH=true"
        )
    print(
        "Clinician application ID:",
        asyncio.run(
            seed(
                DEMO_CLINICIAN_SUBJECT if args.fictional_demo else str(args.auth_subject),
                args.display_name,
            )
        ),
    )


if __name__ == "__main__":
    main()
