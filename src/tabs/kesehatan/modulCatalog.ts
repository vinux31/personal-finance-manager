import { Wallet, Target, PieChart, Briefcase, Coins, Brain } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type ModulItem = {
  slug: string         // sub-route segment, mis. 'arus-kas'
  label: string        // judul card di grid
  description: string  // 1-line teaser di card
  icon: LucideIcon     // lucide icon
}

// Source: design spec §6 + lampiran "Mapping konten file source ke modul React"
export const MODUL_CATALOG: ModulItem[] = [
  {
    slug: 'arus-kas',
    label: 'Pondasi & Cash Flow',
    description: 'Anggaran, dana darurat, dan disiplin arus kas bulanan.',
    icon: Wallet,
  },
  {
    slug: 'tujuan',
    label: 'Tujuan & Risiko',
    description: 'Time horizon, profil risiko, dan setting target finansial.',
    icon: Target,
  },
  {
    slug: 'alokasi-aset',
    label: 'Alokasi Aset & Diversifikasi',
    description: 'Mengatur porsi saham, obligasi, emas, dan kelas aset lainnya.',
    icon: PieChart,
  },
  {
    slug: 'instrumen',
    label: 'Instrumen Indonesia & Global',
    description: 'Reksa dana, saham IDX, ETF global, dan emas fisik vs digital.',
    icon: Briefcase,
  },
  {
    slug: 'pajak-biaya-inflasi',
    label: 'Pajak, Biaya & Inflasi',
    description: 'Real return setelah inflasi, biaya transaksi, dan efisiensi pajak.',
    icon: Coins,
  },
  {
    slug: 'perilaku',
    label: 'Behavioral Finance & Disiplin',
    description: 'Bias kognitif, FOMO, dan strategi dollar-cost averaging.',
    icon: Brain,
  },
]
