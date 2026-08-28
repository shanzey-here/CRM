import { config } from 'dotenv'
config({ path: '.env.local' })

const key = process.env.GEMINI_API_KEY

async function check() {
  const modelsToTest = [
    'gemini-3.6-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro',
    'gemini-3.0-flash',
    'gemini-3.5-flash',
    'gemini-flash-lite-latest'
  ]
  
  for (const model of modelsToTest) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Reply in 1 word: Ready' }] }],
        }),
      })
      const data = await res.json()
      if (res.ok) {
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
        console.log(`✓ Model [${model}]: SUCCESS -> "${text}"`)
      } else {
        console.log(`✗ Model [${model}]: FAILED (${res.status}) -> ${data?.error?.message || res.statusText}`)
      }
    } catch (e: any) {
      console.log(`✗ Model [${model}]: EXCEPTION -> ${e.message}`)
    }
  }
}

check()
