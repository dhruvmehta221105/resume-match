import axios from "axios";
import type { Resume, AllResults, Winner, Stats, Job, AnalysisEntry } from "../types";

const api = axios.create({ baseURL: "/api" });

export const resumeApi = {
  upload: async (files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    const { data } = await api.post("/resumes/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  list: async (): Promise<{ resumes: Resume[]; total: number; pinecone_count: number }> => {
    const { data } = await api.get("/resumes");
    return data;
  },

  delete: async (id: number) => {
    const { data } = await api.delete(`/resumes/${id}`);
    return data;
  },
};

export const analysisApi = {
  run: async () => {
    const { data } = await api.post("/analysis/run");
    return data;
  },

  getStatus: async (): Promise<{
    running: boolean;
    progress: string;
    done: number;
    total: number;
    error: string | null;
  }> => {
    const { data } = await api.get("/analysis/status");
    return data;
  },

  getAllResults: async (): Promise<AllResults> => {
    const { data } = await api.get("/analysis/results");
    return data;
  },

  getJobResults: async (jobId: string) => {
    const { data } = await api.get(`/analysis/job/${jobId}`);
    return data;
  },

  getResumeAnalysis: async (resumeId: number): Promise<{
    resume: Resume;
    job_results: AnalysisEntry[];
    best_match: AnalysisEntry | null;
  }> => {
    const { data } = await api.get(`/analysis/resume/${resumeId}`);
    return data;
  },

  getWinner: async (): Promise<{ winner: Winner }> => {
    const { data } = await api.get("/analysis/winner");
    return data;
  },
};

export const jobsApi = {
  list: async (): Promise<{ jobs: Job[]; total: number }> => {
    const { data } = await api.get("/jobs");
    return data;
  },
};

export const statsApi = {
  get: async (): Promise<Stats> => {
    const { data } = await api.get("/stats");
    return data;
  },
};
