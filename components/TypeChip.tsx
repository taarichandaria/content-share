import type { ContentType } from "@/lib/types/models";
import { cn } from "@/components/ui";

const TYPE_STYLES: Record<ContentType, { dot: string; label: string }> = {
  article: { dot: "bg-accent", label: "Article" },
  blog: { dot: "bg-accent", label: "Blog" },
  podcast: { dot: "bg-moss", label: "Podcast" },
  video: { dot: "bg-sky", label: "Video" },
  tweet: { dot: "bg-sky", label: "Post" },
  book: { dot: "bg-gold", label: "Book" },
  paper: { dot: "bg-ink-soft", label: "Paper" },
  other: { dot: "bg-ink-faint", label: "Link" },
};

export function TypeChip({
  type,
  className,
}: {
  type: ContentType;
  className?: string;
}) {
  const s = TYPE_STYLES[type] ?? TYPE_STYLES.other;
  return (
    <span
      className={cn(
        "smallcaps inline-flex items-center gap-1.5 text-ink-soft",
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", s.dot)} aria-hidden />
      {s.label}
    </span>
  );
}
