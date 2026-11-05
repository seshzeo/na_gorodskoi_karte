import asyncio
import getpass

from sqlalchemy import select

from app.backend.core.database import AsyncSessionLocal
from app.backend.models.moderator import Moderator
from app.backend.services.auth import create_moderator


async def main() -> None:
    username = input("Moderator username: ").strip()
    password = getpass.getpass("Password (minimum 12 characters): ")
    confirmation = getpass.getpass("Repeat password: ")
    if password != confirmation:
        raise SystemExit("Passwords do not match")
    async with AsyncSessionLocal() as db:
        try:
            moderator = await create_moderator(db, username, password)
        except ValueError as exc:
            raise SystemExit(str(exc)) from exc
    print(f"Moderator created: {moderator.username} ({moderator.id})")


if __name__ == "__main__":
    asyncio.run(main())
