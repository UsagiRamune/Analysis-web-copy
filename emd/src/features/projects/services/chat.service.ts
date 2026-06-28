import {
  getProject,
  getAdsConfig,
  listAdPlacements,
  getIapConfig,
  listIapItems,
} from './projects.service'
import { supabase } from '../../../lib/supabase'
 
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
  providerOverride?: string | null   // ใช้ตอนปุ่มสลับฝั่ง dev เลือก provider เอง
}): Promise<{ reply: string; usage: unknown; provider: string }> {
  // 1. หา context: มี liveDraft ใช้เลย, ไม่มีดึงจาก DB
  const context: GddContext = params.liveDraft
    ? normalizeDraft(params.liveDraft)
    : await buildGddContext(params.projectId)
 
  // 2. แปลง history เป็นรูปแบบกลาง (role + parts) — backend แปลงต่อตาม provider ที่ใช้จริง
  const providerHistory = params.history.map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }))
 
  // 3. ยิงไป /api/chat (Vercel function ที่เก็บ key)
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project: context,
      history: providerHistory,
      message: params.message,
      ...(params.providerOverride ? { provider: params.providerOverride } : {}),
    }),
  })
 
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'เกิดข้อผิดพลาด' }))
    throw new Error(err.error ?? 'AI ตอบไม่ได้ตอนนี้')
  }
 
  const data = await res.json()
  return {
    reply: data.reply,
    usage: data.usage,
    provider: typeof data.provider === 'string' ? data.provider : 'unknown',
  }
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
  providerOverride?: string | null   // ใช้ตอนปุ่มสลับฝั่ง dev เลือก provider เอง
}): Promise<{ suggestions: RawSuggestion[]; provider: string }> {
  const providerHistory = params.history.map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }))
 
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'summarize',
      history: providerHistory,
      message: 'สรุปคำแนะนำจากบทสนทนาข้างต้นเป็น JSON array ตามรูปแบบที่กำหนด',
      ...(params.providerOverride ? { provider: params.providerOverride } : {}),
    }),
  })
 
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'เกิดข้อผิดพลาด' }))
    throw new Error(err.error ?? 'สรุปคำแนะนำไม่ได้ตอนนี้')
  }
 
  const data = await res.json()
  return {
    suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
    provider: typeof data.provider === 'string' ? data.provider : 'unknown',
  }
}
 
// ── บันทึก suggestion ที่สรุปแล้วลง Supabase (ตาราง ai_suggestions) ──
// เรียกตอน user กดปุ่ม "สรุปเป็นคำแนะนำ" และ AI คืนผลมาแล้ว
// model = ระบุว่ามาจาก provider ไหน (เผื่อเทียบ Gemini vs Owl Alpha)
export async function saveSuggestions(params: {
  projectId: string
  suggestions: RawSuggestion[]
  model?: string
}): Promise<void> {
  if (params.suggestions.length === 0) return // ไม่มีอะไรให้บันทึก
 
  const rows = params.suggestions.map((s) => ({
    project_id: params.projectId,
    category: s.category,
    advice: s.advice,
    model_used: params.model ?? null,
  }))
 
  // หมายเหตุ: cast เป็น any เฉพาะจุดนี้ เพราะ supabase client ไม่มี type ของตาราง
  // ai_suggestions ผูกไว้ (database.types.ts generate ก่อนตารางนี้ถูกสร้าง)
  // ถ้า regenerate types จาก Supabase แล้ว ลบ "as any" นี้ออกได้เลย — type จะตรวจสอบเองถูกต้อง
  const { error } = await supabase.from('ai_suggestions').insert(rows as any)
  if (error) {
    throw new Error(`บันทึกคำแนะนำไม่สำเร็จ: ${error.message}`)
  }
}
 
// ── โหลด suggestion ทั้งหมดของ project (ตอนเปิดหน้า — persistent) ──
// เรียงใหม่สุดก่อน (created_at desc)
export async function loadSuggestions(
  projectId: string,
): Promise<RawSuggestion[]> {
  const { data, error } = await supabase
    .from('ai_suggestions')
    .select('category, advice')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
 
  if (error) {
    throw new Error(`โหลดคำแนะนำไม่สำเร็จ: ${error.message}`)
  }
  return data ?? []
}