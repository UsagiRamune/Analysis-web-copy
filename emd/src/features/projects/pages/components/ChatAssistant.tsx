import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useChat } from '../../context/ChatContext'
import { sendChatMessage, summarizeChat, saveSuggestions, type ChatMessage } from '../../services/chat.service'
 
// Avatar AI แบบนามธรรม (วงกลม Himawari blue + หน้ายิ้ม) — ไม่ใช่ตัวละครมีลิขสิทธิ์
// optical center ตรงกับ geometric center ของ viewBox พอดี (เช็คด้วย pixel bbox แล้ว)
function AiAvatar({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="9" fill="#5AAEDB" />
      <circle cx="12.5" cy="15" r="1.6" fill="white" />
      <circle cx="19.5" cy="15" r="1.6" fill="white" />
      <path d="M12 20 Q16 22.5 20 20" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  )
}
 
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
  // provider ที่ตอบล่าสุด — โชว์ badge ใน header ให้เห็นชัดว่ากำลังเทสตัวไหนอยู่
  const [lastProvider, setLastProvider] = useState<string | null>(null)
  // provider ที่เลือกจาก dropdown (dev only) — null = ใช้ default ตาม env (AI_PROVIDER)
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
  // toast hint — เด้งบอกแนวทางถามแล้วหายไปเอง ไม่ค้างกินที่ถาวรใน UI
  const [showHint, setShowHint] = useState(false)
  // โผล่เฉพาะตอนรัน Vite dev (localhost) — build production จะเป็น false เสมอ ปุ่มหายอัตโนมัติ
  const isDevMode = import.meta.env.DEV
 
  // ปุ่มสรุปโผล่เมื่อ AI ตอบแล้วอย่างน้อย 1 ครั้ง + มี project จริง + บทสนทนา
  // มีคะแนนความพร้อมสรุปถึง threshold (ดูเหตุผลที่ scoreForSummarize ท้ายไฟล์)
  const hasAiReplied = messages.some((m) => m.role === 'model')
  const hasProjectId = Boolean(projectId)
  const canSummarize = hasAiReplied && hasProjectId && scoreForSummarize(messages) >= SUMMARIZE_SCORE_THRESHOLD
 
  // auto-scroll ลงล่างสุดเมื่อมีข้อความใหม่
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isSending])
 
  // toast hint — เด้งบอกแนวทางถามทุกครั้งที่ AI ตอบใหม่แต่ยังสรุปไม่ได้
  // (กันค้างถาวรตามที่ user ขอ — โผล่สัก 4 วิ แล้วหายไปเอง ไม่กินที่ใน UI)
  useEffect(() => {
    if (!hasAiReplied || !hasProjectId || canSummarize || isSending) return
    setShowHint(true)
    const timer = setTimeout(() => setShowHint(false), 4000)
    return () => clearTimeout(timer)
  }, [messages, hasAiReplied, hasProjectId, canSummarize, isSending])
 
  // ── ส่งข้อความ ──
  async function handleSend() {
    const text = input.trim()
    if (!text || isSending) return
 
    setError(null)
    setInput('')
    addMessage({ role: 'user', text })
    setIsSending(true)
 
    try {
      const { reply, provider } = await sendChatMessage({
        projectId,
        message: text,
        history: messages,        // ส่งประวัติก่อนหน้า (ยังไม่รวมข้อความล่าสุด — backend ต่อให้)
        liveDraft,                // ถ้าอยู่ Setup จะมีค่า, หน้าอื่น = null → ดึง DB
        providerOverride: selectedProvider,   // dev only — null ถ้าไม่ได้เลือกจาก dropdown
      })
      addMessage({ role: 'model', text: reply })
      setLastProvider(provider)
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
    if (!projectId) {
      setError('ต้องมีโปรเจกต์จริงก่อนถึงจะบันทึกคำแนะนำได้ (กด Continue ในหน้า Setup ก่อน)')
      return
    }
 
    setError(null)
    setIsSummarizing(true)
    try {
      const { suggestions, provider } = await summarizeChat({
        history: messages,
        providerOverride: selectedProvider,
      })
      addSuggestions(suggestions)
      setLastProvider(provider)
      // บันทึกลง Supabase ให้ถาวร (ไม่บล็อก UI ถ้า save พลาด — แค่ error เงียบ ๆ ใน console)
      // model_used มาจาก backend จริง ไม่ hardcode — เปลี่ยน provider ได้โดยไม่ต้องแก้ที่นี่
      if (suggestions.length > 0) {
        try {
          await saveSuggestions({ projectId, suggestions, model: provider })
        } catch (saveErr) {
          console.error('บันทึกคำแนะนำลง DB ไม่สำเร็จ:', saveErr)
        }
      }
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
 
  // ── render ทั้ง fab และ panel ผ่าน AnimatePresence ──
  // ใช้ layoutId เดียวกันที่ avatar ทั้ง 2 จุด (fab / header) — framer-motion
  // จะ track แล้ว animate ตำแหน่ง/ขนาดให้เปลี่ยนอัตโนมัติตอนสลับ (avatar
  // "เลื่อน" จากกลางปุ่มไปอยู่มุมซ้ายบนของ header) ไม่ต้องคำนวณ x,y เอง
  return (
    <AnimatePresence mode="wait">
      {!isChatOpen ? (
        <motion.button
          key="fab"
          onClick={() => setChatOpen(true)}
          style={styles.fab}
          aria-label="เปิดผู้ช่วย AI"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.12 } }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <motion.div layoutId="ai-avatar" transition={{ duration: 0.32, ease: 'easeInOut' }}>
            <AiAvatar size={34} />
          </motion.div>
        </motion.button>
      ) : (
        <motion.div
          key="panel"
          style={{ ...styles.panel, transformOrigin: 'bottom right' }}
          initial={{ opacity: 0, scaleY: 0.3, scaleX: 0.85 }}
          animate={{ opacity: 1, scaleY: 1, scaleX: 1 }}
          exit={{ opacity: 0, scaleY: 0.3, scaleX: 0.85, transition: { duration: 0.15 } }}
          transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }} // overshoot นิดๆ ให้ดูสนุก ฉับไว
        >
          <style>{`
            @keyframes fadeInOut {
              0% { opacity: 0; transform: translateY(-4px); }
              10% { opacity: 1; transform: translateY(0); }
              85% { opacity: 1; }
              100% { opacity: 0; }
            }
          `}</style>
          {/* header */}
          <motion.div
            style={styles.header}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.08 }}
          >
            <div style={styles.headerLeft}>
              <motion.div layoutId="ai-avatar" style={styles.avatarRing} transition={{ duration: 0.32, ease: 'easeInOut' }}>
                <AiAvatar size={24} />
              </motion.div>
              <div>
                <div style={styles.headerTitleRow}>
                  <span style={styles.headerTitle}>ผู้ช่วยออกแบบเกม</span>
                  {lastProvider && (
                    <span style={styles.providerBadge}>
                      {lastProvider === 'gemini' ? 'Gemini' : lastProvider === 'owl-alpha' ? 'Owl Alpha' : lastProvider}
                    </span>
                  )}
                </div>
                <span style={styles.headerSubtitle}>พร้อมช่วยคุณ</span>
              </div>
            </div>
            <button onClick={() => setChatOpen(false)} style={styles.closeBtn} aria-label="ปิด">
              ✕
            </button>
          </motion.div>
 
      {/* dropdown สลับ provider — โผล่เฉพาะตอน dev (localhost) ไม่ขึ้น production */}
      {isDevMode && (
        <div style={styles.devSwitcher}>
          <span style={styles.devLabel}>🧪 dev:</span>
          <select
            value={selectedProvider ?? ''}
            onChange={(e) => setSelectedProvider(e.target.value || null)}
            style={styles.devSelect}
          >
            <option value="">Default (.env)</option>
            <option value="gemini">Gemini</option>
            <option value="owl-alpha">Owl Alpha</option>
          </select>
        </div>
      )}
 
      {/* พื้นที่ข้อความ */}
      <div ref={scrollRef} style={styles.messages}>
        {messages.length === 0 && (
          <motion.div
            style={styles.empty}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.18 }}
          >
            สวัสดี! ถามอะไรเกี่ยวกับการออกแบบเกมหรือ monetization ได้เลย
            เราจะช่วยแนะนำ ไม่ทำแทนนะ
          </motion.div>
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
 
      {/* แจ้งเตือน — คุยแล้วแต่ยังไม่มี project จริง (เช่นหน้า /project/new ที่ยังไม่กด Continue)
          อันนี้ค้างไว้ตลอด ไม่ใช่ toast เพราะเงื่อนไขนี้คงอยู่จนกว่าจะกด Continue */}
      {hasAiReplied && !hasProjectId && (
        <div style={styles.hint}>
          💡 บันทึก/สรุปคำแนะนำได้หลังกด "Continue" เพื่อสร้างโปรเจกต์ก่อน
        </div>
      )}
 
      {/* toast — เด้งบอกแนวทางถามตอน AI ตอบใหม่แต่ยังสรุปไม่ได้ แล้วหายไปเอง
          ใน 4 วิ (ไม่ค้างถาวร ตามที่ user ขอ — มีประโยชน์ตอนไม่รู้จะถามอะไร
          แต่ไม่ควรกินที่ใน UI ตลอดไป) */}
      {showHint && hasProjectId && !canSummarize && (
        <div style={{ ...styles.hint, ...styles.hintToast }}>
          💡 ลองถามเรื่อง genre, core loop, monetization ฯลฯ ก่อน ปุ่มสรุปจะขึ้นเมื่อมีคำแนะนำให้เก็บ
        </div>
      )}
 
      {/* ปุ่มสรุปคำแนะนำ — โผล่เมื่อ AI ตอบแล้ว มี project และมีสาระเกี่ยวกับเกมแล้วเท่านั้น */}
      {canSummarize && (
        <button
          onClick={handleSummarize}
          disabled={isSummarizing}
          style={{
            ...styles.summarizeBtn,
            ...(isSummarizing ? styles.btnDisabled : {}),
          }}
        >
          {isSummarizing ? 'กำลังสรุป…' : '📌 สรุปเป็นคำแนะนำ'}
        </button>
      )}
 
      {/* ช่องพิมพ์ */}
      <motion.div
        style={styles.inputRow}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.14 }}
      >
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
      </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
 
