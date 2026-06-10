import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { enrichUnfurl } from "@/lib/enrich";
import { unfurl } from "@/lib/unfurl";

const BodySchema = z.object({
  url: z.url(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  // unfurl() never throws; failures come back as { ok: false } and the
  // composer falls back to manual entry. Enrichment is best-effort on top.
  const result = await unfurl(parsed.data.url);
  const enriched = await enrichUnfurl(result);
  return NextResponse.json(enriched);
}
