"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useId, useState } from "react"
import { TUTORIAL_TOPICS, type TutorialTopic } from "@/lib/tutorial-content"
import { cn } from "@/lib/utils"

function resolveTopicId(topicParam: string | null, hash: string): string {
  const fromQuery = topicParam?.trim()
  if (fromQuery && TUTORIAL_TOPICS.some((t) => t.id === fromQuery)) {
    return fromQuery
  }
  const fromHash = hash.replace(/^#/, "").trim()
  if (fromHash && TUTORIAL_TOPICS.some((t) => t.id === fromHash)) {
    return fromHash
  }
  return TUTORIAL_TOPICS[0]?.id ?? "overview"
}

function TopicBody({ topic }: { topic: TutorialTopic }) {
  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#000D26] sm:text-3xl">
          {topic.title}
        </h1>
        <p className="text-base text-muted-foreground">{topic.summary}</p>
      </header>

      <div className="space-y-3 text-[0.95rem] leading-relaxed text-[#000D26]/90">
        {topic.paragraphs.map((paragraph) => (
          <p key={paragraph.slice(0, 48)}>{paragraph}</p>
        ))}
      </div>

      {topic.steps && topic.steps.length > 0 ? (
        <ol className="list-decimal space-y-2 pl-5 text-[0.95rem] leading-relaxed text-[#000D26]/90">
          {topic.steps.map((step) => (
            <li key={step.slice(0, 64)}>{step}</li>
          ))}
        </ol>
      ) : null}

      {topic.callouts?.map((callout) => (
        <aside
          key={callout.title}
          className="border-l-4 border-[#CE1126] bg-[#A1C6E7]/25 px-4 py-3"
        >
          <p className="text-sm font-bold text-[#000D26]">{callout.title}</p>
          <p className="mt-1 text-sm text-[#000D26]/90">{callout.body}</p>
        </aside>
      ))}

      {topic.links && topic.links.length > 0 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold">
          {topic.links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-[#CE1126] underline-offset-4 hover:underline"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {topic.images && topic.images.length > 0 ? (
        <div className="space-y-6 pt-2">
          {topic.images.map((image) => (
            <figure key={image.src} className="space-y-2">
              <div className="overflow-hidden border border-[#000D26]/15 bg-white">
                <Image
                  src={image.src}
                  alt={image.alt}
                  width={960}
                  height={540}
                  className="h-auto w-full"
                />
              </div>
              <figcaption className="text-sm text-muted-foreground">
                {image.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}
    </article>
  )
}

export function TutorialGuide() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selectId = useId()
  const [activeId, setActiveId] = useState(TUTORIAL_TOPICS[0]?.id ?? "overview")

  useEffect(() => {
    const nextId = resolveTopicId(searchParams.get("topic"), window.location.hash)
    setActiveId(nextId)
  }, [searchParams])

  useEffect(() => {
    function onHashChange() {
      setActiveId(resolveTopicId(searchParams.get("topic"), window.location.hash))
    }
    window.addEventListener("hashchange", onHashChange)
    return () => window.removeEventListener("hashchange", onHashChange)
  }, [searchParams])

  const activeTopic =
    TUTORIAL_TOPICS.find((topic) => topic.id === activeId) ?? TUTORIAL_TOPICS[0]

  function selectTopic(id: string) {
    setActiveId(id)
    const params = new URLSearchParams(searchParams.toString())
    params.set("topic", id)
    router.replace(`${pathname}?${params.toString()}#${id}`, { scroll: false })
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 lg:flex-row lg:items-start lg:gap-10">
      <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-56">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#000D26]/60">
          Tutorial topics
        </p>

        <label className="mb-3 block lg:hidden" htmlFor={selectId}>
          <span className="sr-only">Choose a tutorial topic</span>
          <select
            id={selectId}
            className="w-full border border-[#000D26]/20 bg-white px-3 py-2 text-sm font-semibold text-[#000D26]"
            value={activeTopic?.id}
            onChange={(event) => selectTopic(event.target.value)}
          >
            {TUTORIAL_TOPICS.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.title}
              </option>
            ))}
          </select>
        </label>

        <nav aria-label="Tutorial topics" className="hidden lg:block">
          <ul className="space-y-1 border-l border-[#000D26]/15">
            {TUTORIAL_TOPICS.map((topic) => {
              const current = topic.id === activeTopic?.id
              return (
                <li key={topic.id}>
                  <button
                    type="button"
                    onClick={() => selectTopic(topic.id)}
                    aria-current={current ? "true" : undefined}
                    className={cn(
                      "block w-full border-l-2 py-1.5 pl-3 text-left text-sm transition-colors",
                      current
                        ? "border-[#CE1126] font-bold text-[#000D26]"
                        : "border-transparent text-[#000D26]/75 hover:text-[#000D26]",
                    )}
                  >
                    {topic.title}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>

      <div className="min-w-0 flex-1 rounded-none border border-[#000D26]/10 bg-white p-5 sm:p-8">
        {activeTopic ? <TopicBody topic={activeTopic} /> : null}
      </div>
    </div>
  )
}