// ── สไตล์ (inline เพื่อไม่ผูกกับ Tailwind config — ปรับ theme ได้ทีหลัง) ──
// ── คำนวณว่าบทสนทนา "พร้อมสรุป" แค่ไหน — ใช้ scoring แทน keyword เดี่ยว ──
// ทำไมต้อง scoring: เทสจริงพบว่า keyword เดียวพลาดได้ 2 ทาง
//   1) AI ทักทายเฉย ๆ แต่ลง bullet "เสนอตัวเลือกให้เลือกถาม" ซึ่งมีคำว่า
//      ads/iap/รายได้ ปนอยู่ในตัวเลือก ทำให้ keyword ติดผิด (false positive)
//   2) user ถามกว้าง ๆ ("สรุปทั้งหมดหน่อย") ไม่มี keyword หัวข้อเลย แต่ AI
//      ตอบด้วยคำแนะนำที่เป็นรูปธรรมจริง (false negative)
// แก้โดยรวม 3 สัญญาณที่ทนทานกว่าคำเดี่ยว ๆ แล้วให้คะแนนสะสม:
//   - topic keyword ที่ user ถาม (ดูเจตนาจาก user เป็นหลัก)
//   - judgment pattern ในคำตอบ AI ("ยังไม่ระบุ", "แพงเกินไป", "ควรเพิ่ม" ฯลฯ
//     — คำที่มักตามด้วยเนื้อหาเจาะจง ไม่ใช่แค่หัวข้อกว้าง ๆ)
//   - ตัวเลข/ราคาที่ AI อ้างอิงจริง (สัญญาณว่ากำลังพูดถึงข้อมูลเกมจริง)
 
