from motor.motor_asyncio import AsyncIOMotorClient
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    MONGO_URI: str
    DB_NAME: str

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
client: AsyncIOMotorClient = None


async def connect_db():
    global client
    client = AsyncIOMotorClient(settings.MONGO_URI)
    await client.admin.command("ping")
    print(f"[DB] Connected — {settings.DB_NAME}")


async def disconnect_db():
    global client
    if client:
        client.close()
        print("[DB] Disconnected")


def get_database():
    return client[settings.DB_NAME]