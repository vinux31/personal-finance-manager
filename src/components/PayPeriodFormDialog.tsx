import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
  useCreatePayPeriod,
  useUpdatePayPeriod,
  usePayPeriodExistsOnDate,
} from '../queries/payPeriods'
import { todayISO } from '../lib/format'
import { toast } from 'sonner'

type CreateMode = {
  mode: 'create'
  open: boolean
  onOpenChange: (open: boolean) => void
}

type RenameMode = {
  mode: 'rename'
  open: boolean
  onOpenChange: (open: boolean) => void
  periodId: number
  initialLabel: string
}

type Props = CreateMode | RenameMode

function suggestDefaultLabel(): string {
  const d = new Date()
  const bulan = d.toLocaleString('id-ID', { month: 'long' })
  return `Gaji ${bulan.charAt(0).toUpperCase() + bulan.slice(1)} ${d.getFullYear()}`
}

export function PayPeriodFormDialog(props: Props) {
  const isCreate = props.mode === 'create'
  const [label, setLabel] = useState(
    isCreate ? suggestDefaultLabel() : props.initialLabel,
  )
  const [startDate, setStartDate] = useState(todayISO())

  const createMut = useCreatePayPeriod()
  const updateMut = useUpdatePayPeriod()
  const existsQuery = usePayPeriodExistsOnDate(isCreate ? startDate : '')

  useEffect(() => {
    if (!props.open) return
    if (isCreate) {
      setLabel(suggestDefaultLabel())
      setStartDate(todayISO())
    } else {
      setLabel(props.initialLabel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open])

  const isDuplicate = isCreate && existsQuery.data === true
  const labelEmpty = label.trim().length === 0
  const isPending = createMut.isPending || updateMut.isPending

  async function handleSubmit() {
    if (labelEmpty) return
    try {
      if (isCreate) {
        if (isDuplicate) return
        await createMut.mutateAsync({ label: label.trim(), start_date: startDate })
        toast.success(`Periode "${label.trim()}" dimulai`)
      } else {
        await updateMut.mutateAsync({ id: props.periodId, label: label.trim() })
        toast.success('Periode di-rename')
      }
      props.onOpenChange(false)
    } catch (err: any) {
      toast.error('Gagal: ' + (err?.message ?? 'Unknown error'))
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isCreate ? 'Buat Periode Baru' : 'Rename Periode'}
          </DialogTitle>
          <DialogDescription>
            {isCreate
              ? 'Tentukan label dan tanggal mulai periode gaji baru.'
              : 'Ubah label periode tanpa mengubah tanggal mulainya.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="period-label">Label Periode</Label>
            <Input
              id="period-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Gaji Mei 2026"
            />
          </div>

          {isCreate && (
            <div className="space-y-1">
              <Label htmlFor="period-start">Tanggal Mulai</Label>
              <Input
                id="period-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              {isDuplicate && (
                <p className="text-xs text-red-500">
                  Periode dengan tanggal mulai ini sudah ada
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => props.onOpenChange(false)}
            disabled={isPending}
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={labelEmpty || isPending || isDuplicate}
          >
            {isPending ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
