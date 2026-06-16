import { GoogleGenAI} from '@google/genai'

// อ่าน key จาก environment variable (ไม่มี VITE_ prefix = ไม่หลุดไป frontend)
// ตอน local: อยู่ใน .env / ตอน production: ตั้งใน Vercel dashboard
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

// ── สลับ model ตรงนี้เพื่อเทสเทียบ Flash vs Pro ──
// เปลี่ยนค่าตัวเดียวก็เทสได้เลย ไม่ต้องแก้อย่างอื่น
const MODEL = 'gemini-2.5-flash'   
// หรือ 'gemini-2.5-pro' เพื่อเทสเทียบ

const SYSTEM_PROMPT = `คุณคือผู้ช่วยที่ปรึกษาด้านการออกแบบเกม (Game Design Advisor)
สำหรับนักศึกษาที่กำลังเขียน Game Design Document (GDD)

หน้าที่ของคุณ:
- ให้คำแนะนำเชิง guide เท่านั้น ห้ามเขียน GDD แทนนักศึกษาทั้งหมด
- ชวนให้นักศึกษาคิดต่อด้วยคำถาม ไม่ใช่ป้อนคำตอบสำเร็จรูป
- ชี้จุดที่ควรปรับปรุงและจุดที่ทำได้ดีแล้ว

ขอบเขต: ตอบเฉพาะเรื่อง game design, monetization, ethics ของเกมเท่านั้น
ถ้าผู้ใช้ถามนอกเรื่อง ให้ดึงกลับมาเรื่องการออกแบบเกมอย่างสุภาพ

รูปแบบการตอบ: กระชับ เป็นกันเอง ใช้ bullet เมื่อจำเป็น ตอบเป็นภาษาไทย`

// ประกอบข้อมูล GDD ของ project เป็นข้อความ context
function buildGddContext(project:any): string {
  return `ข้อมูลโปรเจกต์เกมปัจจุบัน:
  - ชื่อเกม: ${project?.title || 'ยังไม่ระบุ'}
  - แนวเกม: ${(project?.genre || []).join(', ') || 'ยังไม่ระบุ'}
  - แพลตฟอร์ม: ${(project?.platform || []).join(', ') || 'ยังไม่ระบุ'}
  - กลุ่มเป้าหมาย: ${project?.target_audience || 'ยังไม่ระบุ'}
  - core loop: ${project?.core_mechanic || 'ยังไม่ระบุ'}`
}

export default async function handler(req:any, res:any) {
  // รับเฉพาะ POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // frontend ส่งมา: project (ข้อมูล GDD) + history (บทสนทนาที่ผ่านมา) + message (ข้อความใหม่)
    const { project, history = [], message } = req.body

    if (!message) {
      return res.status(400).json({ error: 'message is required' })
    }

    const trimmedHistory = history.slice(-8)

    // ประกอบ contents ที่จะส่งให้ Gemini:
    // 1) GDD context (แปะเป็น turn แรก)
    // 2) history ที่ตัดแล้ว
    // 3) ข้อความใหม่ของ user
    const contents = [
      { role: 'user', parts: [{ text: buildGddContext(project) }] },
      { role: 'model', parts: [{ text: 'รับทราบข้อมูลโปรเจกต์แล้ว พร้อมช่วยให้คำแนะนำครับ' }] },
      ...trimmedHistory,
      { role: 'user', parts: [{ text: message }] },
    ]

    // เรียก API ของ Gemini
    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.7,
        maxOutputTokens: 800,
      },
    })

    return res.status(200).json({
      reply: response.text,
      usage: response.usageMetadata ?? null,
      model: MODEL,
    })
  } catch (err: any) {
    console.error('[chat] error:', err?.message)
    return res.status(500).json({ error: 'AI ตอบไม่ได้ตอนนี้ ลองใหม่อีกครั้ง' })
  }
}