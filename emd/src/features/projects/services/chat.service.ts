import {
  getProject,
  getAdsConfig,
  listAdPlacements,
  getIapConfig,
  listIapItems,
} from './projects.service'
 
// รูปแบบ 1 ข้อความใน chat (ฝั่ง frontend)
export interface ChatMessage {
  role: 'user' | 'model'
  text: string
}
 
// โครงสร้าง GDD context ที่จะส่งให้ backend
// backend (api/chat.ts) จะเอาไปประกอบเป็นข้อความให้ Gemini
export interface GddContext {
  title: string
  genre: string[]
  platform: string[]
  target_audience: string | null
  core_mechanic: string | null
  session_length: string | null
  current_step: number
  // ส่วน monetization — จะมีค่าก็ต่อเมื่อ user ทำถึง Build (step >= 2)
  ads?: {
    ad_network: string | null
    revenue_model: string | null
    placements: Array<{
      placement_type: string
      trigger_point: string | null
      frequency_cap: number | null
    }>
  }
  iap?: {
    store: string | null
    items: Array<{
      name: string
      item_type: string
      price_usd: number | null
      description: string | null
    }>
  }
}
 
// ── รวบรวม context จาก Supabase สดๆ ตาม step ที่ user ทำถึง ──
// step 1 (Setup): ส่งแค่ข้อมูลพื้นฐาน
// step >= 2 (Build เป็นต้นไป): เพิ่ม ads/iap ที่ user สร้างไว้
export async function buildGddContext(projectId: string): Promise<GddContext> {
  const project = await getProject(projectId)
 
  const context: GddContext = {
    title: project.title,
    genre: project.genre ?? [],
    platform: project.platform ?? [],
    target_audience: project.target_audience,
    core_mechanic: project.core_mechanic,
    session_length: project.session_length,
    current_step: project.current_step,
  }
 
  // ดึง monetization เฉพาะเมื่อ user ทำถึง Build แล้ว (มีข้อมูลให้ดึง)
  if (project.current_step >= 2) {
    // ดึง ads + iap พร้อมกันแบบ parallel เพื่อความเร็ว
    const [adsConfig, iapConfig] = await Promise.all([
      getAdsConfig(projectId),
      getIapConfig(projectId),
    ])
 
    if (adsConfig) {
      const placements = await listAdPlacements(adsConfig.id)
      context.ads = {
        ad_network: adsConfig.ad_network,
        revenue_model: adsConfig.revenue_model,
        placements: placements.map((p) => ({
          placement_type: p.placement_type,
          trigger_point: p.trigger_point,
          frequency_cap: p.frequency_cap,
        })),
      }
    }
 
    if (iapConfig) {
      const items = await listIapItems(iapConfig.id)
      context.iap = {
        store: iapConfig.store,
        items: items.map((i) => ({
          name: i.name,
          item_type: i.item_type,
          price_usd: i.price_usd,
          description: i.description,
        })),
      }
    }
  }
 
  return context
}
 
// ── แปลง liveDraft (Partial) จากหน้า Setup ให้เป็น GddContext เต็ม ──
// เติม default ให้ field ที่ user ยังไม่กรอก กัน backend เจอ undefined
// หน้า Setup ยังไม่มี ads/iap จึงไม่ต้องเติมสองตัวนี้ (ปล่อย undefined)
function normalizeDraft(draft: Partial<GddContext>): GddContext {
  return {
    title: draft.title ?? '',
    genre: draft.genre ?? [],
    platform: draft.platform ?? [],
    target_audience: draft.target_audience ?? null,
    core_mechanic: draft.core_mechanic ?? null,
    session_length: draft.session_length ?? null,
    current_step: draft.current_step ?? 1,
  }
}
 
// ── ส่งข้อความไป backend แล้วรับคำตอบ AI ──
// history = บทสนทนาก่อนหน้า (backend จะตัดเหลือ 8 ข้อความล่าสุดเอง)
// liveDraft = ข้อมูล Setup สดจากฟอร์ม (optional):
//   - ถ้ามี (อยู่หน้า Setup) → ใช้เลย ไม่แตะ DB
//   - ถ้าไม่มี (อยู่หน้า Build+) → ดึงจาก DB ตามปกติ
export async function sendChatMessage(params: {
  projectId: string
  message: string
  history: ChatMessage[]
  liveDraft?: Partial<GddContext> | null
}): Promise<{ reply: string; usage: unknown }> {
  // 1. หา context: มี liveDraft ใช้เลย, ไม่มีดึงจาก DB
  const context: GddContext = params.liveDraft
    ? normalizeDraft(params.liveDraft)
    : await buildGddContext(params.projectId)
 
  // 2. แปลง history เป็นรูปแบบที่ Gemini ต้องการ (role + parts)
  const geminiHistory = params.history.map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }))
 
  // 3. ยิงไป /api/chat (Vercel function ที่เก็บ key)
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project: context,
      history: geminiHistory,
      message: params.message,
    }),
  })
 
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'เกิดข้อผิดพลาด' }))
    throw new Error(err.error ?? 'AI ตอบไม่ได้ตอนนี้')
  }
 
  const data = await res.json()
  return { reply: data.reply, usage: data.usage }
}
 
// ── สรุปบทสนทนาเป็น "คำแนะนำมีหมวด" สำหรับ SuggestionPanel ──
// user กดปุ่ม "สรุปคำแนะนำ" → ยิง API พร้อม flag summarize
// backend คืน array ของ {category, advice} (category = หัวข้อ GDD ที่เกี่ยวข้อง)
// ถ้าบทสนทนายังไม่มีอะไรสรุป → คืน array ว่าง (panel จะเงียบ)
export interface RawSuggestion {
  category: string
  advice: string
}
 
export async function summarizeChat(params: {
  history: ChatMessage[]
}): Promise<{ suggestions: RawSuggestion[] }> {
  const geminiHistory = params.history.map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }))
 
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'summarize',
      history: geminiHistory,
      message: 'สรุปคำแนะนำจากบทสนทนาข้างต้นเป็น JSON array ตามรูปแบบที่กำหนด',
    }),
  })
 
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'เกิดข้อผิดพลาด' }))
    throw new Error(err.error ?? 'สรุปคำแนะนำไม่ได้ตอนนี้')
  }
 
  const data = await res.json()
  return { suggestions: Array.isArray(data.suggestions) ? data.suggestions : [] }
}