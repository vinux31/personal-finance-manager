export function mapSupabaseError(error: unknown): string {
  if (!error) return 'Terjadi kesalahan tidak diketahui'
  const objMessage =
    typeof error === 'object' && error !== null && 'message' in error
      ? (error as { message: unknown }).message
      : undefined
  const objCode =
    typeof error === 'object' && error !== null && 'code' in error
      ? (error as { code: unknown }).code
      : undefined
  const msg =
    typeof objMessage === 'string'
      ? objMessage
      : error instanceof Error
        ? error.message
        : String(error)
  const code = typeof objCode === 'string' ? objCode : ''

  // SQLSTATE 42501 = insufficient_privilege — explicit "Akses ditolak" from RPC IDOR guards.
  // SQLSTATE 28000 = invalid_authorization — Unauthenticated guard.
  if (code === '42501' || msg === 'Akses ditolak') {
    return 'Akses ditolak'
  }
  if (code === '28000' || msg === 'Unauthenticated') {
    return 'Sesi habis. Silakan login ulang.'
  }

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
