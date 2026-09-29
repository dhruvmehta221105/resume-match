import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import { Upload, FileText, Trash2, CheckCircle, AlertCircle, Loader2, Play } from "lucide-react";
import clsx from "clsx";
import { resumeApi, analysisApi, statsApi } from "../api/client";
import type { Resume, Stats } from "../types";

export default function UploadPage() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const fetchResumes = useCallback(async () => {
    try {
      const data = await resumeApi.list();
      setResumes(data.resumes);
    } catch {
      toast.error("Failed to fetch resumes");
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const s = await statsApi.get();
      setStats(s);
    } catch {}
  }, []);

  useEffect(() => {
    fetchResumes();
    fetchStats();
  }, [fetchResumes, fetchStats]);

  const onDrop = useCallback((accepted: File[]) => {
    setPendingFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      const newFiles = accepted.filter((f) => !existing.has(f.name));
      return [...prev, ...newFiles];
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] },
    maxSize: 10 * 1024 * 1024,
  });

  const removePending = (name: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const handleUpload = async () => {
    if (!pendingFiles.length) return;
    setUploading(true);
    try {
      const result = await resumeApi.upload(pendingFiles);
      if (result.total_uploaded > 0) {
        toast.success(`Uploaded ${result.total_uploaded} resume(s) successfully`);
      }
      if (result.total_errors > 0) {
        result.errors.forEach((e: { file: string; error: string }) =>
          toast.error(`${e.file}: ${e.error}`)
        );
      }
      setPendingFiles([]);
      await fetchResumes();
      await fetchStats();
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await resumeApi.delete(id);
      toast.success("Resume deleted");
      await fetchResumes();
      await fetchStats();
    } catch {
      toast.error("Delete failed");
    }
  };

  const handleRunAnalysis = async () => {
    setAnalyzing(true);
    toast.loading("Starting analysis…", { id: "analysis" });

    try {
      await analysisApi.run();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to start analysis", { id: "analysis" });
      setAnalyzing(false);
      return;
    }

    // Poll /api/analysis/status until the background task finishes
    const poll = async () => {
      try {
        const status = await analysisApi.getStatus();

        if (status.error) {
          toast.error(`Analysis failed: ${status.error}`, { id: "analysis" });
          setAnalyzing(false);
          return;
        }

        if (status.running) {
          const label = status.total > 0
            ? `${status.progress} (${status.done}/${status.total})`
            : status.progress;
          toast.loading(label, { id: "analysis" });
          setTimeout(poll, 3000);
          return;
        }

        // Done
        toast.success("Analysis complete! View results on the Dashboard.", { id: "analysis" });
        setAnalyzing(false);
        await fetchResumes();
        await fetchStats();
      } catch {
        // Transient network error — keep polling
        setTimeout(poll, 3000);
      }
    };

    setTimeout(poll, 1500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Resume Upload</h1>
        <p className="text-gray-400 mt-1">Upload student resumes to match against job descriptions using AI</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Resumes", value: stats.total_resumes, color: "text-blue-400" },
            { label: "Analyzed", value: stats.analyzed_resumes, color: "text-green-400" },
            { label: "Job Descriptions", value: stats.total_jobs, color: "text-purple-400" },
            { label: "Pinecone Vectors", value: stats.pinecone_vectors, color: "text-yellow-400" },
          ].map((s) => (
            <div key={s.label} className="card text-center">
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-gray-400 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div
        {...getRootProps()}
        className={clsx(
          "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all",
          isDragActive
            ? "border-blue-500 bg-blue-950/30"
            : "border-gray-700 hover:border-blue-600 hover:bg-gray-900/50"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto mb-3 text-blue-400" size={40} />
        <p className="text-white font-semibold text-lg">
          {isDragActive ? "Drop files here..." : "Drag & drop resumes here"}
        </p>
        <p className="text-gray-400 mt-1">or click to browse — PDF and DOCX supported, max 10MB each</p>
        <p className="text-gray-500 text-sm mt-2">Supports bulk upload of multiple files at once</p>
      </div>

      {pendingFiles.length > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">Ready to upload ({pendingFiles.length} files)</h2>
            <button onClick={handleUpload} disabled={uploading} className="btn-primary flex items-center gap-2">
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading ? "Uploading..." : "Upload All"}
            </button>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {pendingFiles.map((f) => (
              <div key={f.name} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-2">
                <div className="flex items-center gap-3">
                  <FileText size={16} className="text-blue-400" />
                  <span className="text-sm text-gray-200">{f.name}</span>
                  <span className="text-xs text-gray-500">{(f.size / 1024).toFixed(0)} KB</span>
                </div>
                <button onClick={() => removePending(f.name)} className="text-gray-500 hover:text-red-400 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {resumes.length > 0 && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white text-lg">Uploaded Resumes ({resumes.length})</h2>
            <button
              onClick={handleRunAnalysis}
              disabled={analyzing}
              className="btn-primary flex items-center gap-2"
            >
              {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {analyzing ? "Analyzing..." : "Run AI Analysis"}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left border-b border-gray-800">
                  <th className="pb-3 pr-4">Candidate</th>
                  <th className="pb-3 pr-4">File</th>
                  <th className="pb-3 pr-4">Email</th>
                  <th className="pb-3 pr-4">Words</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {resumes.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="py-3 pr-4 font-medium text-white">{r.candidate_name}</td>
                    <td className="py-3 pr-4 text-gray-400 max-w-xs truncate">{r.original_name}</td>
                    <td className="py-3 pr-4 text-gray-400">{r.email || "—"}</td>
                    <td className="py-3 pr-4 text-gray-400">{r.word_count}</td>
                    <td className="py-3 pr-4">
                      {r.is_analyzed ? (
                        <span className="badge bg-green-900/50 text-green-400 flex items-center gap-1 w-fit">
                          <CheckCircle size={12} /> Analyzed
                        </span>
                      ) : (
                        <span className="badge bg-yellow-900/50 text-yellow-400 flex items-center gap-1 w-fit">
                          <AlertCircle size={12} /> Pending
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="text-gray-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
