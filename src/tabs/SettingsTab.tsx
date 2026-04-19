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
import { useAuth } from '@/auth/useAuth'
import { BookOpen, Info, LogOut } from 'lucide-react'
import PanduanDialog from '@/components/PanduanDialog'
import TentangDialog from '@/components/TentangDialog'

export default function SettingsTab() {
  const { theme, setTheme } = useThemeStore()
  const { user, signOut } = useAuth()
  const [panduanOpen, setPanduanOpen] = useState(false)
  const [tentangOpen, setTentangOpen] = useState(false)

  return (
    <div className="max-w-2xl space-y-8">
      {/* Tampilan */}
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

      {/* Akun */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Akun</h2>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-3">
            {user?.user_metadata?.avatar_url && (
              <img
                src={user.user_metadata.avatar_url}
                alt="avatar"
                className="h-10 w-10 rounded-full object-cover"
              />
            )}
            <div>
              <div className="font-medium">{user?.user_metadata?.full_name ?? '—'}</div>
              <div className="text-sm text-muted-foreground">{user?.email}</div>
            </div>
          </div>
        </div>
        <div className="mt-3">
          <Button
            variant="outline"
            onClick={async () => {
              if (!confirm('Keluar dari aplikasi?')) return
              await signOut()
            }}
          >
            <LogOut className="h-4 w-4" />
            Keluar
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