const TOPIC_KEYWORDS = [
  'genre', 'แนวเกม', 'platform', 'แพลตฟอร์ม', 'target audience', 'กลุ่มเป้าหมาย',
  'core loop', 'core mechanic', 'กลไก', 'session', 'เซสชัน',
  'ads', 'โฆษณา', 'iap', 'ไอเทม', 'item', 'ราคา', 'price',
  'revenue', 'รายได้', 'monetization', 'frequency cap',
  'interstitial', 'rewarded', 'guardrail', 'จริยธรรม',
  'gdd', 'design', 'ออกแบบ', 'balance', 'สมดุล', 'pitch',
]
 
const JUDGMENT_PATTERNS = [
  'ยังไม่ระบุ', 'ยังไม่มี', 'ยังไม่ได้', 'ควรเพิ่ม', 'ควรเลือก', 'ควรปรับ',
  'แพงเกินไป', 'น้อยไป', 'มากไป', 'อาจจะแพง', 'อาจจะน้อย', 'เสี่ยงต่อ', 'ขาดหาย',
]
 
const SUMMARIZE_SCORE_THRESHOLD = 2
 
function countTopicKeywords(text: string): number {
  const lower = text.toLowerCase()
  return TOPIC_KEYWORDS.filter((kw) => lower.includes(kw.toLowerCase())).length
}
 
