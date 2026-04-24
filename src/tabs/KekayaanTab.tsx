import { useEffect, useMemo, useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  Plus,
  Pencil,
  Trash2,
  Landmark,
  CreditCard,
  Wallet,
  Building2,
  Car,
  Home,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import {
  useNetWorthAccounts,
  useDeleteNetWorthAccount,
  useNetWorthLiabilities,
  useDeleteNetWorthLiability,
  useNetWorthSnapshots,
  type NetWorthAccount,
  type NetWorthLiability,
  type AccountType,
  type LiabilityType,
} from '@/queries/netWorth'
import { insertSnapshotIfNeeded } from '@/db/netWorth'
import { useInvestments, currentValue } from '@/queries/investments'
import { useTargetUserId } from '@/auth/useTargetUserId'
import { formatRupiah, shortRupiah } from '@/lib/format'
import NetWorthAccountDialog from '@/components/NetWorthAccountDialog'
import NetWorthLiabilityDialog from '@/components/NetWorthLiabilityDialog'

const ACCOUNT_ICON: Record<AccountType, typeof Landmark> = {
  tabungan: Landmark,
  giro: Landmark,
  cash: Wallet,
  deposito: Landmark,
  dompet_digital: Wallet,
  properti: Building2,
  kendaraan: Car,
}

const LIABILITY_ICON: Record<LiabilityType, typeof CreditCard> = {
  kpr: Home,
  cicilan_kendaraan: Car,
  kartu_kredit: CreditCard,
  paylater: CreditCard,
  kta: CreditCard,
}

const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  tabungan: 'Tabungan',
  giro: 'Giro',
  cash: 'Cash',
  deposito: 'Deposito',
  dompet_digital: 'Dompet Digital',
  properti: 'Properti',
  kendaraan: 'Kendaraan',
}

const LIABILITY_TYPE_LABEL: Record<LiabilityType, string> = {
  kpr: 'KPR',
  cicilan_kendaraan: 'Cicilan Kendaraan',
  kartu_kredit: 'Kartu Kredit',
  paylater: 'PayLater',
  kta: 'KTA',
}

