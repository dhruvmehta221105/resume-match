import { useState, useEffect } from "react";
import { Briefcase, MapPin, Clock, GraduationCap, ChevronDown, ChevronUp } from "lucide-react";
import { jobsApi } from "../api/client";
import type { Job } from "../types";

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    jobsApi.list().then((d) => setJobs(d.jobs)).catch(() => {});
  }, []);

  const filtered = jobs.filter(
    (j) =>
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.company.toLowerCase().includes(search.toLowerCase()) ||
      j.required_skills.some((s) => s.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Job Descriptions</h1>
        <p className="text-gray-400 mt-1">Job descriptions used for resume matching</p>
      </div>

      <input
        type="text"
        placeholder="Search by title, company, or skill..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
      />

      <div className="grid grid-cols-1 gap-3">
        {filtered.map((job) => (
          <div key={job.id} className="card border border-gray-800">
            <button
              className="w-full text-left"
              onClick={() => setExpanded(expanded === job.id ? null : job.id)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-semibold text-white">{job.title}</h3>
                    <span className="badge bg-blue-900/40 text-blue-300 border border-blue-800">{job.department}</span>
                  </div>
                  <p className="text-gray-400 text-sm mt-1">{job.company}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                    <span className="flex items-center gap-1"><MapPin size={12} /> {job.location}</span>
                    <span className="flex items-center gap-1"><Clock size={12} /> {job.experience_years} yrs</span>
                    <span className="flex items-center gap-1"><GraduationCap size={12} /> {job.education.split(";")[0]}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {job.required_skills.slice(0, 6).map((s) => (
                      <span key={s} className="badge bg-gray-800 text-gray-300 border border-gray-700">{s}</span>
                    ))}
                    {job.required_skills.length > 6 && (
                      <span className="badge bg-gray-800 text-gray-500 border border-gray-700">+{job.required_skills.length - 6} more</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-600 font-mono uppercase">{job.id}</span>
                  {expanded === job.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </div>
            </button>

            {expanded === job.id && (
              <div className="mt-4 pt-4 border-t border-gray-800 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2">Required Skills</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {job.required_skills.map((s) => (
                        <span key={s} className="badge bg-green-900/40 text-green-300 border border-green-800">{s}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-2">Preferred Skills</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {job.preferred_skills.map((s) => (
                        <span key={s} className="badge bg-purple-900/40 text-purple-300 border border-purple-800">{s}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    <Briefcase size={12} className="inline mr-1" />Job Description
                  </h4>
                  <p className="text-gray-300 text-sm whitespace-pre-line leading-relaxed">{job.description.trim()}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
