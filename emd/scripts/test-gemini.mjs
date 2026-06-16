import { GoogleGenAI } from '@google/genai'

const KEY = process.env.GEMINI_API_KEY
if (!KEY) {
  console.error('❌ ไม่เจอ GEMINI_API_KEY — เช็คว่ามี .env และรันด้วย --env-file=.env')
  process.exit(1)
}

const ai = new GoogleGenAI({ apiKey: KEY })
const MODEL = process.env.MODEL || 'gemini-2.5-flash'

const SYSTEM_PROMPT = `คุณคือผู้ช่วยที่ปรึกษาด้านการออกแบบเกมสำหรับนักศึกษาที่เขียน GDD
ให้คำแนะนำเชิง guide เท่านั้น ห้ามทำแทน ชวนคิดต่อด้วยคำถาม
ตอบเฉพาะเรื่อง game design, monetization, ethics ของเกม ถ้าถามนอกเรื่องให้ดึงกลับมา
ตอบกระชับ เป็นภาษาไทย`

// sleep helper 
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ยิงไป Gemini พร้อม retry: ถ้าเจอ 503 (server แน่น) ลองใหม่สูงสุด 4 ครั้ง
// เว้นระยะแบบ exponential backoff: 1s, 2s, 4s, 8s
async function askWithRetry(message, maxRetries = 4) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const t0 = Date.now()
      const res = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: [{ text: message }] }],
        config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.7, maxOutputTokens: 800 },
      })
      const ms = Date.now() - t0
      console.log(`\n📨 ถาม: ${message}`)
      console.log(`🤖 [${MODEL}] ตอบ (${ms}ms):`)
      console.log(res.text)
      if (res.usageMetadata) {
        const u = res.usageMetadata
        console.log(`📊 token — input: ${u.promptTokenCount}, output: ${u.candidatesTokenCount}, total: ${u.totalTokenCount}`)
      }
      return  // สำเร็จ ออกเลย
    } catch (err) {
      const is503 = err?.status === 503
      if (is503 && attempt < maxRetries) {
        const wait = 1000 * Math.pow(2, attempt)  // 1s, 2s, 4s, 8s
        console.log(`⏳ server แน่น (503) — ลองใหม่ในอีก ${wait / 1000}s (ครั้งที่ ${attempt + 1}/${maxRetries})`)
        await sleep(wait)
      } else {
        console.error(`❌ ยิงไม่สำเร็จ: ${err?.message || err}`)
        return
      }
    }
  }
}

await askWithRetry('เกม puzzle ของผมควรใส่ rewarded ad ตรงไหนดีครับ')
await askWithRetry('ช่วยเขียนโค้ด python คำนวณภาษีให้หน่อย')

console.log('\n✓ เทสเสร็จ')