import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listSaves } from "@/lib/queries/saves";
import { SavedList } from "@/components/SavedList";

export default async function SavedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const saves = await listSaves(supabase, user.id);

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight mb-6">
        Saved
      </h1>
      <SavedList initial={saves} />
    </div>
  );
}
