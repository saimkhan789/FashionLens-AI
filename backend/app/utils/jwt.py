from datetime import datetime, timedelta
from jose import JWTError, jwt
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


class JWTSettings(BaseSettings):
    JWT_SECRET: str
    JWT_ALGORITHM: str
    JWT_EXPIRE_MINUTES: int

    class Config:
        env_file = ".env"
        extra = "ignore"


jwt_settings = JWTSettings()


def create_access_token(data: dict) -> str:
    payload = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=jwt_settings.JWT_EXPIRE_MINUTES)
    payload.update({"exp": expire})
    return jwt.encode(payload, jwt_settings.JWT_SECRET, algorithm=jwt_settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, jwt_settings.JWT_SECRET, algorithms=[jwt_settings.JWT_ALGORITHM])
    except JWTError:
        return None