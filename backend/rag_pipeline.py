from typing import List, Dict, Tuple
from functools import lru_cache

from sentence_transformers import SentenceTransformer
from pinecone import Pinecone, ServerlessSpec

from config import settings
from job_descriptions import JOB_DESCRIPTIONS, get_job_text


EMBEDDING_MODEL = "all-mpnet-base-v2"  # 768-dim, runs locally, no API key needed
EMBEDDING_DIM = 768
RESUME_NAMESPACE = "resumes"


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    print(f"Loading embedding model '{EMBEDDING_MODEL}' (first run downloads ~420MB)...")
    return SentenceTransformer(EMBEDDING_MODEL)


@lru_cache(maxsize=1)
def _get_pinecone_index():
    pc = Pinecone(api_key=settings.pinecone_api_key)
    index_name = settings.pinecone_index_name

    existing = [idx.name for idx in pc.list_indexes()]
    if index_name not in existing:
        pc.create_index(
            name=index_name,
            dimension=EMBEDDING_DIM,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region=settings.pinecone_environment),
        )
        import time
        time.sleep(10)

    return pc.Index(index_name)


def embed_texts(texts: List[str]) -> List[List[float]]:
    model = _get_model()
    embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    return embeddings.tolist()


def upsert_resume(resume_id: int, resume_text: str, metadata: Dict) -> None:
    index = _get_pinecone_index()
    embedding = embed_texts([resume_text])[0]

    index.upsert(
        vectors=[
            {
                "id": f"resume_{resume_id}",
                "values": embedding,
                "metadata": {
                    "resume_id": resume_id,
                    "candidate_name": metadata.get("candidate_name", "Unknown"),
                    "email": metadata.get("email", ""),
                    "original_name": metadata.get("original_name", ""),
                },
            }
        ],
        namespace=RESUME_NAMESPACE,
    )


def delete_resume(resume_id: int) -> None:
    index = _get_pinecone_index()
    index.delete(ids=[f"resume_{resume_id}"], namespace=RESUME_NAMESPACE)


def query_top_resumes_for_job(job_text: str, top_k: int = 5) -> List[Tuple[int, float]]:
    index = _get_pinecone_index()
    query_embedding = embed_texts([job_text])[0]

    results = index.query(
        vector=query_embedding,
        top_k=top_k,
        namespace=RESUME_NAMESPACE,
        include_metadata=True,
    )

    matches = []
    for match in results.matches:
        resume_id = match.metadata.get("resume_id")
        if resume_id is not None:
            matches.append((int(resume_id), float(match.score)))
    return matches


def match_all_jobs_to_resumes(top_k: int = 5) -> Dict[str, List[Tuple[int, float]]]:
    results = {}
    for jd in JOB_DESCRIPTIONS:
        job_text = get_job_text(jd)
        matches = query_top_resumes_for_job(job_text, top_k=top_k)
        results[jd["id"]] = matches
    return results


def get_resume_count() -> int:
    index = _get_pinecone_index()
    stats = index.describe_index_stats()
    ns_stats = stats.namespaces.get(RESUME_NAMESPACE)
    return ns_stats.vector_count if ns_stats else 0
