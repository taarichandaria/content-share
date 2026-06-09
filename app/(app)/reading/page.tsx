import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listReads } from "@/lib/queries/reads";
import { ReadShelf } from "@/components/ReadShelf";

export default async function ReadingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const reads = await listReads(supabase, user.id);
  const current = reads.filter((r) => r.status === "reading");
  const past = reads.filter((r) => r.status !== "reading");

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight mb-6">
        Reading
      </h1>
      <ReadShelf current={current} past={past} userId={user.id} />
    </div>
  );
}
