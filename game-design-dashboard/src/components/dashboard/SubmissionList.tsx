import type { AnalysisResult } from "../../types/models";

type Props = {
  items: AnalysisResult[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export default function SubmissionList({ items, selectedId, onSelect }: Props) {
  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b font-semibold">Submissions</div>
      <div className="divide-y">
        {items.map((x) => (
          <button
            key={x.submissionId}
            className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${
              selectedId === x.submissionId ? "bg-gray-50" : ""
            }`}
            onClick={() => onSelect(x.submissionId)}
          >
            <div className="font-semibold">{x.meta.studentName}</div>
            <div className="text-sm text-gray-600">
              {x.meta.courseCode} • {x.meta.assignmentId}
            </div>
            <div className="text-xs text-gray-400">{new Date(x.createdAt).toLocaleString()}</div>
          </button>
        ))}
        {items.length === 0 && (
          <div className="px-4 py-6 text-sm text-gray-500">No submissions yet.</div>
        )}
      </div>
    </div>
  );
}
