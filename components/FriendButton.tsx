"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  acceptFriendRequest,
  removeFriendship,
  sendFriendRequest,
} from "@/lib/queries/friends";
import type { Friendship } from "@/lib/types/models";
import { Button } from "@/components/ui";

/**
 * Renders the full friendship state machine for `other`, from my perspective:
 * none -> Add friend; outgoing pending -> Cancel; incoming pending ->
 * Accept/Decline; accepted -> Friends (confirm to unfriend).
 */
export function FriendButton({
  meId,
  otherId,
  friendship,
}: {
  meId: string;
  otherId: string;
  friendship: Friendship | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmingUnfriend, setConfirmingUnfriend] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      router.refresh();
    } finally {
      setBusy(false);
      setConfirmingUnfriend(false);
    }
  }

  const db = () => createClient();

  if (!friendship) {
    return (
      <Button
        size="sm"
        disabled={busy}
        onClick={() => run(() => sendFriendRequest(db(), meId, otherId))}
      >
        Add friend
      </Button>
    );
  }

  if (friendship.status === "pending") {
    if (friendship.requester_id === meId) {
      return (
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => run(() => removeFriendship(db(), meId, otherId))}
        >
          Requested · Cancel
        </Button>
      );
    }
    return (
      <span className="inline-flex gap-2">
        <Button
          size="sm"
          disabled={busy}
          onClick={() => run(() => acceptFriendRequest(db(), meId, otherId))}
        >
          Accept
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => run(() => removeFriendship(db(), meId, otherId))}
        >
          Decline
        </Button>
      </span>
    );
  }

  // accepted
  if (confirmingUnfriend) {
    return (
      <span className="inline-flex gap-2">
        <Button
          size="sm"
          variant="danger"
          disabled={busy}
          onClick={() => run(() => removeFriendship(db(), meId, otherId))}
        >
          Unfriend
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setConfirmingUnfriend(false)}
        >
          Keep
        </Button>
      </span>
    );
  }
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={() => setConfirmingUnfriend(true)}
    >
      &#10087; Friends
    </Button>
  );
}
