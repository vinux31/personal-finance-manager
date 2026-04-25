import { create } from 'zustand'

interface PanduanStore {
  open: boolean
  activeSlug: string | null
  openPanduan: (slug?: string) => void
  setActiveSlug: (slug: string) => void
  close: () => void
}

export const usePanduanStore = create<PanduanStore>((set) => ({
  open: false,
  activeSlug: null,
  openPanduan: (slug) => set({ open: true, activeSlug: slug ?? null }),
  setActiveSlug: (slug) => set({ activeSlug: slug }),
  close: () => set({ open: false }),
}))
