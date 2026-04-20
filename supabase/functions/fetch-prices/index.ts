import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

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
      })
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

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
