import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

// ---------- CORS allowlist ----------
// Per-domain CORS. Production domain `kantongpintar.vercel.app` (Vercel) included.
// Vercel preview deploys (e.g. `<branch>-<hash>.vercel.app`) are NOT in this list — test edge
// functions only via `supabase functions serve` locally OR via production.
const ALLOWED_ORIGINS = new Set<string>([
  'https://kantongpintar.app',
  'https://www.kantongpintar.app',
  'https://kantongpintar.vercel.app',
])

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://kantongpintar.app'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    // Critical: prevents CDN cross-origin cache poisoning when the response is cached for Origin A
    // and served to Origin B.
    'Vary': 'Origin',
  }
}

// ---------- Types ----------
interface InvestmentInput {
  id: number
  asset_type: string
  asset_name: string
}

interface PriceResult {
  id: number
  price: number
}

interface PriceError {
  id: number
  asset_name: string
  reason: string
}

interface FetchPricesResponse {
  results: PriceResult[]
  errors: PriceError[]
}

// ---------- Handler ----------
Deno.serve(async (req) => {
  const cors = corsFor(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  // Defense-in-depth: even though `verify_jwt = true` in config.toml causes the platform
  // to reject missing/invalid JWTs before reaching this handler, we still extract the user
  // identity for two reasons:
  //   1. Cover the 2026 API-key-migration corner case (--no-verify-jwt fallback)
  //   2. Make the user object available for future per-user rate limiting / ownership checks
  // Use SUPABASE_ANON_KEY (NOT service role) — service role would bypass RLS and turn any
  // post-auth bug into privilege escalation.
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
  const token = authHeader.slice('Bearer '.length)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  )
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  // ---------- Existing business logic (unchanged) ----------
  try {
    const { investments }: { investments: InvestmentInput[] } = await req.json()

    const results: PriceResult[] = []
    const errors: PriceError[] = []

    const saham = investments.filter((i) => i.asset_type === 'Saham')
    const emas = investments.filter((i) => i.asset_type === 'Emas')

    await Promise.all(
      saham.map(async (inv) => {
        try {
          const price = await fetchSahamPrice(inv.asset_name)
          results.push({ id: inv.id, price })
        } catch (e) {
          errors.push({ id: inv.id, asset_name: inv.asset_name, reason: String(e) })
        }
      }),
    )

    if (emas.length > 0) {
      try {
        const emasPrice = await fetchEmasPrice()
        for (const inv of emas) {
          results.push({ id: inv.id, price: emasPrice })
        }
      } catch (e) {
        for (const inv of emas) {
          errors.push({ id: inv.id, asset_name: inv.asset_name, reason: String(e) })
        }
      }
    }

    const response: FetchPricesResponse = { results, errors }
    return new Response(JSON.stringify(response), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})

// ---------- Helpers (unchanged) ----------
function extractTicker(assetName: string): string {
  // Cari kode IDX: 4-6 huruf kapital (contoh: BBCA, BMRI, TLKM)
  const match = assetName.match(/\b([A-Z]{4,6})\b/)
  if (match) return match[1]
  // Fallback: pakai kata terakhir uppercase
  const words = assetName.trim().split(/\s+/)
  return words[words.length - 1].toUpperCase()
}

async function fetchSahamPrice(assetName: string): Promise<number> {
  const ticker = `${extractTicker(assetName)}.JK`
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })
  if (!res.ok) throw new Error(`Yahoo Finance error: ${res.status}`)
  const json = await res.json()
  const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice
  if (!price) throw new Error(`Harga tidak ditemukan untuk ${ticker}`)
  return price
}

async function fetchEmasPrice(): Promise<number> {
  const apiKey = Deno.env.get('METALS_DEV_API_KEY')
  if (!apiKey) throw new Error('METALS_DEV_API_KEY tidak di-set')

  const [goldRes, rateRes] = await Promise.all([
    fetch(`https://api.metals.dev/v1/latest?api_key=${apiKey}&currency=USD&unit=toz`),
    fetch('https://open.er-api.com/v6/latest/USD'),
  ])

  if (!goldRes.ok) throw new Error(`metals.dev error: ${goldRes.status}`)
  if (!rateRes.ok) throw new Error(`exchange rate error: ${rateRes.status}`)

  const goldJson = await goldRes.json()
  const rateJson = await rateRes.json()

  const xauPerOz: number = goldJson?.metals?.gold
  const usdIdr: number = rateJson?.rates?.IDR

  if (!xauPerOz) throw new Error('Harga emas tidak ditemukan dari metals.dev')
  if (!usdIdr) throw new Error('Kurs USD/IDR tidak ditemukan')

  // USD per troy oz → IDR per gram
  const pricePerGram = (xauPerOz / 31.1035) * usdIdr
  return Math.round(pricePerGram)
}
