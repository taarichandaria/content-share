import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { searchBookCover } from "@/lib/book-cover";

const BodySchema = z.object({
  title: z.string().trim().min(1).max(500),
  author: z.string().trim().max(500).nullish(),
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
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  // searchBookCover() never throws; a miss comes back as null and the
  // composer simply shows no cover preview.
  const imageUrl = await searchBookCover(parsed.data.title, parsed.data.author);
  return NextResponse.json({ imageUrl });
}
