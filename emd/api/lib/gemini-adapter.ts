import { GoogleGenAI } from '@google/genai'
import type { AiProvider, GenerateParams, GenerateResult, StreamChunk } from './ai-provider.js'
 
const MODEL_ID = 'gemini-2.5-flash'
 
let client: GoogleGenAI | null = null
function getClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  }
  return client
}
 
async function generate(params: GenerateParams, maxRetries = 3): Promise<GenerateResult> {
  const ai = getClient()
 
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL_ID,
        contents: params.contents,
        config: {
          systemInstruction: params.systemInstruction,
          temperature: params.temperature ?? 0.7,
          maxOutputTokens: params.maxOutputTokens ?? 1500,
        },
      })
      return {
        text: response.text ?? '',
        usage: response.usageMetadata ?? null,
        providerName: 'gemini',
      }
    } catch (err: any) {
      // retry เฉพาะ 503 (model overload) — error อื่นโยนทันที
      const is503 = err?.status === 503 || /503/.test(String(err?.message))
      if (is503 && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)))
        continue
      }
      throw err
    }
  }
  throw new Error('Gemini: เกินจำนวนครั้ง retry สูงสุด')
}

async function* generateStream(params: GenerateParams): AsyncGenerator<StreamChunk> {
  const ai = getClient()
  let finalUsage: unknown = null

  try {
    const streamResponse = await ai.models.generateContentStream({
      model: MODEL_ID,
      contents: params.contents,
      config: {
        systemInstruction: params.systemInstruction,
        temperature: params.temperature ?? 0.7,
        maxOutputTokens: params.maxOutputTokens ?? 1500,
      },
    })

    for await (const chunk of streamResponse) {
      const text = chunk.text ?? ''
      if (chunk.usageMetadata) finalUsage = chunk.usageMetadata
      if (text) yield { text, done: false }
    }

    yield { text: '', done: true, usage: finalUsage }

  } catch (err: any) {
    // ← log ออกมาให้เห็นใน terminal
    console.error('[gemini-stream] error:', err?.message ?? err)
    throw err  // โยนต่อให้ chat.ts จัดการ
  }
}
 
export const geminiProvider: AiProvider = {
  name: 'gemini',
  generate,
  generateStream,
}