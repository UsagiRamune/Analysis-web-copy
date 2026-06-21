import { useState, useRef, useEffect } from 'react'
import { useChat } from '../../context/ChatContext'
import { sendChatMessage, summarizeChat } from '../../services/chat.service'
 
interface ChatAssistantProps {
  projectId: string
}
 
export default function ChatAssistant({ projectId }: ChatAssistantProps) {
  const {
    messages,
    addMessage,
    liveDraft,
    addSuggestions,
    isChatOpen,
    setChatOpen,
  } = useChat()
 
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
 
  // auto-scroll ลงล่างสุดเมื่อมีข้อความใหม่
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isSending])
 
  // ── ส่งข้อความ ──
  async function handleSend() {
    const text = input.trim()
    if (!text || isSending) return
 
    setError(null)
    setInput('')
    addMessage({ role: 'user', text })
    setIsSending(true)
 
    try {
      const { reply } = await sendChatMessage({
        projectId,
        message: text,
        history: messages,        // ส่งประวัติก่อนหน้า (ยังไม่รวมข้อความล่าสุด — backend ต่อให้)
        liveDraft,                // ถ้าอยู่ Setup จะมีค่า, หน้าอื่น = null → ดึง DB
      })
      addMessage({ role: 'model', text: reply })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      setError(msg)
    } finally {
      setIsSending(false)
    }
  }
 
  // ── สรุปคำแนะนำ → ส่งเข้า panel ──
  async function handleSummarize() {
    if (isSummarizing || messages.length === 0) return
 
    setError(null)
    setIsSummarizing(true)
    try {
      const { suggestions } = await summarizeChat({ history: messages })
      addSuggestions(suggestions)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'สรุปไม่ได้'
      setError(msg)
    } finally {
      setIsSummarizing(false)
    }
  }
 
  // กด Enter ส่ง (Shift+Enter ขึ้นบรรทัดใหม่)
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }
 
  // ── ตอนปิด: ปุ่มกลมลอย ──
  if (!isChatOpen) {
    return (
      <button
        onClick={() => setChatOpen(true)}
        style={styles.fab}
        aria-label="เปิดผู้ช่วย AI"
      >
        💬
      </button>
    )
  }
 
  // ── ตอนเปิด: กล่องแชต ──
  return (
    <div style={styles.panel}>
      {/* header */}
      <div style={styles.header}>
        <span style={styles.headerTitle}>ผู้ช่วยออกแบบเกม</span>
        <button onClick={() => setChatOpen(false)} style={styles.closeBtn} aria-label="ปิด">
          ✕
        </button>
      </div>
 
      {/* พื้นที่ข้อความ */}
      <div ref={scrollRef} style={styles.messages}>
        {messages.length === 0 && (
          <div style={styles.empty}>
            สวัสดี! ถามอะไรเกี่ยวกับการออกแบบเกมหรือ monetization ได้เลย
            เราจะช่วยแนะนำ ไม่ทำแทนนะ
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              ...styles.bubble,
              ...(m.role === 'user' ? styles.bubbleUser : styles.bubbleAi),
            }}
          >
            {m.text}
          </div>
        ))}
        {isSending && <div style={{ ...styles.bubble, ...styles.bubbleAi }}>กำลังคิด…</div>}
      </div>
 
      {/* error */}
      {error && <div style={styles.error}>{error}</div>}
 
      {/* ปุ่มสรุปคำแนะนำ */}
      <button
        onClick={handleSummarize}
        disabled={isSummarizing || messages.length === 0}
        style={{
          ...styles.summarizeBtn,
          ...(isSummarizing || messages.length === 0 ? styles.btnDisabled : {}),
        }}
      >
        {isSummarizing ? 'กำลังสรุป…' : '📌 สรุปเป็นคำแนะนำ'}
      </button>
 
      {/* ช่องพิมพ์ */}
      <div style={styles.inputRow}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="พิมพ์คำถาม…"
          rows={1}
          style={styles.textarea}
        />
        <button
          onClick={handleSend}
          disabled={isSending || !input.trim()}
          style={{
            ...styles.sendBtn,
            ...(isSending || !input.trim() ? styles.btnDisabled : {}),
          }}
        >
          ส่ง
        </button>
      </div>
    </div>
  )
}
 
// ── สไตล์ (inline เพื่อไม่ผูกกับ Tailwind config — ปรับ theme ได้ทีหลัง) ──
const styles: Record<string, React.CSSProperties> = {
  fab: {
    position: 'fixed',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: '50%',
    border: 'none',
    background: '#c2410c',
    color: '#fff',
    fontSize: 24,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    zIndex: 1000,
  },
  panel: {
    position: 'fixed',
    bottom: 24,
    right: 24,
    width: 360,
    maxWidth: 'calc(100vw - 48px)',
    height: 520,
    maxHeight: 'calc(100vh - 48px)',
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 1000,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    background: '#c2410c',
    color: '#fff',
  },
  headerTitle: { fontWeight: 600, fontSize: 15 },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#fff',
    fontSize: 16,
    cursor: 'pointer',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  empty: { color: '#9ca3af', fontSize: 13, textAlign: 'center', marginTop: 24, lineHeight: 1.6 },
  bubble: {
    maxWidth: '80%',
    padding: '8px 12px',
    borderRadius: 12,
    fontSize: 14,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  bubbleUser: { alignSelf: 'flex-end', background: '#c2410c', color: '#fff', borderBottomRightRadius: 4 },
  bubbleAi: { alignSelf: 'flex-start', background: '#f3f4f6', color: '#111827', borderBottomLeftRadius: 4 },
  error: { color: '#dc2626', fontSize: 12, padding: '0 16px 8px' },
  summarizeBtn: {
    margin: '0 16px 8px',
    padding: '8px 12px',
    background: '#fff7ed',
    color: '#c2410c',
    border: '1px solid #fed7aa',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
  inputRow: {
    display: 'flex',
    gap: 8,
    padding: 12,
    borderTop: '1px solid #e5e7eb',
    alignItems: 'flex-end',
  },
  textarea: {
    flex: 1,
    resize: 'none',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 14,
    fontFamily: 'inherit',
    maxHeight: 80,
    outline: 'none',
  },
  sendBtn: {
    padding: '8px 16px',
    background: '#c2410c',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
  },
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
}