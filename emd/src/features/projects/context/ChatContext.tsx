import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import type { ChatMessage, GddContext } from '../services/chat.service'
 
// ── รูปแบบคำแนะนำที่สรุปแล้ว (โผล่ใน SuggestionPanel) ──
export interface Suggestion {
  id: string
  category: string       // หัวข้อ GDD ที่เกี่ยวข้อง (title/genre/platform/...)
  advice: string         // เนื้อหาคำแนะนำ (ภาษาทางการ สรุปแล้ว)
  createdAt: number      // เวลาที่สร้าง (ใช้ trigger notification + เรียงลำดับ)
}
 
// ── liveDraft = snapshot ของฟอร์ม Setup ที่ user กำลังกรอก ──
// ใช้ Partial เพราะระหว่างกรอก ข้อมูลยังไม่ครบทุก field
export type LiveDraft = Partial<GddContext>
 
interface ChatContextValue {
  // -- แชต --
  messages: ChatMessage[]
  addMessage: (msg: ChatMessage) => void
  clearMessages: () => void
 
  // -- live draft จาก Setup --
  liveDraft: LiveDraft | null
  setLiveDraft: (draft: LiveDraft | null) => void
 
  // -- คำแนะนำสรุป (panel) --
  suggestions: Suggestion[]
  addSuggestions: (items: Array<{ category: string; advice: string }>) => void
  // โหลดของเก่าจาก DB มาแทนทั้งหมด — ไม่ trigger notification (ไม่ใช่ของใหม่)
  setSuggestionsFromDb: (items: Array<{ category: string; advice: string }>) => void
  clearSuggestions: () => void
 
  // -- สถานะ UI --
  isChatOpen: boolean
  setChatOpen: (open: boolean) => void
}
 
const ChatContext = createContext<ChatContextValue | null>(null)
 
export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [liveDraft, setLiveDraftState] = useState<LiveDraft | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isChatOpen, setChatOpen] = useState<boolean>(false)
 
  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg])
  }, [])
 
  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])
 
  // setLiveDraft หุ้มด้วย useCallback กัน re-render ลูกไม่จำเป็น
  const setLiveDraft = useCallback((draft: LiveDraft | null) => {
    setLiveDraftState(draft)
  }, [])
 
  const addSuggestions = useCallback(
    (items: Array<{ category: string; advice: string }>) => {
      if (items.length === 0) return // ไม่มีอะไรสรุป → เงียบ ไม่เพิ่ม
      setSuggestions((prev) => [
        ...prev,
        ...items.map((item, i) => ({
          id: `sg_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          category: item.category,
          advice: item.advice,
          createdAt: Date.now(),
        })),
      ])
    },
    [],
  )
 
  // โหลด suggestion เก่าจาก DB มาแทนทั้งหมด (ตอนเปิดหน้า)
  // ใช้ isFromDb=true ฝัง flag ไว้ใน id เพื่อให้ panel แยกได้ว่าไม่ใช่ของใหม่
  const setSuggestionsFromDb = useCallback(
    (items: Array<{ category: string; advice: string }>) => {
      setSuggestions(
        items.map((item, i) => ({
          id: `sg_db_${i}`,
          category: item.category,
          advice: item.advice,
          createdAt: 0, // createdAt=0 บอกว่าเป็นของเก่าจาก DB ไม่ใช่ของใหม่จากแชต
        })),
      )
    },
    [],
  )
 
  const clearSuggestions = useCallback(() => {
    setSuggestions([])
  }, [])
 
  const value: ChatContextValue = {
    messages,
    addMessage,
    clearMessages,
    liveDraft,
    setLiveDraft,
    suggestions,
    addSuggestions,
    setSuggestionsFromDb,
    clearSuggestions,
    isChatOpen,
    setChatOpen,
  }
 
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
 
// hook สำหรับเรียกใช้ — โยน error ถ้าลืมหุ้ม ChatProvider
export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext)
  if (!ctx) {
    throw new Error('useChat ต้องอยู่ภายใน <ChatProvider> เท่านั้น')
  }
  return ctx
}