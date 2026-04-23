// src/lib/pensiun-calc.ts

// ─── Simulasi DCA ──────────────────────────────────────────────────────────

export interface SimulasiParams {
  usia: number
  usiaPensiun: number
  investasiBulanan: number
  kenaikanPct: number
  inflasiPct: number
  targetBulanan: number
  alokasiEmas: number   // 0-100
  alokasiSaham: number  // 0-100
  alokasiRd: number     // 0-100
  rdType: 'pu' | 'pt' | 'cp' | 'sh'
}

export interface SimulasiResult {
  totalDana: number
  totalModal: number
  keuntungan: number
  danaCukupTahun: number
  perAset: { emas: number; saham: number; rd: number }
  yearlyData: { tahun: number; emas: number; saham: number; rd: number; total: number }[]
}

const RD_RETURNS: Record<string, number> = { pu: 0.05, pt: 0.07, cp: 0.10, sh: 0.14 }
const EMAS_RETURN = 0.10
const SAHAM_RETURN = 0.15

export function calcDCA(p: SimulasiParams): SimulasiResult {
  const tahun = p.usiaPensiun - p.usia
  if (tahun <= 0) {
    return { totalDana: 0, totalModal: 0, keuntungan: 0, danaCukupTahun: 0, perAset: { emas: 0, saham: 0, rd: 0 }, yearlyData: [] }
  }

  const rdReturn = RD_RETURNS[p.rdType] ?? 0.10
  const allocEmas = p.alokasiEmas / 100
  const allocSaham = p.alokasiSaham / 100
  const allocRd = p.alokasiRd / 100

  const rEmas = Math.pow(1 + EMAS_RETURN, 1 / 12) - 1
  const rSaham = Math.pow(1 + SAHAM_RETURN, 1 / 12) - 1
  const rRd = Math.pow(1 + rdReturn, 1 / 12) - 1

  let sEmas = 0, sSaham = 0, sRd = 0, totalModal = 0
  let invest = p.investasiBulanan
  const yearlyData: SimulasiResult['yearlyData'] = []

  for (let yr = 1; yr <= tahun; yr++) {
    for (let mo = 0; mo < 12; mo++) {
      sEmas = sEmas * (1 + rEmas) + invest * allocEmas
      sSaham = sSaham * (1 + rSaham) + invest * allocSaham
      sRd = sRd * (1 + rRd) + invest * allocRd
      totalModal += invest
    }
    yearlyData.push({
      tahun: yr,
      emas: Math.round(sEmas),
      saham: Math.round(sSaham),
      rd: Math.round(sRd),
      total: Math.round(sEmas + sSaham + sRd),
    })
    invest *= 1 + p.kenaikanPct / 100
  }

  const totalDana = sEmas + sSaham + sRd

  let danaCukupTahun = 0
  if (p.targetBulanan <= 0) {
    danaCukupTahun = 999
  } else {
    let sisa = totalDana
    let pengeluaran = p.targetBulanan * 12
    const rInflasi = p.inflasiPct / 100
    while (sisa >= pengeluaran && danaCukupTahun < 100) {
      sisa -= pengeluaran
      danaCukupTahun++
      pengeluaran *= (1 + rInflasi)
    }
  }

  return {
    totalDana: Math.round(totalDana),
    totalModal: Math.round(totalModal),
    keuntungan: Math.round(totalDana - totalModal),
    danaCukupTahun,
    perAset: { emas: Math.round(sEmas), saham: Math.round(sSaham), rd: Math.round(sRd) },
    yearlyData,
  }
}

// ─── BPJS ──────────────────────────────────────────────────────────────────

export interface BPJSParams {
  upahBulanan: number
  masaKerja: number
}

export interface BPJSResult {
  jht: number
  jpBulanan: number
}

export function calcBPJS(p: BPJSParams): BPJSResult {
  // JHT: 5.7% upah/bln dikompound 5.5%/thn
  const iuranJHT = p.upahBulanan * 0.057
  const rJHT = Math.pow(1 + 0.055, 1 / 12) - 1
  let jht = 0
  for (let i = 0; i < p.masaKerja * 12; i++) {
    jht = jht * (1 + rJHT) + iuranJHT
  }

  // JP: 1% × min(masaKerja, 30) × min(upah, 9jt)
  const jpBulanan = 0.01 * Math.min(p.masaKerja, 30) * Math.min(p.upahBulanan, 9_000_000)

  return { jht: Math.round(jht), jpBulanan: Math.round(jpBulanan) }
}

// ─── DPPK ──────────────────────────────────────────────────────────────────

export interface DPPKParams {
  type: 'ppmp' | 'ppip'
  phdp: number
  faktor: number
  iuranBulanan: number
  masaKerja: number
}

