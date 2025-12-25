import { useState } from "react";
import { useNavigate } from "react-router-dom";
import UploadDropzone from "../components/upload/UploadDropzone";
import UploadForm from "../components/upload/UploadForm";
import { uploadAndAnalyze } from "../services/analysisService";
import type { UploadMeta } from "../types/models";

export default function UploadPage() {
  const nav = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<UploadMeta>({
    studentId: "",
    studentName: "",
    courseCode: "",
    assignmentId: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    !!file &&
    meta.studentId.trim() &&
    meta.studentName.trim() &&
    meta.courseCode.trim() &&
    meta.assignmentId.trim();

  async function onSubmit() {
    setError(null);
    if (!file) return setError("Please select a file.");
    if (!canSubmit) return setError("Please fill in all fields.");

    try {
      setLoading(true);
      await uploadAndAnalyze(file, meta); // mock mode จะสร้างผลวิเคราะห์ปลอมให้
      nav("/dashboard");
    } catch (e: any) {
      setError(e?.message ?? "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Upload Assignment</h1>

      <UploadDropzone file={file} onPick={setFile} />
      <UploadForm meta={meta} onChange={setMeta} />

      {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">{error}</div>}

      <button
        onClick={onSubmit}
        disabled={!canSubmit || loading}
        className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
      >
        {loading ? "Submitting..." : "Submit"}
      </button>
    </div>
  );
}
