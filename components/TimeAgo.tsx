import { formatDistanceToNowStrict } from "date-fns";

export function TimeAgo({ date }: { date: string }) {
  return (
    <time
      dateTime={date}
      title={new Date(date).toLocaleString()}
      suppressHydrationWarning
      className="text-ink-faint"
    >
      {formatDistanceToNowStrict(new Date(date), { addSuffix: true })}
    </time>
  );
}
