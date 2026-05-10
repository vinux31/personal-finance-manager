import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GlossaryTooltip } from './GlossaryTooltip'

describe('GlossaryTooltip', () => {
  it('renders plain text fallback for unknown term (no Popover, no underline)', () => {
    const { container } = render(
      <GlossaryTooltip term="not-a-real-term">UnknownTerm</GlossaryTooltip>,
    )
    // Should render children as plain span without role=button
    expect(screen.getByText('UnknownTerm')).toBeDefined()
    expect(container.querySelector('[role="button"]')).toBeNull()
    expect(container.querySelector('[data-slot="glossary-tooltip-trigger"]')).toBeNull()
  })

  it('renders trigger with dotted underline + role=button + aria-label for valid term', () => {
    render(<GlossaryTooltip term="dca">DCA</GlossaryTooltip>)
    const trigger = screen.getByRole('button', { name: /Definisi: DCA/i })
    expect(trigger).toBeDefined()
    expect(trigger.className).toContain('border-dotted')
    expect(trigger.className).toContain('cursor-help')
    expect(trigger.textContent).toBe('DCA')
  })

  it('opens popover with label + definition when trigger clicked', async () => {
    render(<GlossaryTooltip term="rebalancing">Rebalance</GlossaryTooltip>)
    const trigger = screen.getByRole('button', { name: /Definisi: Rebalancing/i })
    fireEvent.click(trigger)
    // Radix renders content in Portal — query by text content
    // (assertion lenient: check at least label present in document)
    const labelElements = await screen.findAllByText('Rebalancing')
    // Two appearances: trigger text + popover label
    expect(labelElements.length).toBeGreaterThanOrEqual(2)
    // Definition snippet present
    expect(screen.getByText(/jual yang naik tinggi/i)).toBeDefined()
  })
})
