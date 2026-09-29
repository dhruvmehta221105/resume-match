from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import DeclarativeBase, mapped_column, Mapped
from sqlalchemy import String, Float, Text, DateTime, Integer
from sqlalchemy.ext.asyncio import async_sessionmaker
from datetime import datetime
from config import settings


engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    filename: Mapped[str] = mapped_column(String(255))
    original_name: Mapped[str] = mapped_column(String(255))
    file_path: Mapped[str] = mapped_column(String(500))
    raw_text: Mapped[str] = mapped_column(Text)
    candidate_name: Mapped[str] = mapped_column(String(255), default="Unknown")
    email: Mapped[str] = mapped_column(String(255), default="")
    phone: Mapped[str] = mapped_column(String(50), default="")
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    is_analyzed: Mapped[bool] = mapped_column(default=False)


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    resume_id: Mapped[int] = mapped_column(Integer, index=True)
    job_id: Mapped[str] = mapped_column(String(50), index=True)
    job_title: Mapped[str] = mapped_column(String(255))
    match_score: Mapped[float] = mapped_column(Float)
    vector_score: Mapped[float] = mapped_column(Float)
    matching_skills: Mapped[str] = mapped_column(Text)   # JSON array string
    missing_skills: Mapped[str] = mapped_column(Text)    # JSON array string
    grammar_issues: Mapped[str] = mapped_column(Text)    # JSON array string
    strengths: Mapped[str] = mapped_column(Text)         # JSON array string
    recommendations: Mapped[str] = mapped_column(Text)   # JSON array string
    summary: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
