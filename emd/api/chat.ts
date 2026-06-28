import { getProvider } from './lib/ai-provider'
 
const SYSTEM_PROMPT = `คุณคือผู้ช่วยที่ปรึกษาด้านการออกแบบเกม (Game Design Advisor)
สำหรับนักศึกษาที่กำลังเขียน Game Design Document (GDD)
 
หน้าที่ของคุณ:
- ให้คำแนะนำเชิง guide เท่านั้น ห้ามเขียน GDD แทนนักศึกษาทั้งหมด
- ชวนให้นักศึกษาคิดต่อด้วยคำถาม ไม่ใช่ป้อนคำตอบสำเร็จรูป
- ชี้จุดที่ควรปรับปรุงและจุดที่ทำได้ดีแล้ว โดยอ้างอิงจากข้อมูลเกมที่ให้มา
- เวลาพูดเรื่อง revenue mix (สัดส่วน Ads/IAP) ให้ตอบแบบฟันธงสั้น ๆ ว่าควรเน้นด้านไหนมากกว่า
  พร้อมเหตุผลอ้างอิงจาก genre/core loop/target audience ที่ให้มา ไม่ต้องอธิบายยืดยาว
 
ขอบเขต: ตอบเฉพาะเรื่อง game design, monetization, ethics ของเกมเท่านั้น
ถ้าผู้ใช้ถามนอกเรื่อง ให้ดึงกลับมาเรื่องการออกแบบเกมอย่างสุภาพ
 
รูปแบบการตอบ: กระชับ เป็นกันเอง ใช้ bullet เมื่อจำเป็น ตอบเป็นภาษาไทย
ความยาว: ตอบให้จบใน 3-5 ประโยคหรือ 3-4 bullet ห้ามยาวเกินไป เน้นประเด็นสำคัญ`
 
// prompt สำหรับโหมดสรุป — แปลงบทสนทนา (โทนแชต) เป็นคำแนะนำทางการ กระชับ
// ใช้ตอน user กดปุ่ม "สรุปเป็นคำแนะนำ" → ผลไปโผล่ใน SuggestionPanel
const SUMMARIZE_PROMPT = `คุณคือผู้ช่วยสรุปคำแนะนำด้านการออกแบบเกม
หน้าที่: อ่านบทสนทนาระหว่างนักศึกษากับที่ปรึกษา แล้วสกัดเฉพาะ "คำแนะนำที่ปฏิบัติได้จริง" ออกมา
พร้อมระบุว่าคำแนะนำแต่ละข้อเกี่ยวกับหัวข้อใดของ GDD
 
หมวด (category) ที่เลือกได้ มีดังนี้เท่านั้น:
- "title" = ชื่อเกม
- "genre" = แนวเกม
- "platform" = แพลตฟอร์ม
- "target_audience" = กลุ่มเป้าหมาย
- "core_mechanic" = core loop / กลไกหลัก
- "session_length" = ความยาว session
- "revenue_mix" = สัดส่วนรายได้ระหว่าง Ads กับ IAP ว่าควรเน้นด้านไหนมากกว่าและทำไม
- "monetization_design" = การออกแบบ ads placement หรือ IAP item โดยรวม (ไม่ใช่เรื่องสัดส่วน)
 
กติกาเฉพาะหมวด "revenue_mix": เขียนให้สั้นและฟันธง ตามรูปแบบ
"Ads ควรมากกว่า/น้อยกว่า IAP เพราะ <เหตุผลอ้างอิง core loop หรือ genre หรือ target audience>"
ไม่ต้องอธิบายยืดยาว ประโยคเดียวพอ
 
กติกาทั่วไป:
- ตอบเป็น JSON array เท่านั้น ห้ามมีข้อความอื่นนอก array ห้ามมี markdown code fence
- แต่ละ element มีรูปแบบ: {"category": "<หมวด>", "advice": "<คำแนะนำกระชับ 1 ประโยค ภาษาทางการ ภาษาไทย>"}
- เลือก category ที่ตรงที่สุดกับคำแนะนำข้อนั้น
- เอาเฉพาะคำแนะนำที่ปฏิบัติได้จริง ไม่เกิน 5 ข้อ
- ห้ามแต่งเติมคำแนะนำที่ไม่มีในบทสนทนา
- **ถ้าบทสนทนายังไม่มีคำแนะนำที่เป็นรูปธรรม ให้ตอบ array ว่าง [] เท่านั้น**
 
ตัวอย่างผลลัพธ์:
[{"category":"revenue_mix","advice":"Ads ควรมากกว่า IAP เพราะเกมแนว casual ที่ session สั้น ผู้เล่นมักไม่อยากจ่ายเงินก้อนใหญ่"},{"category":"core_mechanic","advice":"ควรอธิบาย core loop เป็นลำดับขั้นให้ชัดเจน"}]`
 
