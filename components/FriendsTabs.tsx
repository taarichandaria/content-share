"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { searchProfiles } from "@/lib/queries/friends";
import type { AuthorSummary, FriendEntry } from "@/lib/types/models";
import { Avatar } from "@/components/Avatar";
import { FriendButton } from "@/components/FriendButton";
import { Input, Spinner, cn } from "@/components/ui";

type Tab = "friends" | "requests" | "find";

function PersonRow({
  person,
  meId,
  entryMap,
}: {
  person: AuthorSummary;
  meId: string;
  entryMap: Map<string, FriendEntry>;
}) {
  const entry = entryMap.get(person.id) ?? null;
  return (
    <li className="flex items-center gap-3 py-3">
      <Link href={`/u/${person.username}`} className="shrink-0">
        <Avatar username={person.username} avatarUrl={person.avatar_url} />
      </Link>
      <Link href={`/u/${person.username}`} className="min-w-0 flex-1 leading-tight">
        <span className="block font-semibold text-[15px] truncate">
          {person.display_name || person.username}
        </span>
        <span className="block text-xs text-ink-faint">@{person.username}</span>
      </Link>
      <FriendButton
        meId={meId}
        otherId={person.id}
        friendship={entry?.friendship ?? null}
      />
    </li>
  );
}

export function FriendsTabs({
  meId,
  entries,
}: {
  meId: string;
  entries: FriendEntry[];
}) {
  const [tab, setTab] = useState<Tab>("friends");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AuthorSummary[]>([]);
  const [searching, setSearching] = useState(false);

  const entryMap = useMemo(
    () => new Map(entries.map((e) => [e.profile.id, e])),
    [entries]
  );

  const friends = entries.filter((e) => e.friendship.status === "accepted");
  const incoming = entries.filter(
    (e) => e.friendship.status === "pending" && e.incoming
  );
  const outgoing = entries.filter(
    (e) => e.friendship.status === "pending" && !e.incoming
  );

  const searchActive = query.trim().length >= 2;

  useEffect(() => {
    if (!searchActive) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchProfiles(createClient(), meId, query));
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query, meId, searchActive]);

  // Derived at render so stale results vanish when the query is cleared.
  const visibleResults = searchActive ? results : [];

  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: "friends", label: "Friends", count: friends.length },
    { id: "requests", label: "Requests", count: incoming.length },
    { id: "find", label: "Find people" },
  ];

  return (
    <div>
      <div className="flex gap-1 border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "smallcaps px-4 py-2.5 -mb-px border-b-2 transition-colors cursor-pointer",
              tab === t.id
                ? "border-accent text-accent"
                : "border-transparent text-ink-soft hover:text-ink"
            )}
          >
            {t.label}
            {typeof t.count === "number" && t.count > 0 && (
              <span className="ml-1.5 text-ink-faint">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "friends" && (
        <ul className="divide-y divide-line/60 mt-2">
          {friends.length === 0 && (
            <p className="commentary italic text-ink-soft py-10 text-center">
              No friends yet — find some people you trust with your taste.
            </p>
          )}
          {friends.map((e) => (
            <PersonRow
              key={e.profile.id}
              person={e.profile}
              meId={meId}
              entryMap={entryMap}
            />
          ))}
        </ul>
      )}

      {tab === "requests" && (
        <div className="mt-2 space-y-6">
          <section>
            <h2 className="smallcaps text-ink-soft mt-3">Waiting on you</h2>
            <ul className="divide-y divide-line/60">
              {incoming.length === 0 && (
                <p className="text-sm text-ink-faint py-3">No incoming requests.</p>
              )}
              {incoming.map((e) => (
                <PersonRow
                  key={e.profile.id}
                  person={e.profile}
                  meId={meId}
                  entryMap={entryMap}
                />
              ))}
            </ul>
          </section>
          <section>
            <h2 className="smallcaps text-ink-soft">Sent by you</h2>
            <ul className="divide-y divide-line/60">
              {outgoing.length === 0 && (
                <p className="text-sm text-ink-faint py-3">No outgoing requests.</p>
              )}
              {outgoing.map((e) => (
                <PersonRow
                  key={e.profile.id}
                  person={e.profile}
                  meId={meId}
                  entryMap={entryMap}
                />
              ))}
            </ul>
          </section>
        </div>
      )}

      {tab === "find" && (
        <div className="mt-4">
          <div className="relative">
            <Input
              placeholder="Search by username or name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {searching && (
              <Spinner className="absolute right-3 top-1/2 -translate-y-1/2" />
            )}
          </div>
          <ul className="divide-y divide-line/60 mt-2">
            {visibleResults.map((p) => (
              <PersonRow key={p.id} person={p} meId={meId} entryMap={entryMap} />
            ))}
            {searchActive && !searching && visibleResults.length === 0 && (
              <p className="text-sm text-ink-faint py-3">
                Nobody by that name yet.
              </p>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
