import { useEffect, useMemo, useRef } from 'react'
import { ArrowLeft, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePanduanStore } from '@/lib/panduanStore'
import { useTabStore } from '@/lib/tabStore'
import { PANDUAN_TOPICS, type PanduanTopic } from '@/content/panduan'

const FITUR_TOPICS = PANDUAN_TOPICS.filter((t) => t.category === 'fitur')
const SKENARIO_TOPICS = PANDUAN_TOPICS.filter((t) => t.category === 'skenario')

function resolveActive(slug: string | null): PanduanTopic {
  if (slug) {
    const found = PANDUAN_TOPICS.find((t) => t.slug === slug)
    if (found) return found
  }
  return PANDUAN_TOPICS[0]
}

export default function PanduanFullPage() {
  const { activeSlug, setActiveSlug, close } = usePanduanStore()
  const { setActiveTab } = useTabStore()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const active = useMemo(() => resolveActive(activeSlug), [activeSlug])

  function handleBack() {
    close()
    setActiveTab('settings')
  }

  function handleSelectSlug(slug: string) {
    setActiveSlug(slug)
    contentRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }

  useEffect(() => {
    headingRef.current?.focus()
  }, [active.slug])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleBack()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background px-4 py-3 sm:px-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          aria-label="Kembali ke Pengaturan"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Pengaturan
        </Button>
        <h1 className="text-base font-bold sm:text-lg">Panduan Penggunaan</h1>
      </div>

      {/* Mobile: Select dropdown */}
      <div className="border-b border-border px-4 py-3 md:hidden">
        <Select value={active.slug} onValueChange={handleSelectSlug}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Per-Fitur</SelectLabel>
              {FITUR_TOPICS.map((t) => (
                <SelectItem key={t.slug} value={t.slug}>
                  {t.title}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Skenario</SelectLabel>
              {SKENARIO_TOPICS.map((t) => (
                <SelectItem key={t.slug} value={t.slug}>
                  {t.title}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-[57px] hidden h-[calc(100vh-57px)] w-60 shrink-0 overflow-y-auto border-r border-border px-3 py-4 md:block">
          <SidebarGroup
            label="Per-Fitur"
            topics={FITUR_TOPICS}
            activeSlug={active.slug}
            onSelect={handleSelectSlug}
          />
          <div className="h-4" />
          <SidebarGroup
            label="Skenario"
            topics={SKENARIO_TOPICS}
            activeSlug={active.slug}
            onSelect={handleSelectSlug}
          />
        </aside>

        {/* Konten */}
        <div ref={contentRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
          <article className="mx-auto max-w-3xl">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="text-2xl font-bold outline-none"
            >
              {active.title}
            </h2>
            <p className="mt-2 text-base text-muted-foreground">{active.summary}</p>

            <div className="mt-8 space-y-10">
              {active.sections.map((section, idx) => (
                <section key={idx}>
                  <h3 className="text-lg font-semibold">{section.heading}</h3>
                  {section.intro && (
                    <p className="mt-2 text-sm text-muted-foreground">{section.intro}</p>
                  )}
                  <ol className="mt-4 list-decimal space-y-3 pl-6 text-sm">
                    {section.steps.map((step) => (
                      <li key={step.number}>
                        <span>{step.text}</span>
                        {step.detail && (
                          <span className="mt-1 block text-muted-foreground">
                            {step.detail}
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                  {section.tip && (
                    <div className="mt-4 flex gap-2 rounded-lg bg-muted p-3 text-sm">
                      <Lightbulb className="h-4 w-4 shrink-0 text-[var(--brand)]" />
                      <span>{section.tip}</span>
                    </div>
                  )}
                </section>
              ))}
            </div>
          </article>
        </div>
      </div>
    </div>
  )
}

function SidebarGroup({
  label,
  topics,
  activeSlug,
  onSelect,
}: {
  label: string
  topics: PanduanTopic[]
  activeSlug: string
  onSelect: (slug: string) => void
}) {
  return (
    <div>
      <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <ul className="space-y-0.5">
        {topics.map((t) => {
          const isActive = t.slug === activeSlug
          return (
            <li key={t.slug}>
              <button
                onClick={() => onSelect(t.slug)}
                aria-current={isActive ? 'page' : undefined}
                className={`block w-full rounded-md border-l-2 px-3 py-1.5 text-left text-sm transition-colors ${
                  isActive
                    ? 'border-[var(--brand)] bg-accent text-foreground'
                    : 'border-transparent text-muted-foreground hover:bg-accent/50'
                }`}
              >
                {t.title}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
