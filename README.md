# Resume Matcher AI

AI-powered resume screening and job matching platform that uses **semantic search and LLM-based analysis** to match candidates with job descriptions.

## Features

* Upload and parse PDF/DOCX resumes
* Semantic resume-to-job matching
* AI-generated match scores and insights
* Skill gap and experience analysis
* Resume strengths and recommendations
* Job-wise candidate ranking
* Dashboard with analytics

## Tech Stack

**Frontend:** React, TypeScript, Vite, Tailwind CSS
**Backend:** FastAPI, Python, SQLAlchemy, SQLite
**AI/ML:** Sentence Transformers, Anthropic Claude
**Vector DB:** Pinecone
**Parsing:** PyMuPDF, python-docx

## Architecture

```text
Resume → Parser → Embeddings → Pinecone
                              ↓
Job Description → Embedding → Semantic Search
                              ↓
                         Top Candidates
                              ↓
                           Claude AI
                              ↓
                    Match Score & Analysis
```

## Setup

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Create `backend/.env`:

```env
ANTHROPIC_API_KEY=your_key
PINECONE_API_KEY=your_key
PINECONE_INDEX_NAME=resume-matcher
```

## API Documentation

Once the backend is running:

```text
http://localhost:8000/docs
```

## Future Scope

* Authentication & role-based access
* Custom job creation
* Resume analytics
* CSV/PDF export
* PostgreSQL support
* Docker deployment

## License

MIT License
