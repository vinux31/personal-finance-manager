import { useEffect } from 'react'
import { useDbStore } from '@/db/store'
import { isFsApiSupported } from '@/db/fileHandle'
import { Button } from '@/components/ui/button'
import { FileText, FolderOpen, FilePlus2, AlertTriangle } from 'lucide-react'

export default function FirstRunDialog() {
  const { status, error, createNew, openExisting, tryRestore } = useDbStore()

  useEffect(() => {
    void tryRestore()
  }, [tryRestore])

  if (status === 'ready') return null

  if (!isFsApiSupported()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-lg border bg-card p-6 text-card-foreground shadow">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Browser tidak didukung</h2>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Aplikasi ini butuh <strong>Chrome</strong> atau <strong>Microsoft Edge</strong>{' '}
            (versi baru) karena memakai File System Access API untuk menyimpan data
            langsung ke laptop Anda. Firefox dan Safari belum mendukung fitur ini.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg rounded-lg border bg-card p-8 text-card-foreground shadow">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6" />
          <h2 className="text-xl font-semibold">Selamat datang</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Pilih lokasi file data Anda. File <code>.db</code> akan tersimpan di folder
          yang Anda tentukan — Anda bisa memindahkan atau mem-backup-nya kapan saja.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Tip: simpan di dalam folder Google Drive Desktop untuk sinkronisasi otomatis
          antar perangkat.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <Button
            size="lg"
            onClick={() => void createNew()}
            disabled={status === 'loading'}
            className="justify-start gap-3"
          >
            <FilePlus2 className="h-4 w-4" />
            Buat file data baru
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => void openExisting()}
            disabled={status === 'loading'}
            className="justify-start gap-3"
          >
            <FolderOpen className="h-4 w-4" />
            Buka file data yang sudah ada
          </Button>
        </div>

        {error && (
          <p className="mt-4 rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
