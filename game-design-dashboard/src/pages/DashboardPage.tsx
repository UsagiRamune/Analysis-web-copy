import { useEffect, useMemo, useState } from "react";
import { listResults } from "../services/analysisService";
import type { AnalysisResult } from "../types/models";
import SubmissionList from "../components/dashboard/SubmissionList";
import SubmissionDetail from "../components/dashboard/SubmissionDetail";

export default function DashboardPage() {
  const [items, setItems] = useState<AnalysisResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await listResults();
      setItems(res);
      setSelectedId(res[0]?.submissionId ?? null);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((x) =>
      [x.meta.studentName, x.meta.studentId, x.meta.courseCode, x.meta.assignmentId]
        .join(" ")
        .toLowerCase()
        .includes(s)
    );
  }, [items, q]);

  const selected = filtered.find((x) => x.submissionId === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="bg-white border rounded-xl p-4 flex items-center gap-3">
        <input
          className="w-full border rounded-lg px-3 py-2"
          placeholder="Search by name / ID / course / assignment..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-gray-600">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SubmissionList
            items={filtered}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <div className="md:col-span-2">
            <SubmissionDetail item={selected} />
          </div>
        </div>
      )}
    </div>
  );
}
