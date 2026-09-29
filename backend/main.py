import asyncio
import json
import os
import uuid
from pathlib import Path
from typing import List

from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
import aiofiles

from config import settings
from database import init_db, get_db, AsyncSessionLocal, Resume, AnalysisResult
from resume_parser import parse_resume
from rag_pipeline import upsert_resume, delete_resume, match_all_jobs_to_resumes, get_resume_count
from analyzer import analyze_resume_for_job, compute_winner
from job_descriptions import get_all_jobs, get_job_by_id

# In-memory status tracker for the background analysis task
_analysis_status: dict = {"running": False, "progress": "", "done": 0, "total": 0, "error": None}

app = FastAPI(title="Resume Matcher API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path(settings.upload_dir)
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc"}
MAX_FILE_SIZE_MB = 10


@app.on_event("startup")
async def startup():
    await init_db()


# ─────────────────────────────────────────────
# Job Descriptions
# ─────────────────────────────────────────────

@app.get("/api/jobs")
async def list_jobs():
    """Return all 20 hardcoded job descriptions."""
    jobs = get_all_jobs()
    return {"jobs": jobs, "total": len(jobs)}


@app.get("/api/jobs/{job_id}")
async def get_job(job_id: str):
    job = get_job_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


# ─────────────────────────────────────────────
# Resume Upload
# ─────────────────────────────────────────────

@app.post("/api/resumes/upload")
async def upload_resumes(
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Upload one or multiple resumes (PDF/DOCX). Parses and indexes them in Pinecone."""
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    results = []
    errors = []

    for file in files:
        ext = Path(file.filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            errors.append({"file": file.filename, "error": f"Unsupported format: {ext}"})
            continue

        content = await file.read()
        if len(content) > MAX_FILE_SIZE_MB * 1024 * 1024:
            errors.append({"file": file.filename, "error": "File exceeds 10MB limit"})
            continue

        unique_name = f"{uuid.uuid4().hex}{ext}"
        file_path = UPLOAD_DIR / unique_name

        async with aiofiles.open(file_path, "wb") as f:
            await f.write(content)

        try:
            parsed = parse_resume(str(file_path))
        except Exception as e:
            os.remove(file_path)
            errors.append({"file": file.filename, "error": f"Parse error: {str(e)}"})
            continue

        resume = Resume(
            filename=unique_name,
            original_name=file.filename,
            file_path=str(file_path),
            raw_text=parsed["raw_text"],
            candidate_name=parsed["candidate_name"],
            email=parsed["email"],
            phone=parsed["phone"],
        )
        db.add(resume)
        await db.flush()

        try:
            upsert_resume(
                resume_id=resume.id,
                resume_text=parsed["raw_text"],
                metadata={
                    "candidate_name": parsed["candidate_name"],
                    "email": parsed["email"],
                    "original_name": file.filename,
                },
            )
        except Exception as e:
            errors.append({"file": file.filename, "error": f"Indexing error: {str(e)}"})

        await db.commit()
        results.append({
            "id": resume.id,
            "original_name": file.filename,
            "candidate_name": parsed["candidate_name"],
            "email": parsed["email"],
            "word_count": parsed["word_count"],
        })

    return {
        "uploaded": results,
        "errors": errors,
        "total_uploaded": len(results),
        "total_errors": len(errors),
    }


@app.get("/api/resumes")
async def list_resumes(db: AsyncSession = Depends(get_db)):
    """Return all uploaded resumes."""
    result = await db.execute(select(Resume).order_by(Resume.uploaded_at.desc()))
    resumes = result.scalars().all()
    return {
        "resumes": [
            {
                "id": r.id,
                "original_name": r.original_name,
                "candidate_name": r.candidate_name,
                "email": r.email,
                "phone": r.phone,
                "uploaded_at": r.uploaded_at.isoformat(),
                "is_analyzed": r.is_analyzed,
                "word_count": len(r.raw_text.split()),
            }
            for r in resumes
        ],
        "total": len(resumes),
        "pinecone_count": get_resume_count(),
    }


@app.delete("/api/resumes/{resume_id}")
async def delete_resume_endpoint(resume_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a resume from DB and Pinecone."""
    result = await db.execute(select(Resume).where(Resume.id == resume_id))
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    if os.path.exists(resume.file_path):
        os.remove(resume.file_path)

    try:
        delete_resume(resume_id)
    except Exception:
        pass

    await db.execute(delete(AnalysisResult).where(AnalysisResult.resume_id == resume_id))
    await db.delete(resume)
    await db.commit()

    return {"message": f"Resume {resume_id} deleted successfully"}


# ─────────────────────────────────────────────
# Analysis
# ─────────────────────────────────────────────

async def _run_full_analysis_bg():
    """
    Background task — runs after the HTTP response is sent.
    Blocking calls (SentenceTransformer + Anthropic SDK) are offloaded to a
    thread pool via asyncio.to_thread() so the event loop stays responsive.
    Uses its own DB session because the request-scoped session is closed by
    the time this runs.
    """
    global _analysis_status
    _analysis_status = {"running": True, "progress": "Fetching resumes…", "done": 0, "total": 0, "error": None}

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(Resume))
            all_resumes = {r.id: r for r in result.scalars().all()}

            if not all_resumes:
                _analysis_status = {"running": False, "progress": "No resumes found", "done": 0, "total": 0, "error": None}
                return

            _analysis_status["progress"] = "Running semantic search across all job descriptions…"
            # SentenceTransformer.encode() and Pinecone queries are synchronous — run in thread pool
            jd_matches = await asyncio.to_thread(match_all_jobs_to_resumes, 5)

            await db.execute(delete(AnalysisResult))

            total = sum(len(v) for v in jd_matches.values())
            _analysis_status["total"] = total
            done = 0

            for job_id, matches in jd_matches.items():
                job = get_job_by_id(job_id)
                if not job:
                    continue

                for resume_id, vector_score in matches:
                    resume = all_resumes.get(resume_id)
                    if not resume:
                        continue

                    done += 1
                    _analysis_status["done"] = done
                    _analysis_status["progress"] = (
                        f"Analyzing {resume.candidate_name} for {job['title']} ({done}/{total})…"
                    )

                    try:
                        # Anthropic SDK is synchronous — run in thread pool
                        analysis = await asyncio.to_thread(
                            analyze_resume_for_job,
                            resume_text=resume.raw_text,
                            candidate_name=resume.candidate_name,
                            job=job,
                            vector_score=vector_score,
                        )
                    except Exception:
                        continue

                    ar = AnalysisResult(
                        resume_id=resume_id,
                        job_id=job_id,
                        job_title=job["title"],
                        match_score=analysis.get("match_score", 0),
                        vector_score=vector_score * 100,
                        matching_skills=json.dumps(analysis.get("matching_skills", [])),
                        missing_skills=json.dumps(analysis.get("missing_skills", [])),
                        grammar_issues=json.dumps(analysis.get("grammar_issues", [])),
                        strengths=json.dumps(analysis.get("strengths", [])),
                        recommendations=json.dumps(analysis.get("recommendations", [])),
                        summary=analysis.get("overall_summary", ""),
                    )
                    db.add(ar)

            for resume in all_resumes.values():
                resume.is_analyzed = True

            await db.commit()
            _analysis_status = {"running": False, "progress": "Analysis complete!", "done": total, "total": total, "error": None}

        except Exception as e:
            _analysis_status = {"running": False, "progress": "", "done": 0, "total": 0, "error": str(e)}
            raise


@app.post("/api/analysis/run")
async def run_analysis(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Start analysis as a background task and return immediately."""
    result = await db.execute(select(Resume))
    resumes = result.scalars().all()
    if not resumes:
        raise HTTPException(status_code=400, detail="No resumes uploaded yet")

    if _analysis_status["running"]:
        raise HTTPException(status_code=409, detail="Analysis already in progress")

    background_tasks.add_task(_run_full_analysis_bg)
    return {"message": "Analysis started", "resumes_queued": len(resumes)}


@app.get("/api/analysis/status")
async def get_analysis_status():
    """Poll this endpoint to track background analysis progress."""
    return _analysis_status


@app.get("/api/analysis/results")
async def get_all_results(db: AsyncSession = Depends(get_db)):
    """Return all analysis results grouped by job."""
    ar_result = await db.execute(select(AnalysisResult).order_by(AnalysisResult.job_id, AnalysisResult.match_score.desc()))
    all_ar = ar_result.scalars().all()

    resume_result = await db.execute(select(Resume))
    resumes = {r.id: r for r in resume_result.scalars().all()}

    grouped: dict = {}
    for ar in all_ar:
        resume = resumes.get(ar.resume_id)
        entry = {
            "resume_id": ar.resume_id,
            "candidate_name": resume.candidate_name if resume else "Unknown",
            "original_name": resume.original_name if resume else "",
            "job_id": ar.job_id,
            "job_title": ar.job_title,
            "match_score": ar.match_score,
            "vector_score": ar.vector_score,
            "matching_skills": json.loads(ar.matching_skills or "[]"),
            "missing_skills": json.loads(ar.missing_skills or "[]"),
            "grammar_issues": json.loads(ar.grammar_issues or "[]"),
            "strengths": json.loads(ar.strengths or "[]"),
            "recommendations": json.loads(ar.recommendations or "[]"),
            "summary": ar.summary,
        }
        grouped.setdefault(ar.job_id, {"job_title": ar.job_title, "top_resumes": []})
        grouped[ar.job_id]["top_resumes"].append(entry)

    return {"results": grouped, "total_jobs_analyzed": len(grouped)}


@app.get("/api/analysis/job/{job_id}")
async def get_job_results(job_id: str, db: AsyncSession = Depends(get_db)):
    """Get top-5 resumes for a specific job."""
    ar_result = await db.execute(
        select(AnalysisResult)
        .where(AnalysisResult.job_id == job_id)
        .order_by(AnalysisResult.match_score.desc())
    )
    all_ar = ar_result.scalars().all()

    if not all_ar:
        raise HTTPException(status_code=404, detail="No analysis found for this job")

    resume_result = await db.execute(select(Resume))
    resumes = {r.id: r for r in resume_result.scalars().all()}

    job = get_job_by_id(job_id)
    top_resumes = []
    for ar in all_ar:
        resume = resumes.get(ar.resume_id)
        top_resumes.append({
            "rank": len(top_resumes) + 1,
            "resume_id": ar.resume_id,
            "candidate_name": resume.candidate_name if resume else "Unknown",
            "original_name": resume.original_name if resume else "",
            "match_score": ar.match_score,
            "vector_score": ar.vector_score,
            "matching_skills": json.loads(ar.matching_skills or "[]"),
            "missing_skills": json.loads(ar.missing_skills or "[]"),
            "grammar_issues": json.loads(ar.grammar_issues or "[]"),
            "strengths": json.loads(ar.strengths or "[]"),
            "recommendations": json.loads(ar.recommendations or "[]"),
            "summary": ar.summary,
        })

    return {"job": job, "top_resumes": top_resumes}


@app.get("/api/analysis/resume/{resume_id}")
async def get_resume_analysis(resume_id: int, db: AsyncSession = Depends(get_db)):
    """Get all job analysis results for a specific resume."""
    ar_result = await db.execute(
        select(AnalysisResult)
        .where(AnalysisResult.resume_id == resume_id)
        .order_by(AnalysisResult.match_score.desc())
    )
    all_ar = ar_result.scalars().all()

    resume_result = await db.execute(select(Resume).where(Resume.id == resume_id))
    resume = resume_result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    job_results = []
    for ar in all_ar:
        job_results.append({
            "job_id": ar.job_id,
            "job_title": ar.job_title,
            "match_score": ar.match_score,
            "vector_score": ar.vector_score,
            "matching_skills": json.loads(ar.matching_skills or "[]"),
            "missing_skills": json.loads(ar.missing_skills or "[]"),
            "grammar_issues": json.loads(ar.grammar_issues or "[]"),
            "strengths": json.loads(ar.strengths or "[]"),
            "recommendations": json.loads(ar.recommendations or "[]"),
            "summary": ar.summary,
        })

    return {
        "resume": {
            "id": resume.id,
            "candidate_name": resume.candidate_name,
            "original_name": resume.original_name,
            "email": resume.email,
        },
        "job_results": job_results,
        "best_match": job_results[0] if job_results else None,
    }


@app.get("/api/analysis/winner")
async def get_winner(db: AsyncSession = Depends(get_db)):
    """Compute and return the overall winner resume across all JD analyses."""
    ar_result = await db.execute(select(AnalysisResult))
    all_ar = ar_result.scalars().all()

    if not all_ar:
        raise HTTPException(status_code=404, detail="No analysis results yet. Run analysis first.")

    resume_result = await db.execute(select(Resume))
    resumes = {r.id: r for r in resume_result.scalars().all()}

    results_by_jd: dict = {}
    for ar in all_ar:
        resume = resumes.get(ar.resume_id)
        entry = {
            "resume_id": ar.resume_id,
            "candidate_name": resume.candidate_name if resume else "Unknown",
            "job_title": ar.job_title,
            "match_score": ar.match_score,
        }
        results_by_jd.setdefault(ar.job_id, []).append(entry)

    winner = compute_winner(results_by_jd)
    return {"winner": winner}


@app.get("/api/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    """Dashboard summary statistics."""
    resume_count = (await db.execute(select(Resume))).scalars().all()
    analyzed_count = sum(1 for r in resume_count if r.is_analyzed)
    ar_count = len((await db.execute(select(AnalysisResult))).scalars().all())

    return {
        "total_resumes": len(resume_count),
        "analyzed_resumes": analyzed_count,
        "total_analyses": ar_count,
        "total_jobs": 20,
        "pinecone_vectors": get_resume_count(),
    }
