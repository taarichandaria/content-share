"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createPost, createProgressPost } from "@/lib/queries/posts";
import { startRead, type CurrentRead } from "@/lib/queries/reads";
import type { ContentType, NewContentItem } from "@/lib/types/models";
import type { UnfurlResult } from "@/lib/unfurl";
import type { BookSuggestion } from "@/lib/books";
import { Avatar } from "@/components/Avatar";
import { Button, ErrorNote, Field, Input, Spinner, Textarea, cn } from "@/components/ui";
import type { AuthorSummary } from "@/lib/types/models";

const TYPES: Array<{ value: ContentType; label: string }> = [
  { value: "article", label: "Article" },
  { value: "blog", label: "Blog" },
  { value: "podcast", label: "Podcast" },
  { value: "video", label: "Video" },
  { value: "tweet", label: "Post" },
  { value: "book", label: "Book" },
  { value: "paper", label: "Paper" },
  { value: "other", label: "Other" },
];

const URL_RE = /^https?:\/\/\S+\.\S+/;

function CoverThumb({
  title,
  imageUrl,
  className,
}: {
  title: string;
  imageUrl: string | null;
  className?: string;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        className={cn("h-12 w-8 shrink-0 rounded border border-line object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-12 w-8 shrink-0 items-center justify-center rounded border border-line bg-paper-deep font-medium text-ink-faint",
        className
      )}
    >
      {title.slice(0, 1)}
    </span>
  );
}

function ProgressBadge({ progress }: { progress: string | null }) {
  if (!progress) return null;
  return (
    <span className="smallcaps shrink-0 rounded-full border border-gold/40 bg-gold-soft px-2 py-0.5 text-ink-soft">
      {progress}
    </span>
  );
}

