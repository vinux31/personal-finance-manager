import * as React from 'react'
import { useEffect, useMemo, useRef } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { MODUL_CONTENT, type ModulSlug, type ModulData } from '@/data/modulContent'
import { isGlossaryTerm } from '@/data/glossary'
import { GlossaryTooltip } from '@/components/GlossaryTooltip'
import { cn } from '@/lib/utils'

/**
 * Renders a single modul edukasi page from MODUL_CONTENT[slug].
 *
 * Architecture:
 * - useParams gives slug → lookup MODUL_CONTENT
 * - Body strings contain inline HTML (<em>, <strong>, <p class="pull">) + [[term]]X[[/term]] glossary markers
 * - parseProse() splits string into React.ReactNode[] alternating plain HTML chunks (dangerouslySetInnerHTML)
 *   with GlossaryTooltip components — type-safe, no DOM walking, no portal hacks
 * - Trusted source: MODUL_CONTENT is hardcoded in repo (not user input) — dangerouslySetInnerHTML safe
 *   per 15-CONTEXT.md threat model T-15-02
 */

const MODUL_SLUG_KEYS = Object.keys(MODUL_CONTENT) as ModulSlug[]

function isModulSlug(s: string): s is ModulSlug {
  return (MODUL_SLUG_KEYS as string[]).includes(s)
}

/**
 * Splits a body HTML string into React nodes, replacing [[term]]X[[/term]] markers
 * with <GlossaryTooltip term="term">X</GlossaryTooltip> while preserving inline HTML
 * (<em>, <strong>) chunks via dangerouslySetInnerHTML.
 *
 * Returns array of React nodes ready to render in <Fragment>.
 */
function parseProse(html: string, keyPrefix: string): React.ReactNode[] {
  const MARKER_RE = /\[\[([a-z-]+)\]\]([\s\S]*?)\[\[\/\1\]\]/g
  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let i = 0

  while ((match = MARKER_RE.exec(html)) !== null) {
    const [fullMatch, term, inner] = match
    const before = html.slice(lastIndex, match.index)
    if (before) {
      nodes.push(
        <span
          key={`${keyPrefix}-html-${i++}`}
          dangerouslySetInnerHTML={{ __html: before }}
        />,
      )
    }
    // GlossaryTooltip handles unknown terms via isGlossaryTerm gracefully — but pre-validate for nicer DOM.
    if (isGlossaryTerm(term)) {
      nodes.push(
        <GlossaryTooltip key={`${keyPrefix}-tt-${i++}`} term={term}>
          <span dangerouslySetInnerHTML={{ __html: inner }} />
        </GlossaryTooltip>,
      )
    } else {
      // Sentinel/unknown term — render inner as plain HTML
      nodes.push(
        <span
          key={`${keyPrefix}-tt-fallback-${i++}`}
          dangerouslySetInnerHTML={{ __html: inner }}
        />,
      )
    }
    lastIndex = match.index + fullMatch.length
  }

  // Trailing chunk after last marker
  const tail = html.slice(lastIndex)
  if (tail) {
    nodes.push(
      <span
        key={`${keyPrefix}-html-${i++}`}
        dangerouslySetInnerHTML={{ __html: tail }}
      />,
    )
  }

  return nodes
}

function TheorySection({ data, slug }: { data: ModulData; slug: string }) {
  const { theory } = data
  return (
    <section className="mt-12">
      <h2 className="text-3xl font-semibold leading-snug font-serif mb-4">{theory.head}</h2>
      <div className="text-lg leading-relaxed font-serif space-y-4 [&_p.pull]:italic [&_p.pull]:border-l-4 [&_p.pull]:border-muted [&_p.pull]:pl-6 [&_p.pull]:my-8 [&_em]:italic [&_strong]:font-semibold">
        {parseProse(theory.body, `${slug}-theory-body`)}
      </div>
      {theory.list && theory.list.length > 0 ? (
        <ul className="mt-6 list-disc space-y-3 pl-6 text-lg font-serif leading-relaxed [&_em]:italic [&_strong]:font-semibold">
          {theory.list.map((item, idx) => (
            <li key={idx}>{parseProse(item, `${slug}-theory-list-${idx}`)}</li>
          ))}
        </ul>
      ) : null}
      {theory.body2 ? (
        <div className="mt-6 text-lg leading-relaxed font-serif space-y-4 [&_p.pull]:italic [&_p.pull]:border-l-4 [&_p.pull]:border-muted [&_p.pull]:pl-6 [&_p.pull]:my-8 [&_em]:italic [&_strong]:font-semibold">
          {parseProse(theory.body2, `${slug}-theory-body2`)}
        </div>
      ) : null}
    </section>
  )
}

