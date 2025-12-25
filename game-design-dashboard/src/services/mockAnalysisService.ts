import type { AnalysisResult, UploadMeta } from "../types/models";

let DB: AnalysisResult[] = [
  {
    submissionId: "sub_001",
    meta: {
      studentId: "660000001",
      studentName: "Student A",
      courseCode: "GDES301",
      assignmentId: "A1",
    },
    uxScenarioText:
      "When players run out of energy, the UI shows a confirmshaming message that pushes them to buy gems.",
    tags: ["Energy System", "Time Pressure"],
    targetAudience: "Casual Players",
    ethicalRadar: {
      payToProgress: 80,
      gacha: 40,
      socialPressure: 55,
      adPressure: 15,
      scarcity: 60,
    },
    summaryNote:
      "High pay-to-progress pressure. Consider fair alternatives and neutral messaging.",
    findings: [
      {
        id: "f1",
        severity: "high",
        title: "Confirmshaming copy",
        description: "ข้อความทำให้ผู้เล่นรู้สึกผิด/ถูกกดดันให้จ่าย",
        suggestion: "เปลี่ยนเป็นข้อความกลาง เช่น 'พลังงานหมดแล้ว พักสักครู่หรือใช้ไอเท็มเพื่อเล่นต่อ'",
      },
    ],
    createdAt: new Date().toISOString(),
  },
];

export async function mockListResults(): Promise<AnalysisResult[]> {
  return DB;
}

export async function mockGetResult(id: string): Promise<AnalysisResult> {
  const found = DB.find((x) => x.submissionId === id);
  if (!found) throw new Error("Not found");
  return found;
}

export async function mockUploadAndAnalyze(
  _file: File,
  meta: UploadMeta
): Promise<AnalysisResult> {
  const created: AnalysisResult = {
    submissionId: `sub_${Math.random().toString(16).slice(2)}`,
    meta,
    uxScenarioText: "Mock scenario from uploaded assignment (debug mode).",
    tags: ["Mock"],
    targetAudience: "All",
    ethicalRadar: {
      payToProgress: 50,
      gacha: 50,
      socialPressure: 50,
      adPressure: 50,
      scarcity: 50,
    },
    summaryNote: "Mock analysis result (AI will be integrated later).",
    findings: [
      {
        id: "f_mock",
        severity: "medium",
        title: "Placeholder finding",
        description: "นี่คือผลวิเคราะห์ปลอมเพื่อทดสอบ UI",
        suggestion: "เมื่อเชื่อม AI จริง ให้แทนที่ด้วยผลวิเคราะห์จริง",
      },
    ],
    createdAt: new Date().toISOString(),
  };

  DB = [created, ...DB];
  return created;
}