export function Composer({
  profile,
  currentReads = [],
}: {
  profile: AuthorSummary;
  currentReads?: CurrentRead[];
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [type, setType] = useState<ContentType>("article");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [siteName, setSiteName] = useState<string | null>(null);
  const [creator, setCreator] = useState("");
  const [body, setBody] = useState("");
  const [startAsRead, setStartAsRead] = useState(true);
  const [progress, setProgress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const coverAbortRef = useRef<AbortController | null>(null);

  // Book autocomplete + continue-a-read state.
  const [suggestions, setSuggestions] = useState<BookSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [continuing, setContinuing] = useState<CurrentRead | null>(null);
  const bookAbortRef = useRef<AbortController | null>(null);
  const skipSearchRef = useRef(false);

  // Debounced unfurl whenever the url becomes a plausible link.
  useEffect(() => {
    if (!URL_RE.test(url)) return;
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setFetching(true);
      try {
        const res = await fetch("/api/unfurl", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url }),
          signal: controller.signal,
        });
        const data: UnfurlResult = await res.json();
        if (controller.signal.aborted) return;
        setFetched(true);
        setType(data.suggestedType);
        if (data.ok) {
          skipSearchRef.current = true;
          setTitle(data.title ?? "");
          setDescription(data.description ?? null);
          setImageUrl(data.imageUrl ?? null);
          setSiteName(data.siteName ?? null);
          if (data.creator) setCreator(data.creator);
        } else if (data.imageUrl) {
          // e.g. a YouTube video whose oEmbed lookup failed: the metadata is
          // unknown but the id-derived thumbnail still works.
          setImageUrl(data.imageUrl);
        }
      } catch {
        if (!controller.signal.aborted) setFetched(true);
      } finally {
        if (!controller.signal.aborted) setFetching(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [url]);

  // Manually entered books (no link pasted) get a cover from Open Library,
  // keyed off whatever title/author the user has typed so far.
  useEffect(() => {
    if (type !== "book" || continuing || URL_RE.test(url) || title.trim().length < 2)
      return;
    const timer = setTimeout(async () => {
      coverAbortRef.current?.abort();
      const controller = new AbortController();
      coverAbortRef.current = controller;
      try {
        const res = await fetch("/api/book-cover", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            author: creator.trim() || null,
          }),
          signal: controller.signal,
        });
        const data: { imageUrl: string | null } = await res.json();
        if (!controller.signal.aborted) setImageUrl(data.imageUrl);
      } catch {
        // Keep whatever preview we already had.
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [type, title, creator, url, continuing]);

  // Debounced book search against /api/books while typing a book title.
  useEffect(() => {
    if (type !== "book" || continuing) return;
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }
    const q = title.trim();
    if (q.length < 2) return;
    const timer = setTimeout(async () => {
      bookAbortRef.current?.abort();
      const controller = new AbortController();
      bookAbortRef.current = controller;
      setSearching(true);
      try {
        const res = await fetch(`/api/books?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data: { books: BookSuggestion[] } = await res.json();
        if (controller.signal.aborted) return;
        setSuggestions(data.books);
      } catch {
        // ignore — manual entry still works
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [title, type, continuing]);

  const bookQuery = title.trim().toLowerCase();
  const matchingReads =
    type === "book" && !continuing && bookQuery.length >= 2
      ? currentReads.filter(
          (r) =>
            r.content_item.title.toLowerCase().includes(bookQuery) ||
            (r.content_item.creator ?? "").toLowerCase().includes(bookQuery)
        )
      : [];
  const optionCount = matchingReads.length + suggestions.length;
  const dropdownVisible =
    type === "book" &&
    !continuing &&
    suggestionsOpen &&
    bookQuery.length >= 2 &&
    optionCount > 0;

  function pickSuggestion(s: BookSuggestion) {
    skipSearchRef.current = true;
    bookAbortRef.current?.abort();
    setTitle(s.title);
    setCreator(s.author ?? "");
    if (s.coverUrl) setImageUrl(s.coverUrl);
    setSuggestions([]);
    setSuggestionsOpen(false);
    setHighlight(-1);
  }

  function continueRead(read: CurrentRead) {
    bookAbortRef.current?.abort();
    setContinuing(read);
    setProgress(read.latest_progress ?? "");
    setSuggestions([]);
    setSuggestionsOpen(false);
    setHighlight(-1);
    setError(null);
  }

  function stopContinuing() {
    setContinuing(null);
    setProgress("");
  }

  function onTitleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!dropdownVisible) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % optionCount);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? optionCount - 1 : h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlight < 0) {
        setSuggestionsOpen(false);
      } else if (highlight < matchingReads.length) {
        continueRead(matchingReads[highlight]);
      } else {
        pickSuggestion(suggestions[highlight - matchingReads.length]);
      }
    } else if (e.key === "Escape") {
      setSuggestionsOpen(false);
    }
  }

  function reset() {
    // Don't let in-flight lookups repopulate the cleared form.
    abortRef.current?.abort();
    coverAbortRef.current?.abort();
    setExpanded(false);
    setUrl("");
    setFetched(false);
    setType("article");
    setTitle("");
    setDescription(null);
    setImageUrl(null);
    setSiteName(null);
    setCreator("");
    setBody("");
    setProgress("");
    setStartAsRead(true);
    setBusy(false);
    setError(null);
    setSuggestions([]);
    setSuggestionsOpen(false);
    setHighlight(-1);
    setContinuing(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || (!continuing && !title.trim())) {
      setError(
        continuing
          ? "Say something about where you are."
          : "Give it a title and say something about it."
      );
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    try {
      if (continuing) {
        await createProgressPost(supabase, {
          authorId: profile.id,
          readId: continuing.id,
          contentItemId: continuing.content_item_id,
          body: body.trim(),
          progress: progress.trim() || null,
        });
      } else if (type === "book" && startAsRead) {
        const { readId, contentItemId } = await startRead(supabase, {
          userId: profile.id,
          book: {
            title: title.trim(),
            creator: creator.trim() || null,
            url: url.trim() || null,
            image_url: imageUrl,
            description,
          },
        });
        await createProgressPost(supabase, {
          authorId: profile.id,
          readId,
          contentItemId,
          body: body.trim(),
          progress: progress.trim() || null,
        });
      } else {
        const item: NewContentItem = {
          type,
          url: url.trim() || null,
          title: title.trim(),
          description,
          image_url: imageUrl,
          site_name: siteName,
          creator: creator.trim() || null,
        };
        await createPost(supabase, {
          authorId: profile.id,
          body: body.trim(),
          contentItem: item,
        });
      }
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex w-full items-center gap-3 rounded-xl border border-line bg-card px-4 py-3.5 text-left text-ink-faint hover:border-ink-faint transition-colors cursor-pointer"
      >
        <Avatar username={profile.username} avatarUrl={profile.avatar_url} size="sm" />
        <span className="commentary italic">
          Share something you&rsquo;ve been into&hellip;
        </span>
      </button>
    );
  }

  const showManualFields = fetched || !URL_RE.test(url);

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-line bg-card p-4 sm:p-5 space-y-4 shadow-[3px_3px_0_var(--color-paper-deep)]"
    >
      <div className="flex items-center justify-between">
        <span className="smallcaps text-ink-soft">
          {continuing ? "Reading update" : "New entry"}
        </span>
        <button
          type="button"
          onClick={reset}
          className="text-ink-faint hover:text-ink text-sm cursor-pointer"
        >
          Close
        </button>
      </div>

      <ErrorNote>{error}</ErrorNote>

      {continuing ? (
        <>
          <div className="rounded-lg bg-gold-soft/60 border border-gold/30 p-3">
            <div className="flex items-center gap-3">
              <CoverThumb
                title={continuing.content_item.title}
                imageUrl={continuing.content_item.image_url}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">
                  {continuing.content_item.title}
                </p>
                {continuing.content_item.creator && (
                  <p className="truncate text-sm text-ink-soft">
                    {continuing.content_item.creator}
                  </p>
                )}
              </div>
              <ProgressBadge progress={continuing.latest_progress} />
              <button
                type="button"
                onClick={stopContinuing}
                className="text-sm text-ink-faint hover:text-ink cursor-pointer"
                aria-label="Choose something else"
              >
                &#10005;
              </button>
            </div>
          </div>

          <Field label="Where are you now?">
            <Input
              value={progress}
              onChange={(e) => setProgress(e.target.value)}
              placeholder="p. 120 / ch. 5 (optional)"
              maxLength={100}
            />
          </Field>
        </>
      ) : (
        <div className="relative">
          <Input
            placeholder="Paste a link (or skip this for books & anything else)"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setFetched(false);
            }}
            inputMode="url"
          />
          {fetching && (
            <Spinner className="absolute right-3 top-1/2 -translate-y-1/2" />
          )}
        </div>
      )}

      {!continuing && showManualFields && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={cn(
                  "smallcaps rounded-full border px-3 py-1 transition-colors cursor-pointer",
                  type === t.value
                    ? "border-accent bg-accent text-paper"
                    : "border-line text-ink-soft hover:border-ink-faint"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {type === "book" && currentReads.length > 0 && (
            <div className="rounded-lg bg-gold-soft/40 border border-gold/30 p-3 space-y-2">
              <span className="smallcaps text-ink-soft">
                On the nightstand — tap to add an update
              </span>
              <div className="space-y-1">
                {currentReads.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => continueRead(r)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-gold-soft transition-colors cursor-pointer"
                  >
                    <CoverThumb
                      title={r.content_item.title}
                      imageUrl={r.content_item.image_url}
                      className="h-10 w-7 text-xs"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {r.content_item.title}
                      </span>
                      {r.content_item.creator && (
                        <span className="block truncate text-xs text-ink-soft">
                          {r.content_item.creator}
                        </span>
                      )}
                    </span>
                    <ProgressBadge progress={r.latest_progress} />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <div className="flex-1 space-y-3">
              <Field label="Title">
                <div className="relative">
                  <Input
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (type === "book") {
                        setSuggestionsOpen(true);
                        setHighlight(-1);
                        if (e.target.value.trim().length < 2) setSuggestions([]);
                      }
                    }}
                    onKeyDown={onTitleKeyDown}
                    onBlur={() => setSuggestionsOpen(false)}
                    placeholder={
                      type === "book" ? "Search for a book…" : "What is it called?"
                    }
                    role={type === "book" ? "combobox" : undefined}
                    aria-expanded={type === "book" ? dropdownVisible : undefined}
                    aria-autocomplete={type === "book" ? "list" : undefined}
                  />
                  {searching && (
                    <Spinner className="absolute right-3 top-1/2 -translate-y-1/2" />
                  )}
                  {dropdownVisible && (
                    <ul
                      role="listbox"
                      className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-line bg-card shadow-[3px_3px_0_var(--color-paper-deep)]"
                    >
                      {matchingReads.map((r, i) => (
                        <li key={r.id} role="option" aria-selected={highlight === i}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => continueRead(r)}
                            className={cn(
                              "flex w-full items-center gap-3 border-l-2 border-gold bg-gold-soft/40 px-3 py-2 text-left hover:bg-gold-soft transition-colors cursor-pointer",
                              highlight === i && "bg-gold-soft"
                            )}
                          >
                            <CoverThumb
                              title={r.content_item.title}
                              imageUrl={r.content_item.image_url}
                              className="h-10 w-7 text-xs"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-ink">
                                {r.content_item.title}
                              </span>
                              <span className="smallcaps block text-gold">
                                Currently reading
                                {r.latest_progress ? ` · ${r.latest_progress}` : ""}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                      {suggestions.map((s, i) => {
                        const idx = matchingReads.length + i;
                        return (
                          <li
                            key={`${s.title}-${s.url ?? i}`}
                            role="option"
                            aria-selected={highlight === idx}
                          >
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => pickSuggestion(s)}
                              className={cn(
                                "flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-paper-deep transition-colors cursor-pointer",
                                highlight === idx && "bg-paper-deep"
                              )}
                            >
                              <CoverThumb
                                title={s.title}
                                imageUrl={s.coverUrl}
                                className="h-10 w-7 text-xs"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-ink">
                                  {s.title}
                                </span>
                                <span className="block truncate text-xs text-ink-soft">
                                  {s.author ?? "Unknown author"}
                                  {s.year ? ` · ${s.year}` : ""}
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </Field>
              {(type === "book" || type === "podcast") && (
                <Field label={type === "book" ? "Author" : "Show / host"}>
                  <Input
                    value={creator}
                    onChange={(e) => setCreator(e.target.value)}
                    placeholder="Optional"
                  />
                </Field>
              )}
            </div>
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt=""
                className="size-24 rounded-lg object-cover border border-line"
              />
            )}
          </div>

          {type === "book" && (
            <div className="rounded-lg bg-gold-soft/60 border border-gold/30 p-3 space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={startAsRead}
                  onChange={(e) => setStartAsRead(e.target.checked)}
                  className="size-4 accent-(--color-gold)"
                />
                <span className="text-sm text-ink">
                  Start as an ongoing read — post updates as you go
                </span>
              </label>
              {startAsRead && (
                <Input
                  value={progress}
                  onChange={(e) => setProgress(e.target.value)}
                  placeholder="Where are you? e.g. p. 12, ch. 2 (optional)"
                  className="bg-card"
                />
              )}
            </div>
          )}
        </>
      )}

      {(continuing || showManualFields) && (
        <>
          <Field label="Your thoughts">
            <Textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                continuing
                  ? "How is it going so far?"
                  : "Why should your friends care?"
              }
              maxLength={5000}
            />
          </Field>

          <div className="flex justify-end">
            <Button type="submit" disabled={busy}>
              {busy ? (
                <Spinner className="border-paper border-t-transparent" />
              ) : continuing ? (
                "Post update"
              ) : type === "book" && startAsRead ? (
                "Start reading"
              ) : (
                "Share it"
              )}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
