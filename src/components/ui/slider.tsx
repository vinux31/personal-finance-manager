import * as React from 'react'
import { cn } from '@/lib/utils'

interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: number[]
  min?: number
  max?: number
  step?: number
  onValueChange?: (value: number[]) => void
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, min = 0, max = 100, step = 1, onValueChange, ...props }, ref) => {
    return (
      <input
        type="range"
        ref={ref}
        value={value?.[0] ?? 0}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onValueChange?.([Number(e.target.value)])}
        className={cn('w-full accent-[var(--gold)] cursor-pointer', className)}
        {...props}
      />
    )
  }
)
Slider.displayName = 'Slider'

export { Slider }
