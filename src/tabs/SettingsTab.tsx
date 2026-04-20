import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useThemeStore, type Theme } from '@/lib/theme'
import { useAuthContext } from '@/auth/AuthProvider'
import { useViewAs } from '@/auth/useViewAs'
import { useGoals } from '@/queries/goals'
import { useInvestments } from '@/queries/investments'
import { deleteGoal } from '@/db/goals'
import { deleteInvestment } from '@/db/investments'
import { listAllowedEmails, addAllowedEmail, removeAllowedEmail } from '@/db/allowedEmails'
import { listProfiles } from '@/db/profiles'
import { RENCANA_GOAL_NAMES, RENCANA_INVESTMENT_NAMES } from '@/lib/rencanaNames'
import { formatRupiah } from '@/lib/format'
import { mapSupabaseError } from '@/lib/errors'
import { BookOpen, Eye, Info, LogOut, Users } from 'lucide-react'
import PanduanDialog from '@/components/PanduanDialog'
import TentangDialog from '@/components/TentangDialog'

export default function SettingsTab() {
  const { theme, setTheme } = useThemeStore()
  const { user, signOut, isAdmin } = useAuthContext()
  const { setViewingAs } = useViewAs()
  const [panduanOpen, setPanduanOpen] = useState(false)
  const [tentangOpen, setTentangOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const qc = useQueryClient()

  const { data: goals = [] } = useGoals()
  const { data: invRows = [] } = useInvestments()

  const { data: allowedEmails = [] } = useQuery({
    queryKey: ['allowed-emails'],
    queryFn: listAllowedEmails,
    enabled: isAdmin,
  })

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: listProfiles,
    enabled: isAdmin,
  })

  const addEmailMutation = useMutation({
    mutationFn: addAllowedEmail,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['allowed-emails'] })
      setNewEmail('')
      toast.success('Email ditambahkan')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })

  const removeEmailMutation = useMutation({
    mutationFn: removeAllowedEmail,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['allowed-emails'] })
      toast.success('Email dihapus')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })

  function handleAddEmail(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = newEmail.trim().toLowerCase()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error('Format email tidak valid')
      return
    }
    addEmailMutation.mutate(trimmed)
  }

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

      {/* Manajemen Pengguna — hanya admin */}
      {isAdmin && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Manajemen Pengguna</h2>

          <div className="rounded-lg border bg-card p-4 space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Email yang Diizinkan Login
            </h3>
            <div className="space-y-2">
              {allowedEmails.map((ae) => (
                <div key={ae.id} className="flex items-center justify-between text-sm">
                  <span>{ae.email}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-destructive hover:text-destructive"
                    disabled={ae.email === user?.email || removeEmailMutation.isPending}
                    onClick={() => {
                      if (!confirm(`Hapus ${ae.email}?`)) return
                      removeEmailMutation.mutate(ae.id)
                    }}
                  >
                    Hapus
                  </Button>
                </div>
              ))}
            </div>
            <form onSubmit={handleAddEmail} className="flex gap-2">
              <Input
                type="email"
                placeholder="email@contoh.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="h-8 text-sm"
              />
              <Button type="submit" size="sm" disabled={addEmailMutation.isPending}>
                Tambah
              </Button>
            </form>
          </div>

          {profiles.filter((p) => p.id !== user?.id).length > 0 && (
            <div className="mt-4 rounded-lg border bg-card p-4 space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Lihat Keuangan Pengguna Lain
              </h3>
              <div className="space-y-2">
                {profiles
                  .filter((p) => p.id !== user?.id)
                  .map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <span>{p.display_name ?? p.id.slice(0, 8)}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setViewingAs({
                            uid: p.id,
                            displayName: p.display_name ?? '',
                            email: '',
                          })
                          toast.info(`Beralih ke data ${p.display_name ?? 'pengguna'}`)
                        }}
                      >
                        Lihat Keuangan
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </section>
      )}

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
