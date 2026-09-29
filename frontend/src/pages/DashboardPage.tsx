import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import { Trophy, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, XCircle, Lightbulb, Star } from "lucide-react";
import { analysisApi } from "../api/client";
import type { AllResults, Winner, AnalysisEntry, GrammarIssue } from "../types";

const SCORE_COLOR = (score: number) => {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#3b82f6";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
};

const SEVERITY_STYLES: Record<GrammarIssue["severity"], string> = {
  high: "bg-red-900/40 text-red-400 border-red-800",
  medium: "bg-yellow-900/40 text-yellow-400 border-yellow-800",
  low: "bg-blue-900/40 text-blue-400 border-blue-800",
};

function ScoreBadge({ score }: { score: number }) {
  return (
    <span
      className="text-lg font-bold px-3 py-1 rounded-lg"
      style={{ color: SCORE_COLOR(score), background: `${SCORE_COLOR(score)}20` }}
    >
      {score}%
    </span>
  );
}

function ResumeCard({ entry, rank }: { entry: AnalysisEntry; rank: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 hover:bg-gray-700/40 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          <span className="text-2xl font-black text-gray-600">#{rank}</span>
          <div>
            <p className="font-semibold text-white">{entry.candidate_name}</p>
            <p className="text-sm text-gray-400">{entry.original_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-xs text-gray-500">AI Score</div>
            <ScoreBadge score={entry.match_score} />
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-xs text-gray-500">Vector</div>
            <span className="text-sm font-medium text-gray-300">{entry.vector_score.toFixed(1)}%</span>
          </div>
          {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="p-4 border-t border-gray-700 space-y-5">
          <p className="text-gray-300 text-sm leading-relaxed">{entry.summary}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <CheckCircle size={12} /> Matching Skills ({entry.matching_skills.length})
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {entry.matching_skills.length > 0 ? (
                  entry.matching_skills.map((s) => (
                    <span key={s} className="badge bg-green-900/40 text-green-300 border border-green-800">{s}</span>
                  ))
                ) : (
                  <span className="text-gray-500 text-sm">None identified</span>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <XCircle size={12} /> Skill Gaps ({entry.missing_skills.length})
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {entry.missing_skills.length > 0 ? (
                  entry.missing_skills.map((s) => (
                    <span key={s} className="badge bg-red-900/40 text-red-300 border border-red-800">{s}</span>
                  ))
                ) : (
                  <span className="text-green-400 text-sm">No gaps!</span>
                )}
              </div>
            </div>
          </div>

          {entry.strengths.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Star size={12} /> Strengths
              </h4>
              <ul className="space-y-1">
                {entry.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-gray-300 flex gap-2">
                    <span className="text-blue-400 mt-0.5">•</span> {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {entry.grammar_issues.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-yellow-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <AlertTriangle size={12} /> Grammar / Language Issues ({entry.grammar_issues.length})
              </h4>
              <div className="space-y-2">
                {entry.grammar_issues.map((g, i) => (
                  <div key={i} className={`border rounded-lg p-3 text-sm ${SEVERITY_STYLES[g.severity]}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium capitalize">{g.severity} severity</span>
                    </div>
                    <p className="text-gray-300">{g.issue}</p>
                    <p className="text-gray-400 mt-1 text-xs">Fix: {g.suggestion}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {entry.recommendations.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Lightbulb size={12} /> Recommendations
              </h4>
              <ul className="space-y-1">
                {entry.recommendations.map((r, i) => (
                  <li key={i} className="text-sm text-gray-300 flex gap-2">
                    <span className="text-purple-400 mt-0.5">{i + 1}.</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WinnerCard({ winner }: { winner: Winner }) {
  const radarData = winner.jobs_matched.slice(0, 6).map((job, i) => ({
    job: job.replace(" Engineer", "").replace(" Developer", "").slice(0, 18),
    score: winner.scores[i] ?? 0,
  }));

  return (
    <div className="card border-2 border-yellow-500/50 bg-yellow-950/10">
      <div className="flex items-center gap-3 mb-4">
        <Trophy size={32} className="text-yellow-400" />
        <div>
          <h2 className="text-xl font-bold text-yellow-300">Overall Winner</h2>
          <p className="text-gray-400 text-sm">Best performing resume across all job descriptions</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        <div className="space-y-3">
          <div>
            <p className="text-3xl font-black text-white">{winner.candidate_name}</p>
            <p className="text-yellow-400 font-semibold mt-1">Resume ID #{winner.resume_id}</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-400">{winner.avg_match_score}%</p>
              <p className="text-gray-400 text-xs">Avg Score</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-blue-400">{winner.appearances}</p>
              <p className="text-gray-400 text-xs">Top 5 Hits</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-purple-400">{winner.total_weighted_score.toFixed(0)}</p>
              <p className="text-gray-400 text-xs">Total Score</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Matched Jobs:</p>
            <div className="flex flex-wrap gap-1">
              {winner.jobs_matched.map((j, i) => (
                <span key={i} className="badge bg-yellow-900/40 text-yellow-300 border border-yellow-800 text-xs">{j}</span>
              ))}
            </div>
          </div>
        </div>
        {radarData.length >= 3 && (
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#374151" />
              <PolarAngleAxis dataKey="job" tick={{ fill: "#9ca3af", fontSize: 10 }} />
              <Radar dataKey="score" stroke="#eab308" fill="#eab308" fillOpacity={0.25} />
            </RadarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [results, setResults] = useState<AllResults | null>(null);
  const [winner, setWinner] = useState<Winner | null>(null);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [allResults, winnerData] = await Promise.all([
        analysisApi.getAllResults(),
        analysisApi.getWinner().catch(() => null),
      ]);
      setResults(allResults);
      if (winnerData) setWinner(winnerData.winner);
      if (allResults.results && Object.keys(allResults.results).length > 0) {
        setSelectedJob(Object.keys(allResults.results)[0]);
      }
    } catch {
      toast.error("No analysis results yet. Upload resumes and run analysis first.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400">Loading analysis results...</p>
        </div>
      </div>
    );
  }

  if (!results || Object.keys(results.results).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle size={48} className="text-yellow-400" />
        <p className="text-xl font-semibold text-white">No Results Yet</p>
        <p className="text-gray-400">Upload resumes and click "Run AI Analysis" on the Upload page</p>
      </div>
    );
  }

  const jobEntries = Object.entries(results.results);
  const currentJob = selectedJob ? results.results[selectedJob] : null;

  const overviewData = jobEntries.map(([, job]) => ({
    name: job.job_title.replace(" Engineer", "").replace(" Developer", ""),
    topScore: job.top_resumes[0]?.match_score ?? 0,
    avgScore: Math.round(
      job.top_resumes.reduce((sum, r) => sum + r.match_score, 0) / (job.top_resumes.length || 1)
    ),
  })).slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Analysis Dashboard</h1>
        <p className="text-gray-400 mt-1">
          {results.total_jobs_analyzed} job descriptions analyzed
        </p>
      </div>

      {winner && <WinnerCard winner={winner} />}

      <div className="card">
        <h2 className="font-semibold text-white mb-4">Top Score per Job Description</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={overviewData} margin={{ left: -20, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 11 }} angle={-30} textAnchor="end" height={55} />
            <YAxis domain={[0, 100]} tick={{ fill: "#6b7280", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }}
              labelStyle={{ color: "#f9fafb" }}
            />
            <Bar dataKey="topScore" name="Top Score" radius={[4, 4, 0, 0]}>
              {overviewData.map((entry, i) => (
                <Cell key={i} fill={SCORE_COLOR(entry.topScore)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="card lg:col-span-1 h-fit">
          <h2 className="font-semibold text-white mb-3 text-sm">Job Descriptions</h2>
          <div className="space-y-1 max-h-[520px] overflow-y-auto pr-1">
            {jobEntries.map(([jdId, job]) => {
              const top = job.top_resumes[0];
              return (
                <button
                  key={jdId}
                  onClick={() => setSelectedJob(jdId)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors text-sm ${
                    selectedJob === jdId
                      ? "bg-blue-600 text-white"
                      : "text-gray-300 hover:bg-gray-800"
                  }`}
                >
                  <div className="font-medium truncate">{job.job_title}</div>
                  {top && (
                    <div className="text-xs opacity-70 mt-0.5">
                      Best: {top.match_score}% — {top.candidate_name}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-3">
          {currentJob && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">{currentJob.job_title}</h2>
                <span className="badge bg-blue-900/50 text-blue-300 border border-blue-800">
                  Top {currentJob.top_resumes.length} Resumes
                </span>
              </div>
              {currentJob.top_resumes.length === 0 ? (
                <div className="card text-center text-gray-400 py-10">
                  No matching resumes found for this job.
                </div>
              ) : (
                currentJob.top_resumes.map((entry, i) => (
                  <ResumeCard key={entry.resume_id} entry={entry} rank={i + 1} />
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
