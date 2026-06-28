import { GoogleGenAI } from '@google/genai'
import type { AiProvider, GenerateParams, GenerateResult } from './ai-provider'

const MODEL_ID = 'gemini-2.5-flash'

let client: GoogleGenAI | null = null
function getClient(): GoogleGenAI {
    if (!client) {
        client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    }
    return client
}

async function generate(params: GenerateParams, maxRetries = 3): Promise<GenerateResult>
{
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
                providerName: 'gemini'
            }
        } catch (err: any) {
            // retry เฉพาะ 503 (model overload)
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

export const geminiProvider: AiProvider = {
    name: 'gemini',
    generate,
}