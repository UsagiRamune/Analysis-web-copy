import { FLAGS } from "../lib/env";
import type { AnalysisResult, UploadMeta } from "../types/models";
import {
  mockListResults,
  mockGetResult,
  mockUploadAndAnalyze,
} from "./mockAnalysisService";
import { apiListResults, apiGetResult, apiUploadAndAnalyze } from "./apiClient";

export function listResults(): Promise<AnalysisResult[]> {
  return FLAGS.USE_MOCK ? mockListResults() : apiListResults();
}

export function getResult(id: string): Promise<AnalysisResult> {
  return FLAGS.USE_MOCK ? mockGetResult(id) : apiGetResult(id);
}

export function uploadAndAnalyze(file: File, meta: UploadMeta): Promise<AnalysisResult> {
  return FLAGS.USE_MOCK ? mockUploadAndAnalyze(file, meta) : apiUploadAndAnalyze(file, meta);
}
