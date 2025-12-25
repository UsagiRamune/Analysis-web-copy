export type UploadMeta = {
  studentId: string;
  studentName: string;
  courseCode: string;
  assignmentId: string;
};

export type EthicalAxis =
  | "payToProgress"
  | "gacha"
  | "socialPressure"
  | "adPressure"
  | "scarcity";

export type EthicalRadar = Record<EthicalAxis, number>; // 0..100

export type Finding = {
  id: string;
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
  suggestion?: string;
};

export type AnalysisResult = {
  submissionId: string;
  meta: UploadMeta;

  uxScenarioText: string;
  tags: string[];
  targetAudience: string;

  ethicalRadar: EthicalRadar;
  summaryNote: string;
  findings: Finding[];

  createdAt: string; // ISO date
};