// แปลง step number เป็นชื่อ เพื่อบอก AI ว่า user อยู่ตรงไหน
const STEP_NAMES: Record<number, string> = {
  1: 'Setup (กำหนดข้อมูลเกมพื้นฐาน)',
  2: 'Build (ออกแบบ monetization)',
  3: 'Guardrail (ตรวจจริยธรรม)',
  4: 'Output (สรุปผล)',
}
 
// ประกอบ GDD context เป็นข้อความ — รวม ads/iap ถ้ามี
function buildContextText(p: any): string {
  let text = `ข้อมูลโปรเจกต์เกมปัจจุบัน:
- ชื่อเกม: ${p?.title || 'ยังไม่ระบุ'}
- แนวเกม: ${(p?.genre || []).join(', ') || 'ยังไม่ระบุ'}
- แพลตฟอร์ม: ${(p?.platform || []).join(', ') || 'ยังไม่ระบุ'}
- กลุ่มเป้าหมาย: ${p?.target_audience || 'ยังไม่ระบุ'}
- core loop: ${p?.core_mechanic || 'ยังไม่ระบุ'}
- ความยาว session: ${p?.session_length || 'ยังไม่ระบุ'}
- ขั้นตอนที่ทำอยู่: ${STEP_NAMES[p?.current_step] || 'ไม่ทราบ'}`
 
  // เพิ่มข้อมูล ads ถ้ามี (user ทำถึง Build แล้ว)
  if (p?.ads) {
    text += `\n\nการออกแบบโฆษณา (Ads):
- เครือข่ายโฆษณา: ${p.ads.ad_network || 'ยังไม่ระบุ'}
- โมเดลรายได้: ${p.ads.revenue_model || 'ยังไม่ระบุ'}`
    if (p.ads.placements?.length) {
      text += `\n- ตำแหน่งโฆษณาที่วางไว้:`
      for (const ad of p.ads.placements) {
        const cap = ad.frequency_cap != null ? `จำกัด ${ad.frequency_cap} ครั้ง` : 'ไม่จำกัดความถี่'
        text += `\n  • ${ad.placement_type} ที่ "${ad.trigger_point || 'ไม่ระบุจุด'}" (${cap})`
      }
    } else {
      text += `\n- ยังไม่ได้วางตำแหน่งโฆษณา`
    }
  }
 
  // เพิ่มข้อมูล iap ถ้ามี
  if (p?.iap) {
    text += `\n\nการออกแบบ In-App Purchase (IAP):
- ร้านค้า: ${p.iap.store || 'ยังไม่ระบุ'}`
    if (p.iap.items?.length) {
      text += `\n- ไอเทมที่ขาย:`
      for (const item of p.iap.items) {
        const price = item.price_usd != null ? `$${item.price_usd}` : 'ฟรี/ไม่ระบุ'
        text += `\n  • ${item.name} (${item.item_type}, ${price}) — ${item.description || 'ไม่มีคำอธิบาย'}`
      }
    } else {
      text += `\n- ยังไม่ได้เพิ่มไอเทม`
    }
  }
 
  // เพิ่ม revenue mix target ถ้ามี (จาก slider ใน BuildPage)
  if (p?.revenueMixTarget != null) {
    text += `\n\nสัดส่วนรายได้ที่ตั้งใจไว้: Ads ${p.revenueMixTarget}% / IAP ${100 - p.revenueMixTarget}%`
  }
 
  return text
}
 
// ── parse JSON จาก AI ให้เป็น array ที่ปลอดภัย ──
// กัน AI ตอบมาพร้อม markdown fence, ข้อความเกิน, หรือ JSON พัง
const VALID_CATEGORIES = [
  'title', 'genre', 'platform', 'target_audience', 'core_mechanic',
  'session_length', 'revenue_mix', 'monetization_design',
]
 
