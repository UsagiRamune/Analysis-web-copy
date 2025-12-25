import type { AnalysisResult } from "../../types/models";

export default function SubmissionDetail({ item }: { item: AnalysisResult | null }) {
  if (!item) {
    return (
      <div className="bg-white border rounded-xl p-6 text-gray-500">
        Select a submission to view details.
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-xl p-6 space-y-4">
      <div>
        <div className="text-xl font-bold">{item.meta.studentName}</div>
        <div className="text-sm text-gray-600">
          {item.meta.studentId} • {item.meta.courseCode} • {item.meta.assignmentId}
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-gray-50">
        <div className="font-semibold mb-1">UX Scenario</div>
        <div className="text-sm">{item.uxScenarioText}</div>
      </div>

      <div className="flex flex-wrap gap-2">
        {item.tags.map((t) => (
          <span key={t} className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
            {t}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {Object.entries(item.ethicalRadar).map(([k, v]) => (
          <div key={k} className="border rounded-lg p-3">
            <div className="text-xs text-gray-500">{k}</div>
            <div className="text-lg font-semibold">{v}</div>
          </div>
        ))}
      </div>

      <div className="border rounded-lg p-4">
        <div className="font-semibold mb-1">Summary</div>
        <div className="text-sm text-gray-700">{item.summaryNote}</div>
      </div>

      <div className="border rounded-lg p-4">
        <div className="font-semibold mb-2">Findings</div>
        <div className="space-y-2">
          {item.findings.map((f) => (
            <div key={f.id} className="border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{f.title}</div>
                <span className="text-xs px-2 py-1 rounded bg-gray-100">
                  {f.severity}
                </span>
              </div>
              <p className="text-sm text-gray-700 mt-1">{f.description}</p>
              {f.suggestion && (
                <p className="text-sm text-gray-600 mt-2">
                  <b>Suggestion:</b> {f.suggestion}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