export default function KekayaanTab() {
  const [accountDialogOpen, setAccountDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<NetWorthAccount | null>(null)
  const [liabilityDialogOpen, setLiabilityDialogOpen] = useState(false)
  const [editingLiability, setEditingLiability] = useState<NetWorthLiability | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<{
    type: 'account' | 'liability'
    id: number
    name: string
  } | null>(null)

  const uid = useTargetUserId()
  const { data: accounts = [], isLoading: accountsLoading } = useNetWorthAccounts()
  const { data: liabilities = [], isLoading: liabilitiesLoading } = useNetWorthLiabilities()
  const { data: investments = [] } = useInvestments()
  const { data: snapshots = [] } = useNetWorthSnapshots()
  const deleteAccount = useDeleteNetWorthAccount()
  const deleteLiability = useDeleteNetWorthLiability()

  const totalAccounts = useMemo(
    () => accounts.reduce((s, a) => s + Number(a.balance), 0),
    [accounts],
  )
  const totalInvestments = useMemo(
    () => investments.reduce((s, i) => s + currentValue(i), 0),
    [investments],
  )
  const totalLiabilities = useMemo(
    () => liabilities.reduce((s, l) => s + Number(l.amount), 0),
    [liabilities],
  )
  const totalAset = totalAccounts + totalInvestments
  const netWorth = totalAset - totalLiabilities

  // Auto-snapshot (NW-07) with loading guard (Pitfall 2)
  useEffect(() => {
    if (!uid || accountsLoading || liabilitiesLoading) return
    const now = new Date()
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    insertSnapshotIfNeeded(uid, monthKey, totalAccounts, totalInvestments, totalLiabilities).catch(
      (err) => console.error('snapshot insert failed', err),
    )
  }, [uid, accountsLoading, liabilitiesLoading, totalAccounts, totalInvestments, totalLiabilities])

  // Chart data: last 6 snapshots sorted ASC
  const chartData = useMemo(
    () =>
      snapshots
        .slice()
        .sort((a, b) => a.snapshot_month.localeCompare(b.snapshot_month))
        .slice(-6)
        .map((s) => ({
          month: new Date(s.snapshot_month).toLocaleDateString('id-ID', { month: 'short' }),
          net_worth: Number(s.net_worth),
        })),
    [snapshots],
  )

  function onDeleteAccount(a: NetWorthAccount) {
    setConfirmTarget({ type: 'account', id: a.id, name: a.name })
    setConfirmOpen(true)
  }

  function onDeleteLiability(l: NetWorthLiability) {
    setConfirmTarget({ type: 'liability', id: l.id, name: l.name })
    setConfirmOpen(true)
  }

  function onConfirmDelete() {
    if (!confirmTarget) return
    if (confirmTarget.type === 'account') deleteAccount.mutate(confirmTarget.id)
    else deleteLiability.mutate(confirmTarget.id)
  }

  return (
    <div className="space-y-8">
      {/* Summary Card */}
      <div
        className="rounded-xl p-4 text-white"
        style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)' }}
      >
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-200">
          Net Worth
        </div>
        <div className="text-xl font-semibold tracking-tight">{formatRupiah(netWorth)}</div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-indigo-100">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-indigo-200 mr-1">Aset</span>
            {formatRupiah(totalAset)}
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-indigo-200 mr-1">
              Liabilitas
            </span>
            {formatRupiah(totalLiabilities)}
          </div>
        </div>
      </div>

      {/* Aset & Rekening Section */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Aset &amp; Rekening</h2>
          <Button
            size="sm"
            onClick={() => {
              setEditingAccount(null)
              setAccountDialogOpen(true)
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Tambah Akun
          </Button>
        </div>
        {accountsLoading ? (
          <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
            Memuat…
          </div>
        ) : accounts.length === 0 && totalInvestments === 0 ? (
          <EmptyState
            icon={Landmark}
            title="Belum ada akun atau aset"
            description="Tambah rekening bank, properti, atau aset lainnya untuk mulai menghitung Net Worth Anda."
            actionLabel="+ Tambah Akun"
            onAction={() => {
              setEditingAccount(null)
              setAccountDialogOpen(true)
            }}
          />
        ) : (
          <div className="space-y-3">
            {accounts.map((a) => {
              const Icon = ACCOUNT_ICON[a.type] ?? Landmark
              return (
                <div
                  key={a.id}
                  className="rounded-xl border bg-card p-4"
                  style={{ borderLeft: '4px solid var(--brand)' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <Icon className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{a.name}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {formatRupiah(Number(a.balance))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[10px]">
                        {ACCOUNT_TYPE_LABEL[a.type]}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit akun ${a.name}`}
                        onClick={() => {
                          setEditingAccount(a)
                          setAccountDialogOpen(true)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Hapus akun ${a.name}`}
                        onClick={() => onDeleteAccount(a)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
            {totalInvestments > 0 && (
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm italic text-muted-foreground">Nilai Investasi</span>
                    <Badge variant="secondary" className="text-[10px]">
                      otomatis
                    </Badge>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {formatRupiah(totalInvestments)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Liabilitas Section */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Liabilitas</h2>
          <Button
            size="sm"
            onClick={() => {
              setEditingLiability(null)
              setLiabilityDialogOpen(true)
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Tambah Liabilitas
          </Button>
        </div>
        {liabilitiesLoading ? (
          <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
            Memuat…
          </div>
        ) : liabilities.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="Belum ada liabilitas"
            description="Tambah utang atau cicilan aktif untuk mendapatkan gambaran Net Worth yang akurat."
            actionLabel="+ Tambah Liabilitas"
            onAction={() => {
              setEditingLiability(null)
              setLiabilityDialogOpen(true)
            }}
          />
        ) : (
          <div className="space-y-3">
            {liabilities.map((l) => {
              const Icon = LIABILITY_ICON[l.type] ?? CreditCard
              return (
                <div
                  key={l.id}
                  className="rounded-xl border bg-card p-4"
                  style={{ borderLeft: '4px solid var(--brand)' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <Icon className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{l.name}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {formatRupiah(Number(l.amount))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[10px]">
                        {LIABILITY_TYPE_LABEL[l.type]}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit liabilitas ${l.name}`}
                        onClick={() => {
                          setEditingLiability(l)
                          setLiabilityDialogOpen(true)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Hapus liabilitas ${l.name}`}
                        onClick={() => onDeleteLiability(l)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Tren Net Worth Section */}
      <div>
        <h2 className="mb-3 text-base font-semibold">Tren Net Worth</h2>
        {chartData.length === 0 ? (
          <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
            Belum ada data tren. Buka tab ini tiap bulan untuk melihat perkembangan kekayaan Anda.
          </div>
        ) : (
          <div className="rounded-xl border bg-card p-4">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={shortRupiah} tick={{ fontSize: 12 }} width={70} />
                <Tooltip
                  formatter={(v: unknown) => formatRupiah(typeof v === 'number' ? v : 0)}
                />
                <Area
                  type="monotone"
                  dataKey="net_worth"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#netWorthGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <NetWorthAccountDialog
        open={accountDialogOpen}
        onOpenChange={setAccountDialogOpen}
        editing={editingAccount}
      />
      <NetWorthLiabilityDialog
        open={liabilityDialogOpen}
        onOpenChange={setLiabilityDialogOpen}
        editing={editingLiability}
      />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={confirmTarget?.type === 'account' ? 'Hapus Akun' : 'Hapus Liabilitas'}
        description={`${confirmTarget?.type === 'account' ? 'Akun' : 'Liabilitas'} "${confirmTarget?.name ?? ''}" akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`}
        onConfirm={onConfirmDelete}
      />
    </div>
  )
}
