"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/Avatar";
import { cn } from "@/components/ui";
import {
  BookIcon,
  FeedIcon,
  FriendsIcon,
  GearIcon,
} from "@/components/icons";
import type { AuthorSummary } from "@/lib/types/models";

interface NavProps {
  profile: AuthorSummary;
  pendingCount: number;
}

function navItems(profile: AuthorSummary) {
  return [
    { href: "/", label: "Feed", icon: FeedIcon },
    { href: "/reading", label: "Reading", icon: BookIcon },
    { href: "/friends", label: "Friends", icon: FriendsIcon, badge: true },
    {
      href: `/u/${profile.username}`,
      label: "You",
      icon: null, // avatar
    },
    { href: "/settings", label: "Settings", icon: GearIcon },
  ];
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Nav({ profile, pendingCount }: NavProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const items = navItems(profile);

  return (
    <>
      {/* Desktop left rail */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-line px-6 py-8 z-40">
        <Link href="/" className="block mb-10">
          <span className="font-display text-[1.7rem] font-semibold tracking-tight">
            Commonplace
          </span>
          <span className="block smallcaps text-ink-faint mt-1">
            among friends
          </span>
        </Link>
        <nav className="flex flex-col gap-1">
          {items.map(({ href, label, icon: Icon, badge }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                isActive(pathname, href)
                  ? "bg-paper-deep text-ink"
                  : "text-ink-soft hover:text-ink hover:bg-paper-deep/60"
              )}
            >
              {Icon ? (
                <Icon />
              ) : (
                <Avatar
                  username={profile.username}
                  avatarUrl={profile.avatar_url}
                  size="sm"
                  className="-ml-0.5"
                />
              )}
              <span className="smallcaps">{label}</span>
              {badge && pendingCount > 0 && (
                <span className="ml-auto inline-flex size-5 items-center justify-center rounded-full bg-accent text-paper text-[11px] font-semibold">
                  {pendingCount}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <button
          onClick={signOut}
          className="smallcaps mt-auto text-left text-ink-faint hover:text-accent transition-colors px-3 cursor-pointer"
        >
          Sign out
        </button>
      </aside>

      {/* Mobile top masthead */}
      <header className="lg:hidden sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur-sm px-4 py-3 text-center">
        <Link href="/" className="font-display text-xl font-semibold tracking-tight">
          Commonplace
        </Link>
      </header>

      {/* Mobile bottom tabs */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line bg-paper/95 backdrop-blur-sm">
        <div className="flex justify-around px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
          {items.map(({ href, label, icon: Icon, badge }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex flex-col items-center gap-0.5 rounded-md px-3 py-1",
                isActive(pathname, href) ? "text-accent" : "text-ink-soft"
              )}
            >
              {Icon ? (
                <Icon />
              ) : (
                <Avatar
                  username={profile.username}
                  avatarUrl={profile.avatar_url}
                  size="sm"
                  className="size-5 text-[10px]"
                />
              )}
              <span className="text-[10px] font-semibold tracking-wide uppercase">
                {label}
              </span>
              {badge && pendingCount > 0 && (
                <span className="absolute -top-0.5 right-1 size-2 rounded-full bg-accent" />
              )}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
