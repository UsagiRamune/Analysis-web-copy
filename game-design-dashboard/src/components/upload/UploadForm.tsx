import type { UploadMeta } from "../../types/models";

type Props = {
  meta: UploadMeta;
  onChange: (meta: UploadMeta) => void;
};

export default function UploadForm({ meta, onChange }: Props) {
  const set = (key: keyof UploadMeta, value: string) =>
    onChange({ ...meta, [key]: value });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-6 rounded-xl border">
      <label className="text-sm">
        Student ID
        <input className="mt-1 w-full border rounded-lg px-3 py-2"
          value={meta.studentId}
          onChange={(e) => set("studentId", e.target.value)}
        />
      </label>

      <label className="text-sm">
        Student Name
        <input className="mt-1 w-full border rounded-lg px-3 py-2"
          value={meta.studentName}
          onChange={(e) => set("studentName", e.target.value)}
        />
      </label>

      <label className="text-sm">
        Course Code
        <input className="mt-1 w-full border rounded-lg px-3 py-2"
          value={meta.courseCode}
          onChange={(e) => set("courseCode", e.target.value)}
        />
      </label>

      <label className="text-sm">
        Assignment ID
        <input className="mt-1 w-full border rounded-lg px-3 py-2"
          value={meta.assignmentId}
          onChange={(e) => set("assignmentId", e.target.value)}
        />
      </label>
    </div>
  );
}
