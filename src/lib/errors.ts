export function mapSupabaseError(error: unknown): string {
  if (!error) return 'Terjadi kesalahan tidak diketahui'
  const msg = error instanceof Error ? error.message : String(error)

  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return 'Tidak ada koneksi internet. Periksa jaringan Anda.'
  }
  if (msg.includes('JWT expired')) {
    return 'Sesi habis. Silakan login ulang.'
  }
  if (msg.includes('violates row-level security')) {
    return 'Akses ditolak.'
  }
  if (msg.includes('unique constraint') || msg.includes('duplicate key')) {
    return 'Data sudah ada. Gunakan nama yang berbeda.'
  }
  if (msg.includes('foreign key')) {
    return 'Data terkait tidak ditemukan.'
  }
  return msg
}