function parseSuggestions(raw: string): Array<{ category: string; advice: string }> {
  if (!raw) return []
  let text = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1 || end < start) return []
  text = text.slice(start, end + 1)
 
  try {
    const arr = JSON.parse(text)
    if (!Array.isArray(arr)) return []
    return arr
      .filter(
        (x) =>
          x &&
          typeof x.category === 'string' &&
          typeof x.advice === 'string' &&
          VALID_CATEGORIES.includes(x.category) &&
          x.advice.trim().length > 0,
      )
      .slice(0, 5)
      .map((x) => ({ category: x.category, advice: x.advice.trim() }))
  } catch {
    return []
  }
}
 
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
 
  try {
    const { project, history = [], message, mode, provider: providerOverride } = req.body
    if (!message) {
      return res.status(400).json({ error: 'message is required' })
    }
 
    const provider = await getProvider(providerOverride)
    const trimmedHistory = history.slice(-8)
 
    // ── โหมดสรุป: สกัดคำแนะนำเป็น JSON array (category + advice) ──
    if (mode === 'summarize') {
      const summarizeContents = [
        ...trimmedHistory,
        { role: 'user', parts: [{ text: message }] },
      ]
      let result = await provider.generate({
        contents: summarizeContents,
        systemInstruction: SUMMARIZE_PROMPT,
        temperature: 0.3,
        maxOutputTokens: 1000,
      })
 
      let suggestions = parseSuggestions(result.text)
 
      // เคส "parse ไม่ออกทั้งที่ AI ไม่ได้ตอบ [] จริง" = format เพี้ยน (เจอบ่อยกับโมเดล
      // ที่ไม่แข็งภาษาไทย เช่น Owl Alpha) — ลองสรุปใหม่อีก 1 ครั้ง แทนที่จะปล่อยว่างเงียบ ๆ
      const looksEmpty = result.text.trim() === '[]' || result.text.trim() === ''
      if (suggestions.length === 0 && !looksEmpty) {
        console.warn(`[chat] summarize parse ล้มเหลวจาก ${result.providerName} — retry 1 ครั้ง. raw: ${result.text.slice(0, 200)}`)
        result = await provider.generate({
          contents: summarizeContents,
          systemInstruction: SUMMARIZE_PROMPT + '\n\nย้ำ: ตอบเป็น JSON array เท่านั้น ห้ามมีคำอธิบายอื่นปนมา',
          temperature: 0.2,
          maxOutputTokens: 1000,
        })
        suggestions = parseSuggestions(result.text)
      }
 
      return res.status(200).json({
        suggestions,
        usage: result.usage,
        provider: result.providerName,
      })
    }
 
    // ── โหมดแชตปกติ: แนบ GDD context + system prompt ที่ปรึกษา ──
    const contents = [
      { role: 'user', parts: [{ text: buildContextText(project) }] },
      { role: 'model', parts: [{ text: 'รับทราบข้อมูลโปรเจกต์แล้ว พร้อมช่วยให้คำแนะนำครับ' }] },
      ...trimmedHistory,
      { role: 'user', parts: [{ text: message }] },
    ]
 
    const result = await provider.generate({
      contents,
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.7,
      maxOutputTokens: 1500,
    })
 
    return res.status(200).json({
      reply: result.text,
      usage: result.usage,
      provider: result.providerName,
    })
  } catch (err: any) {
    console.error('[chat] error:', err?.message)
    const msg = String(err?.message)
    const is429 = err?.status === 429 || /429/.test(msg) || /RESOURCE_EXHAUSTED/.test(msg)
    const is503 = err?.status === 503 || /503/.test(msg)
 
    if (is429) {
      return res.status(429).json({
        error: 'โควต้า AI ของวันนี้หมดแล้ว (free tier มีจำกัดจำนวนครั้ง/วัน) ลองใหม่พรุ่งนี้ หรือสลับ provider ใน .env',
      })
    }
    if (is503) {
      return res.status(503).json({ error: 'AI กำลังมีคนใช้เยอะ ลองใหม่อีกครั้งในสักครู่' })
    }
    return res.status(500).json({ error: 'AI ตอบไม่ได้ตอนนี้ ลองใหม่อีกครั้ง' })
  }
}