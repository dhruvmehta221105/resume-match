from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str
    pinecone_api_key: str
    pinecone_index_name: str = "resume-matcher"
    pinecone_environment: str = "us-east-1"
    upload_dir: str = "uploads"
    database_url: str = "sqlite+aiosqlite:///./resume_matcher.db"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
