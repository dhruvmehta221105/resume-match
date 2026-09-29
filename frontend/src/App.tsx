import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { Upload, LayoutDashboard, Briefcase } from "lucide-react";
import UploadPage from "./pages/UploadPage";
import DashboardPage from "./pages/DashboardPage";
import JobsPage from "./pages/JobsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: "#1f2937", color: "#f9fafb", border: "1px solid #374151" },
        }}
      />
      <div className="min-h-screen flex flex-col">
        <nav className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-8">
          <span className="text-xl font-bold text-blue-400 tracking-tight">
            ResumeMatch <span className="text-gray-500 text-sm font-normal">AI</span>
          </span>
          <div className="flex gap-2">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`
              }
            >
              <Upload size={16} /> Upload Resumes
            </NavLink>
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`
              }
            >
              <LayoutDashboard size={16} /> Dashboard
            </NavLink>
            <NavLink
              to="/jobs"
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`
              }
            >
              <Briefcase size={16} /> Job Descriptions
            </NavLink>
          </div>
        </nav>
        <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/jobs" element={<JobsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
