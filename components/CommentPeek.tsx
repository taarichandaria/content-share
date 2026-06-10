import Link from "next/link";
import type { CommentPreview } from "@/lib/types/models";
import { Avatar } from "@/components/Avatar";
import { cn } from "@/components/ui";

/* Each scrap leans its own way, held by a different shade of washi tape. */
const SCRAPS = [
  { tilt: "-rotate-[1.7deg]", tape: "bg-gold-soft/90 -rotate-6" },
  { tilt: "rotate-[2.1deg]", tape: "bg-sky-soft/90 rotate-3" },
  { tilt: "-rotate-[1.2deg]", tape: "bg-moss-soft/90 rotate-6" },
];

/**
 * Glanceable "card board" of recent margin notes, taped beneath a post's
 * content clipping. The whole board links to the post; hovering straightens
 * and fans the scraps so they can be skimmed without opening it.
 */
export function CommentPeek({
  postId,
  comments,
  total,
}: {
  postId: string;
  comments: CommentPreview[];
  total: number;
}) {
  if (comments.length === 0) return null;
  // Fetched newest-first; pile oldest → newest so the latest note sits on top.
  const scraps = [...comments].slice(0, SCRAPS.length).reverse();
  const more = total - scraps.length;

  return (
    <Link
      href={`/posts/${postId}`}
      aria-label={`${total} margin note${total === 1 ? "" : "s"} — read all`}
      className="group relative z-10 -mt-2 flex items-start px-3 sm:px-5"
    >
      {scraps.map((c, i) => {
        const look = SCRAPS[i % SCRAPS.length];
        return (
          <span
            key={c.id}
            className={cn(
              "relative block w-44 min-w-0 shrink rounded-[3px] border border-line bg-card px-3 pb-2 pt-2",
              "shadow-[1px_2px_0_rgba(34,28,20,0.07)]",
              "transition-all duration-300 ease-out motion-reduce:transition-none",
              look.tilt,
              i > 0 && "-ml-9 sm:-ml-7",
              "group-hover:rotate-0 group-hover:-translate-y-1",
              "group-hover:shadow-[2px_5px_12px_rgba(34,28,20,0.14)]",
              i > 0 && "group-hover:-ml-6 sm:group-hover:-ml-2"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute -top-2 left-1/2 h-3.5 w-10 -translate-x-1/2 border border-ink/5",
                look.tape
              )}
            />
            <span className="flex items-center gap-1.5">
              <Avatar
                username={c.author.username}
                avatarUrl={c.author.avatar_url}
                size="sm"
              />
              <span className="smallcaps min-w-0 truncate text-ink-faint">
                {c.author.display_name || c.author.username}
              </span>
            </span>
            <span className="commentary mt-1 line-clamp-2 text-[13px] leading-snug text-ink-soft">
              {c.body}
            </span>
          </span>
        );
      })}
      {more > 0 && (
        <span className="smallcaps ml-2 self-center whitespace-nowrap text-ink-faint transition-colors group-hover:text-accent">
          +{more} more
        </span>
      )}
    </Link>
  );
}
