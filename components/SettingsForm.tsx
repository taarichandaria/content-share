"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updateProfile } from "@/lib/queries/profiles";
import type { Profile } from "@/lib/types/models";
import { Avatar } from "@/components/Avatar";
import { Button, ErrorNote, Field, Input, Spinner, Textarea } from "@/components/ui";

export function SettingsForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function uploadAvatar(file: File) {
    setUploading(true);
    setError(null);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await updateProfile(createClient(), profile.id, {
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        avatar_url: avatarUrl,
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-5 max-w-md">
      <ErrorNote>{error}</ErrorNote>

      <div className="flex items-center gap-4">
        <Avatar
          username={profile.username}
          avatarUrl={avatarUrl}
          size="lg"
        />
        <label className="cursor-pointer">
          <span className="smallcaps text-accent underline underline-offset-4">
            {uploading ? "Uploading…" : "Change portrait"}
          </span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadAvatar(f);
            }}
          />
        </label>
      </div>

      <Field label="Username">
        <Input value={`@${profile.username}`} disabled className="opacity-60" />
      </Field>

      <Field label="Display name">
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={60}
        />
      </Field>

      <Field label="Bio">
        <Textarea
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="What do you read, watch, chase?"
          maxLength={300}
        />
      </Field>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy || uploading}>
          {busy ? <Spinner className="border-paper border-t-transparent" /> : "Save"}
        </Button>
        {saved && <span className="text-sm text-moss">Saved.</span>}
      </div>
    </form>
  );
}