export interface DPPKResult {
  total: number
}

export function calcDPPK(p: DPPKParams): DPPKResult {
  if (p.type === 'ppmp') {
    const total = p.masaKerja * (p.faktor / 100) * p.phdp
    return { total: Math.round(total) }
  }
  // PPIP: iuran dikompound 8%/thn
  const r = Math.pow(1 + 0.08, 1 / 12) - 1
  let total = 0
  for (let i = 0; i < p.masaKerja * 12; i++) {
    total = total * (1 + r) + p.iuranBulanan
  }
  return { total: Math.round(total) }
}

// ─── DPLK ──────────────────────────────────────────────────────────────────

export interface DPLKParams {
  iuranBulanan: number
  returnPct: number
  saldoAwal: number
  masaKerja: number
}

export interface DPLKResult {
  total: number
}

export function calcDPLK(p: DPLKParams): DPLKResult {
  const r = Math.pow(1 + p.returnPct / 100, 1 / 12) - 1
  let total = p.saldoAwal
  for (let i = 0; i < p.masaKerja * 12; i++) {
    total = total * (1 + r) + p.iuranBulanan
  }
  return { total: Math.round(total) }
}

// ─── Taspen (ASN/PNS) ──────────────────────────────────────────────────────

export const TASPEN_GAJI: Record<string, number> = {
  Ia: 1_560_800, Ib: 1_704_500, Ic: 1_776_600, Id: 1_851_800,
  IIa: 2_022_200, IIb: 2_208_400, IIc: 2_301_800, IId: 2_399_200,
  IIIa: 2_802_300, IIIb: 2_928_300, IIIc: 3_059_700, IIId: 3_196_500,
  IVa: 3_339_100, IVb: 3_487_100, IVc: 3_641_400, IVd: 3_802_200, IVe: 3_969_300,
}

export interface TaspenParams {
  gajiTerakhir: number
  golongan: string
  masaKerja: number
}

export interface TaspenResult {
  bulanan: number
  tht: number
}

export function calcTaspen(p: TaspenParams): TaspenResult {
  const gajiPensiun = p.gajiTerakhir > 0 ? p.gajiTerakhir : (TASPEN_GAJI[p.golongan] ?? 0)
  // Pensiun bulanan: 2.5% × masa_kerja × gaji_pensiun, max 75%
  const pct = Math.min(p.masaKerja * 0.025, 0.75)
  const bulanan = pct * gajiPensiun
  // THT (lump sum): 0.36% × gaji × 12 × masa_kerja (simplified)
  const tht = 0.0036 * gajiPensiun * 12 * p.masaKerja
  return { bulanan: Math.round(bulanan), tht: Math.round(tht) }
}

// ─── Pesangon ──────────────────────────────────────────────────────────────

export interface PesangonResult {
  total: number
}

function upMasaKerja(mk: number): number {
  if (mk < 1) return 1
  if (mk < 2) return 2
  if (mk < 3) return 3
  if (mk < 4) return 4
  if (mk < 5) return 5
  if (mk < 6) return 6
  if (mk < 7) return 7
  if (mk < 8) return 8
  return 9
}

function upmkMasaKerja(mk: number): number {
  if (mk < 3) return 0
  if (mk < 6) return 2
  if (mk < 9) return 3
  if (mk < 12) return 4
  if (mk < 15) return 5
  if (mk < 18) return 6
  if (mk < 21) return 7
  if (mk < 24) return 8
  return 10
}

export function calcPesangon(gajiPokok: number, masaKerja: number): PesangonResult {
  const up = upMasaKerja(masaKerja) * gajiPokok
  const upmk = upmkMasaKerja(masaKerja) * gajiPokok
  const uph = (up + upmk) * 0.15
  // 2× UP + 1× UPMK + UPH (pensiun sukarela / efisiensi UU 11/2020)
  const total = 2 * up + upmk + uph
  return { total: Math.round(total) }
}

// ─── Investasi Mandiri (Hitung Total) ─────────────────────────────────────

export interface InvestasiMandiriParams {
  iuranBulanan: number
  returnPct: number
  saldoAwal: number
  kenaikanPct: number
  masaKerja: number
}

export interface InvestasiMandiriResult {
  total: number
}

export function calcInvestasiMandiri(p: InvestasiMandiriParams): InvestasiMandiriResult {
  const r = Math.pow(1 + p.returnPct / 100, 1 / 12) - 1
  let total = p.saldoAwal
  let iuran = p.iuranBulanan
  for (let yr = 0; yr < p.masaKerja; yr++) {
    for (let mo = 0; mo < 12; mo++) {
      total = total * (1 + r) + iuran
    }
    iuran *= 1 + p.kenaikanPct / 100
  }
  return { total: Math.round(total) }
}
