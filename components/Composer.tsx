"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createPost, createProgressPost } from "@/lib/queries/posts";
import { startRead } from "@/lib/queries/reads";
import type { ContentType, NewContentItem } from "@/lib/types/models";
import type { UnfurlResult } from "@/lib/unfurl";
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
  { value: "movie", label: "Film" },
  { value: "recipe", label: "Recipe" },
  { value: "other", label: "Other" },
];

const URL_RE = /^https?:\/\/\S+\.\S+/;

export function Composer({ profile }: { profile: AuthorSummary }) {
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
          setTitle(data.title ?? "");
          setDescription(data.description ?? null);
          setImageUrl(data.imageUrl ?? null);
          setSiteName(data.siteName ?? null);
        }
      } catch {
        if (!controller.signal.aborted) setFetched(true);
      } finally {
        if (!controller.signal.aborted) setFetching(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [url]);

  function reset() {
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
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError("Give it a title and say something about it.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    try {
      if (type === "book" && startAsRead) {
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
        <span className="smallcaps text-ink-soft">New entry</span>
        <button
          type="button"
          onClick={reset}
          className="text-ink-faint hover:text-ink text-sm cursor-pointer"
        >
          Close
        </button>
      </div>

      <ErrorNote>{error}</ErrorNote>

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

      {showManualFields && (
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

          <div className="flex gap-3">
            <div className="flex-1 space-y-3">
              <Field label="Title">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={type === "book" ? "Book title" : "What is it called?"}
                />
              </Field>
              {(type === "book" || type === "podcast" || type === "movie") && (
                <Field
                  label={type === "book" ? "Author" : type === "movie" ? "Director" : "Show / host"}
                >
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

          <Field label="Your thoughts">
            <Textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Why should your friends care?"
              maxLength={5000}
            />
          </Field>

          <div className="flex justify-end">
            <Button type="submit" disabled={busy}>
              {busy ? (
                <Spinner className="border-paper border-t-transparent" />
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
