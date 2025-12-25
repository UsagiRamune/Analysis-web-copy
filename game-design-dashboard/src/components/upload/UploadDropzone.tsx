import { useRef } from "react";

type Props = {
  file: File | null;
  onPick: (file: File) => void;
};

export default function UploadDropzone({ file, onPick }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div
      className="border-2 border-dashed rounded-xl p-6 bg-white"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f) onPick(f);
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold">Upload assignment file</p>
          <p className="text-sm text-gray-600">
            Drag & drop PDF/DOCX here or click to choose file
          </p>
          {file && <p className="text-sm mt-2">Selected: <b>{file.name}</b></p>}
        </div>

        <button
          type="button"
          className="px-4 py-2 rounded-lg bg-gray-900 text-white"
          onClick={() => inputRef.current?.click()}
        >
          Choose file
        </button>

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.doc,.docx,.txt"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
          }}
        />
      </div>
    </div>
  );
}