function PracticeSection({ data, slug }: { data: ModulData; slug: string }) {
  const { practice } = data
  return (
    <section className="mt-12">
      <h2 className="text-3xl font-semibold leading-snug font-serif mb-4">{practice.head}</h2>
      <div className="border-l-4 border-brand pl-6 py-2">
        <div className="text-xs uppercase tracking-wide text-muted-foreground font-sans font-semibold mb-2">
          {practice.case.tag}
        </div>
        <h3 className="text-lg font-semibold leading-snug font-serif mb-3">
          {practice.case.title}
        </h3>
        <div className="text-lg leading-relaxed font-serif space-y-4 [&_em]:italic [&_strong]:font-semibold">
          {parseProse(practice.case.body, `${slug}-practice-body`)}
        </div>
      </div>
    </section>
  )
}

function CheckSection({ data }: { data: ModulData }) {
  // D-04: prose-only, no input field, no state, no answer-correctness UI.
  // Render question + options as numbered list + collapsed feedback for self-reflection.
  const { check } = data
  return (
    <section className="mt-12">
      <h2 className="text-3xl font-semibold leading-snug font-serif mb-3">Cek Pemahaman</h2>
      <p className="text-base text-muted-foreground font-sans mb-4">
        Coba jawab pertanyaan ini sebelum lanjut ke modul berikutnya:
      </p>
      <p className="text-lg font-serif font-semibold leading-relaxed mb-3">{check.q}</p>
      <ol className="list-decimal pl-6 space-y-2 text-lg font-serif leading-relaxed">
        {check.opts.map((opt, idx) => (
          <li key={idx}>{opt.t}</li>
        ))}
      </ol>
      <details className="mt-6 rounded-md border bg-muted/30 px-4 py-3 font-sans text-sm">
        <summary className="cursor-pointer font-semibold">Lihat pembahasan</summary>
        <p className="mt-2 leading-relaxed text-muted-foreground">{check.feedback}</p>
      </details>
    </section>
  )
}

export default function ModulRenderer() {
  const { slug = '' } = useParams<{ slug: string }>()
  const headingRef = useRef<HTMLHeadingElement>(null)

  // a11y: focus H1 on slug change so screen readers announce new modul without requiring user to tab back to top
  // (tabIndex={-1} on H1 below makes it programmatically focusable but skipped in tab order)
  useEffect(() => {
    headingRef.current?.focus()
  }, [slug])

  const data = useMemo<ModulData | null>(() => {
    if (!isModulSlug(slug)) return null
    return MODUL_CONTENT[slug]
  }, [slug])

  if (!data) {
    return <Navigate to="/kesehatan" replace />
  }

  return (
    <article className={cn("max-w-[65ch] mx-auto px-4 py-8 pb-16")}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground font-sans font-semibold mb-3">
        <span>{data.stage}</span>
        <span className="mx-2 text-border">/</span>
        <span>Modul {data.n}</span>
        <span className="mx-2 text-border">/</span>
        <span>{data.time}</span>
      </div>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-4xl font-semibold leading-tight font-serif outline-none [&_em]:italic"
        dangerouslySetInnerHTML={{ __html: data.title }}
      />
      <p className="mt-4 text-lg leading-relaxed font-serif italic text-muted-foreground">
        {data.desc}
      </p>

      <TheorySection data={data} slug={slug} />
      <PracticeSection data={data} slug={slug} />
      <CheckSection data={data} />
    </article>
  )
}
