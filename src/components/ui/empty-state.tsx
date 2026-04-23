import { Button } from '@/components/ui/button'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  iconBg?: string
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({
  icon: Icon,
  iconBg = 'bg-[var(--brand-light)]',
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className={`flex h-14 w-14 items-center justify-center rounded-xl ${iconBg}`}>
        <Icon className="h-7 w-7 text-[var(--brand)]" />
      </div>
      <div className="font-semibold text-foreground">{title}</div>
      <p className="max-w-[220px] text-sm text-muted-foreground">{description}</p>
      {actionLabel && onAction && (
        <Button
          size="sm"
          className="mt-1 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white"
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
