import asyncio

import jwt

from .config import Settings
from .domain import DomainError, Identity

DEMO_CLINICIAN_SUBJECT = "44444444-4444-4444-8444-444444444444"
DEMO_SUBJECT = "11111111-1111-4111-8111-111111111111"


class Authenticator:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.keys = (
            jwt.PyJWKClient(
                settings.supabase_url.rstrip("/") + "/auth/v1/.well-known/jwks.json", timeout=5
            )
            if settings.supabase_url
            else None
        )

    async def verify(self, authorization: str | None) -> Identity:
        if not authorization or not authorization.startswith("Bearer "):
            raise DomainError("AUTH_INVALID", 401)
        token = authorization[7:]
        if self.settings.demo_auth and token == "demo-clinician-token":
            return Identity(DEMO_CLINICIAN_SUBJECT)
        if self.settings.demo_auth and token in ["demo-patient-token", "demo-other-patient-token"]:
            return Identity(
                DEMO_SUBJECT
                if token == "demo-patient-token"
                else "33333333-3333-4333-8333-333333333333"
            )
        if not self.settings.supabase_url:
            raise DomainError("AUTH_INVALID", 401)
        try:
            signing_key = await asyncio.to_thread(self.keys.get_signing_key_from_jwt, token)
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "ES256"],
                audience=self.settings.jwt_audience,
                issuer=self.settings.supabase_url.rstrip("/") + "/auth/v1",
                options={"require": ["exp", "sub", "iss", "aud"]},
            )
            from uuid import UUID

            return Identity(str(UUID(claims["sub"])))
        except (jwt.PyJWTError, ValueError):
            raise DomainError("AUTH_INVALID", 401) from None
