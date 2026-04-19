import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useThemeStore, type Theme } from '@/lib/theme'
import { useDbStore } from '@/db/store'
import { BookOpen, Info, FolderOpen, FilePlus2, LogOut } from 'lucide-react'
import PanduanDialog from '@/components/PanduanDialog'
import TentangDialog from '@/components/TentangDialog'
import { toast } from 'sonner'

export default function SettingsTab() {
  const { theme, setTheme } = useThemeStore()
  const { handle, reset, openExisting, createNew } = useDbStore()
  const [panduanOpen, setPanduanOpen] = useState(false)
  const [tentangOpen, setTentangOpen] = useState(false)

  return (
    <div className="max-w-2xl space-y-8">
      {/* Tema */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Tampilan</h2>
        <div className="grid max-w-sm gap-2">
          <Label>Tema</Label>
          <Select value={theme} onValueChange={(v) => setTheme(v as Theme)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Terang</SelectItem>
              <SelectItem value="dark">Gelap</SelectItem>
              <SelectItem value="system">Ikuti sistem</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* File data */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">File Data</h2>
        <div className="rounded-lg border bg-card p-4 text-sm">
          <div className="text-muted-foreground">File aktif:</div>
          <div className="mt-1 font-mono text-xs">
            {handle?.name ?? '(tidak diketahui)'}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              await openExisting()
              toast.success('File data dibuka')
            }}
          >
            <FolderOpen className="h-4 w-4" />
            Ganti ke File Lain
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              if (!confirm('Buat file data baru? Data saat ini tidak dihapus — hanya aplikasi yang beralih file.')) return
              await createNew()
              toast.success('File data baru dibuat')
            }}
          >
            <FilePlus2 className="h-4 w-4" />
            Buat File Baru
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              if (!confirm('Putuskan koneksi ke file data? File tetap aman, Anda perlu pilih ulang saat buka lagi.')) return
              await reset()
            }}
          >
            <LogOut className="h-4 w-4" />
            Lepas File Data
          </Button>
        </div>
      </section>

      {/* Bantuan */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Bantuan</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setPanduanOpen(true)}>
            <BookOpen className="h-4 w-4" />
            Panduan Pengguna
          </Button>
          <Button variant="outline" onClick={() => setTentangOpen(true)}>
            <Info className="h-4 w-4" />
            Tentang
          </Button>
        </div>
      </section>

      <PanduanDialog open={panduanOpen} onOpenChange={setPanduanOpen} />
      <TentangDialog open={tentangOpen} onOpenChange={setTentangOpen} />
    </div>
  )
}
