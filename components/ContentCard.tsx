import type { ContentItem } from "@/lib/types/models";
import { TypeChip } from "@/components/TypeChip";
import { cn } from "@/components/ui";

/** Type-aware link-preview card; renders as an anchor when a url exists. */
export function ContentCard({ item }: { item: ContentItem }) {
  const inner = (
    <div className="flex gap-4 items-stretch">
      <div className="min-w-0 flex-1 py-3.5 pl-4">
        <TypeChip type={item.type} />
        <h3 className="font-display text-lg font-semibold leading-snug mt-1.5 group-hover:text-accent-deep transition-colors">
          {item.title}
        </h3>
        <p className="smallcaps text-ink-faint mt-1.5">
          {[item.site_name, item.creator].filter(Boolean).join(" · ")}
        </p>
        {item.description && (
          <p className="text-sm text-ink-soft mt-1.5 line-clamp-2">
            {item.description}
          </p>
        )}
      </div>
      {item.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.image_url}
          alt=""
          className="w-24 sm:w-32 shrink-0 object-cover rounded-r-[7px]"
        />
      ) : item.type === "book" ? (
        <div
          aria-hidden
          className="w-16 sm:w-20 shrink-0 rounded-r-[7px] bg-gold-soft border-l-4 border-gold flex items-center justify-center"
        >
          <span className="font-display text-3xl text-gold font-semibold">
            {item.title.slice(0, 1)}
          </span>
        </div>
      ) : null}
    </div>
  );

  const frame = cn(
    "group block overflow-hidden rounded-lg border border-line bg-card",
    "transition-all duration-150"
  );

  if (item.url) {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(frame, "hover:border-ink-faint hover:shadow-[2px_2px_0_var(--color-line)]")}
      >
        {inner}
      </a>
    );
  }
  return <div className={frame}>{inner}</div>;
}
