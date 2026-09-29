export interface Resume {
  id: number;
  original_name: string;
  candidate_name: string;
  email: string;
  phone: string;
  uploaded_at: string;
  is_analyzed: boolean;
  word_count: number;
}

export interface GrammarIssue {
  issue: string;
  severity: "low" | "medium" | "high";
  suggestion: string;
}

export interface AnalysisEntry {
  resume_id: number;
  candidate_name: string;
  original_name: string;
  job_id: string;
  job_title: string;
  match_score: number;
  vector_score: number;
  matching_skills: string[];
  missing_skills: string[];
  grammar_issues: GrammarIssue[];
  strengths: string[];
  recommendations: string[];
  summary: string;
}

export interface JobResult {
  job_title: string;
  top_resumes: AnalysisEntry[];
}

export interface AllResults {
  results: Record<string, JobResult>;
  total_jobs_analyzed: number;
}

export interface Winner {
  resume_id: number;
  candidate_name: string;
  total_weighted_score: number;
  appearances: number;
  jobs_matched: string[];
  avg_match_score: number;
  scores: number[];
}

export interface Stats {
  total_resumes: number;
  analyzed_resumes: number;
  total_analyses: number;
  total_jobs: number;
  pinecone_vectors: number;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  department: string;
  required_skills: string[];
  preferred_skills: string[];
  description: string;
  experience_years: string;
  education: string;
  location: string;
}