function countJudgmentPatterns(text: string): number {
  return JUDGMENT_PATTERNS.filter((kw) => text.includes(kw)).length
}
 
function hasConcreteNumber(text: string): boolean {
  return /\d+/.test(text) || /[$%]/.test(text)
}
 
function scoreForSummarize(messages: ChatMessage[]): number {
  const userText = messages.filter((m) => m.role === 'user').map((m) => m.text).join(' ')
  const aiText = messages.filter((m) => m.role === 'model').map((m) => m.text).join(' ')
 
  let score = 0
  score += Math.min(2, countTopicKeywords(userText)) // user ถามเรื่องอะไร (max 2 แต้ม)
  score += Math.min(2, countJudgmentPatterns(aiText)) // AI ฟันธง/ประเมินกี่จุด (max 2 แต้ม)
  score += hasConcreteNumber(aiText) ? 1 : 0 // AI อ้างตัวเลขจริงไหม (1 แต้ม)
  return score
}
 
const styles: Record<string, React.CSSProperties> = {
  fab: {
    position: 'fixed',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: '50%',
    border: '1.5px solid #B8DCF2',
    background: '#EAF4FC',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(90,174,219,0.25)',
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
    borderRadius: 16,
    border: '1px solid #DCEDF8',
    boxShadow: '0 8px 24px rgba(90,174,219,0.22)',
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
    background: 'linear-gradient(180deg, #EAF4FC, #DCEDF8)',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  avatarRing: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    flexShrink: 0,
  },
  headerTitleRow: { display: 'flex', alignItems: 'center', gap: 8 },
  headerTitle: { fontWeight: 600, fontSize: 15, color: '#1A4A66' },
  headerSubtitle: { fontSize: 11, color: '#5C8FAD' },
  providerBadge: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 10,
    background: 'rgba(90,174,219,0.18)',
    color: '#1A4A66',
  },
  devSwitcher: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 16px',
    background: '#fef3c7',
    borderBottom: '1px solid #fde68a',
  },
  devLabel: { fontSize: 11, fontWeight: 700, color: '#92400e' },
  devSelect: {
    flex: 1,
    fontSize: 12,
    padding: '3px 6px',
    borderRadius: 6,
    border: '1px solid #fde68a',
    background: '#fff',
    color: '#1c1917',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#5C8FAD',
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
  bubbleUser: { alignSelf: 'flex-end', background: '#5AAEDB', color: '#fff', borderBottomRightRadius: 4 },
  bubbleAi: { alignSelf: 'flex-start', background: '#F0F7FC', color: '#1A4A66', borderBottomLeftRadius: 4 },
  error: { color: '#dc2626', fontSize: 12, padding: '0 16px 8px' },
  hint: { color: '#92400e', fontSize: 12, padding: '0 16px 8px', lineHeight: 1.5 },
  hintToast: {
    animation: 'fadeInOut 4s ease-in-out',
    background: '#FFF8E8',
    borderRadius: 8,
    margin: '0 16px 8px',
    padding: '6px 10px',
  },
  summarizeBtn: {
    margin: '0 16px 8px',
    padding: '8px 12px',
    background: '#EAF4FC',
    color: '#1A6FA8',
    border: '1px solid #B8DCF2',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
  inputRow: {
    display: 'flex',
    gap: 8,
    padding: 12,
    borderTop: '1px solid #EDF4FA',
    alignItems: 'flex-end',
  },
  textarea: {
    flex: 1,
    resize: 'none',
    border: '1px solid #DCEDF8',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 14,
    fontFamily: 'inherit',
    maxHeight: 80,
    outline: 'none',
    background: '#F7FAFD',
  },
  sendBtn: {
    padding: '8px 16px',
    background: '#5AAEDB',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
  },
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
}