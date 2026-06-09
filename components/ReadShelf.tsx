"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { createProgressPost } from "@/lib/queries/posts";
import { setReadStatus } from "@/lib/queries/reads";
import type { ReadWithItem } from "@/lib/types/models";
import { Button, Input, Spinner, Textarea, cn } from "@/components/ui";

const SPINE_HUES = [
  "bg-accent text-paper",
  "bg-moss text-paper",
  "bg-gold text-paper",
  "bg-sky text-paper",
  "bg-ink text-paper",
];

function spineHue(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return SPINE_HUES[h % SPINE_HUES.length];
}

function Cover({ read }: { read: ReadWithItem }) {
  if (read.content_item.image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={read.content_item.image_url}
        alt=""
        className="h-28 w-20 shrink-0 rounded-md object-cover border border-line shadow-[3px_3px_0_var(--color-paper-deep)]"
      />
    );
  }
  return (
    <div
      aria-hidden
      className={cn(
        "h-28 w-20 shrink-0 rounded-md border-l-6 border-black/15 flex items-center justify-center px-1.5 shadow-[3px_3px_0_var(--color-paper-deep)]",
        spineHue(read.content_item.title)
      )}
    >
      <span className="font-display text-[11px] font-semibold leading-tight text-center line-clamp-4">
        {read.content_item.title}
      </span>
    </div>
  );
}

function BookRow({ read, userId }: { read: ReadWithItem; userId: string }) {
  const router = useRouter();
  const [panel, setPanel] = useState<"none" | "update" | "finish">("none");
  const [body, setBody] = useState("");
  const [progress, setProgress] = useState("");
  const [busy, setBusy] = useState(false);

  async function postUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      await createProgressPost(createClient(), {
        authorId: userId,
        readId: read.id,
        contentItemId: read.content_item_id,
        body: body.trim(),
        progress: progress.trim() || null,
      });
      setBody("");
      setProgress("");
      setPanel("none");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function finish(status: "finished" | "abandoned") {
    setBusy(true);
    try {
      await setReadStatus(createClient(), read.id, status);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-xl border border-line bg-card p-4">
      <div className="flex gap-4">
        <Cover read={read} />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-semibold leading-snug">
            {read.content_item.title}
          </h3>
          {read.content_item.creator && (
            <p className="text-sm text-ink-soft mt-0.5">
              {read.content_item.creator}
            </p>
          )}
          <p className="smallcaps text-ink-faint mt-1.5">
            Since {format(new Date(read.started_at), "d MMM yyyy")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={panel === "update" ? "primary" : "secondary"}
              onClick={() => setPanel(panel === "update" ? "none" : "update")}
            >
              Post update
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPanel(panel === "finish" ? "none" : "finish")}
            >
              Wrap up
            </Button>
          </div>
        </div>
      </div>

      {panel === "update" && (
        <form onSubmit={postUpdate} className="mt-4 space-y-2.5 border-t border-line pt-4">
          <Textarea
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What's striking you so far?"
            autoFocus
          />
          <div className="flex gap-2.5">
            <Input
              value={progress}
              onChange={(e) => setProgress(e.target.value)}
              placeholder="p. 120 / ch. 5 (optional)"
              className="max-w-44"
            />
            <Button type="submit" size="sm" disabled={busy || !body.trim()} className="ml-auto">
              {busy ? <Spinner className="border-paper border-t-transparent" /> : "Post"}
            </Button>
          </div>
        </form>
      )}

      {panel === "finish" && (
        <div className="mt-4 border-t border-line pt-4 flex flex-wrap items-center gap-2.5">
          <span className="text-sm text-ink-soft mr-auto">
            How did it end between you two?
          </span>
          <Button size="sm" disabled={busy} onClick={() => finish("finished")}>
            Finished it
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={busy}
            onClick={() => finish("abandoned")}
          >
            Letting it go
          </Button>
        </div>
      )}
    </li>
  );
}

export function ReadShelf({
  current,
  past,
  userId,
}: {
  current: ReadWithItem[];
  past: ReadWithItem[];
  userId: string;
}) {
  return (
    <div className="space-y-10">
      <section>
        <h2 className="smallcaps text-ink-soft mb-3">On the nightstand</h2>
        {current.length === 0 ? (
          <p className="commentary italic text-ink-soft py-6 text-center">
            Nothing in progress. Start a book from the composer on your feed —
            pick the &ldquo;Book&rdquo; type.
          </p>
        ) : (
          <ul className="space-y-4">
            {current.map((r) => (
              <BookRow key={r.id} read={r} userId={userId} />
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="smallcaps text-ink-soft mb-3">The record</h2>
          <ul className="divide-y divide-line/60">
            {past.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-3">
                <span
                  className={cn(
                    "smallcaps shrink-0 rounded-full px-2.5 py-1 border",
                    r.status === "finished"
                      ? "bg-moss-soft text-moss border-moss/30"
                      : "bg-paper-deep text-ink-faint border-line"
                  )}
                >
                  {r.status === "finished" ? "Finished" : "Set aside"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold truncate">
                    {r.content_item.title}
                  </p>
                  {r.content_item.creator && (
                    <p className="text-xs text-ink-faint truncate">
                      {r.content_item.creator}
                    </p>
                  )}
                </div>
                {r.finished_at && (
                  <span className="text-xs text-ink-faint shrink-0">
                    {format(new Date(r.finished_at), "MMM yyyy")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
