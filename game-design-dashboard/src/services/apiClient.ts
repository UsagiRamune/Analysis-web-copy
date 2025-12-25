import { FLAGS } from "../lib/env";
import type { AnalysisResult, UploadMeta } from "../types/models";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export async function apiListResults(): Promise<AnalysisResult[]> {
  return request(`${FLAGS.API_BASE_URL}/api/submissions`);
}

export async function apiGetResult(id: string): Promise<AnalysisResult> {
  return request(`${FLAGS.API_BASE_URL}/api/submissions/${id}`);
}

export async function apiUploadAndAnalyze(
  file: File,
  meta: UploadMeta
): Promise<AnalysisResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("meta", new Blob([JSON.stringify(meta)], { type: "application/json" }));

  return request(`${FLAGS.API_BASE_URL}/api/submissions`, {
    method: "POST",
    body: form,
  });
}
