import { cn } from "@/components/ui";

const HUES = [
  "bg-accent text-paper",
  "bg-moss text-paper",
  "bg-gold text-paper",
  "bg-sky text-paper",
  "bg-ink text-paper",
];

function hueFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length];
}

export function Avatar({
  username,
  avatarUrl,
  size = "md",
  className,
}: {
  username: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = { sm: "size-7 text-xs", md: "size-9 text-sm", lg: "size-16 text-xl" };
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={username}
        className={cn("rounded-full object-cover", sizes[size], className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex items-center justify-center rounded-full font-display font-semibold select-none",
        sizes[size],
        hueFor(username),
        className
      )}
    >
      {username.slice(0, 1).toUpperCase()}
    </span>
  );
}
