import json
from typing import Dict, List

import anthropic

from config import settings

CLAUDE_MODEL = "claude-sonnet-4-6"

_client = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    return _client


def analyze_resume_for_job(
    resume_text: str,
    candidate_name: str,
    job: Dict,
    vector_score: float,
) -> Dict:
    """
    Use Claude to deeply analyze a resume against a specific job description.
    Returns structured analysis with scores, skills, gaps, grammar issues, etc.
    """
    required_skills = ", ".join(job["required_skills"])
    preferred_skills = ", ".join(job.get("preferred_skills", []))

    prompt = f"""You are an expert HR analyst and technical recruiter. Analyze the following resume against the job description and provide a detailed, structured analysis.

## Job Description
**Title:** {job['title']}
**Company:** {job['company']}
**Required Skills:** {required_skills}
**Preferred Skills:** {preferred_skills}
**Experience Required:** {job['experience_years']} years
**Education:** {job['education']}

**Full JD:**
{job['description']}

---

## Resume of: {candidate_name}
{resume_text}

---

## Your Task
Provide a JSON response with this exact structure (no markdown, pure JSON):

{{
  "match_score": <integer 0-100, holistic fit score>,
  "matching_skills": [<list of skills from JD that candidate has>],
  "missing_skills": [<list of required skills the candidate is missing>],
  "preferred_skills_matched": [<list of preferred skills the candidate has>],
  "grammar_issues": [
    {{
      "issue": "<description of the grammatical/language problem>",
      "severity": "<low|medium|high>",
      "suggestion": "<how to fix it>"
    }}
  ],
  "strengths": [<3-5 key strengths relevant to this role>],
  "weaknesses": [<2-4 areas where candidate falls short for this role>],
  "recommendations": [<3-5 specific, actionable improvement suggestions>],
  "experience_assessment": "<brief assessment of their experience level vs requirements>",
  "education_assessment": "<brief assessment of their education vs requirements>",
  "overall_summary": "<2-3 sentence professional summary of this candidate for this role>",
  "hire_recommendation": "<strong_yes|yes|maybe|no>",
  "hire_reason": "<one sentence explaining the hire recommendation>"
}}

Be honest, specific, and actionable. Base scores on actual resume content."""

    client = _get_client()
    message = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()

    raw = raw.strip("```json").strip("```").strip()

    try:
        analysis = json.loads(raw)
    except json.JSONDecodeError:
        analysis = _fallback_analysis(job, vector_score)

    analysis["vector_score"] = round(vector_score * 100, 2)
    analysis["candidate_name"] = candidate_name

    return analysis


def compute_winner(results_by_jd: Dict[str, List[Dict]]) -> Dict:
    """
    Determine the overall winner resume across all job analyses.
    Scoring: weighted by match_score and frequency of top-5 appearances.
    """
    candidate_scores: Dict[int, Dict] = {}

    for job_id, top_resumes in results_by_jd.items():
        for rank, resume_data in enumerate(top_resumes, start=1):
            rid = resume_data["resume_id"]
            score = resume_data.get("match_score", 0)
            rank_weight = (6 - rank) / 5  # rank 1 = 1.0, rank 5 = 0.2

            if rid not in candidate_scores:
                candidate_scores[rid] = {
                    "resume_id": rid,
                    "candidate_name": resume_data.get("candidate_name", "Unknown"),
                    "total_weighted_score": 0.0,
                    "appearances": 0,
                    "jobs_matched": [],
                    "avg_match_score": 0.0,
                    "scores": [],
                }

            candidate_scores[rid]["total_weighted_score"] += score * rank_weight
            candidate_scores[rid]["appearances"] += 1
            candidate_scores[rid]["jobs_matched"].append(resume_data.get("job_title", job_id))
            candidate_scores[rid]["scores"].append(score)

    for rid, data in candidate_scores.items():
        data["avg_match_score"] = round(
            sum(data["scores"]) / len(data["scores"]), 2
        )

    if not candidate_scores:
        return {}

    winner = max(
        candidate_scores.values(),
        key=lambda x: (x["total_weighted_score"], x["appearances"]),
    )
    winner["total_weighted_score"] = round(winner["total_weighted_score"], 2)
    return winner


def _fallback_analysis(job: Dict, vector_score: float) -> Dict:
    """Returns a safe fallback if Claude response parsing fails."""
    return {
        "match_score": round(vector_score * 100),
        "matching_skills": [],
        "missing_skills": job["required_skills"],
        "preferred_skills_matched": [],
        "grammar_issues": [],
        "strengths": ["Unable to extract - please re-analyze"],
        "weaknesses": [],
        "recommendations": ["Please re-run analysis"],
        "experience_assessment": "Unable to assess",
        "education_assessment": "Unable to assess",
        "overall_summary": "Analysis could not be completed. Please retry.",
        "hire_recommendation": "maybe",
        "hire_reason": "Insufficient data to make recommendation",
    }
