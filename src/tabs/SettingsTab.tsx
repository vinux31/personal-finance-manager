import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
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
import { useGoals } from '@/queries/goals'
import { useInvestments } from '@/queries/investments'
import { deleteGoal } from '@/db/goals'
import { deleteInvestment } from '@/db/investments'
import { RENCANA_GOAL_NAMES, RENCANA_INVESTMENT_NAMES } from '@/lib/rencanaNames'
import { formatRupiah } from '@/lib/format'
import { BookOpen, Info, LogOut } from 'lucide-react'
import PanduanDialog from '@/components/PanduanDialog'
import TentangDialog from '@/components/TentangDialog'

export default function SettingsTab() {
  const { theme, setTheme } = useThemeStore()
  const { user, signOut } = useAuth()
  const [panduanOpen, setPanduanOpen] = useState(false)
  const [tentangOpen, setTentangOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const qc = useQueryClient()

  const { data: goals = [] } = useGoals()
  const { data: invRows = [] } = useInvestments()

  const activeGoals = goals.filter((g) => g.status === 'active')
  const totalTarget = activeGoals.reduce((s, g) => s + g.target_amount, 0)
  const deadlineStr = activeGoals
    .filter((g) => g.target_date)
    .reduce((latest, g) => (g.target_date! > latest ? g.target_date! : latest), '')
  const deadlineLabel = deadlineStr
    ? new Date(deadlineStr).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
    : '—'

  async function handleResetSeed() {
    if (!confirm('Reset seed Rencana? Goals dan investasi hasil seed akan dihapus.')) return
    setResetting(true)
    try {
      const goalsToDelete = goals.filter((g) =>
        (RENCANA_GOAL_NAMES as readonly string[]).includes(g.name)
      )
      const invsToDelete = invRows.filter((i) =>
        (RENCANA_INVESTMENT_NAMES as readonly string[]).includes(i.asset_name)
      )
      await Promise.all([
        ...goalsToDelete.map((g) => deleteGoal(g.id)),
        ...invsToDelete.map((i) => deleteInvestment(i.id)),
      ])
      localStorage.removeItem('rencana_seeded')
      qc.invalidateQueries({ queryKey: ['goals'] })
      qc.invalidateQueries({ queryKey: ['investments'] })
      toast.success('Seed direset. Buka Dashboard untuk inisialisasi ulang.')
    } catch {
      toast.error('Gagal mereset seed. Coba lagi.')
    } finally {
      setResetting(false)
    }
  }

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

      {/* Rencana */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Rencana</h2>
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-muted-foreground">Total Target</span>
            <span className="font-medium">{totalTarget > 0 ? formatRupiah(totalTarget) : '—'}</span>
            <span className="text-muted-foreground">Deadline</span>
            <span className="font-medium">{deadlineLabel}</span>
            <span className="text-muted-foreground">Goals Aktif</span>
            <span className="font-medium">{activeGoals.length} goals</span>
          </div>
          <div className="pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetSeed}
              disabled={resetting}
            >
              {resetting ? 'Mereset...' : 'Reset Seed Rencana'}
            </Button>
            <p className="mt-1.5 text-xs text-muted-foreground">
              ⚠ Menghapus goals &amp; investasi hasil seed. Buka Dashboard untuk inisialisasi ulang.
            </p>
          </div>
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
