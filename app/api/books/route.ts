import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { searchBooks } from "@/lib/books";

const QuerySchema = z.string().trim().min(2).max(200);

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = QuerySchema.safeParse(request.nextUrl.searchParams.get("q"));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid query" }, { status: 400 });
  }

  // searchBooks() never throws; failures come back as [] and the composer
  // falls back to manual entry.
  const books = await searchBooks(parsed.data);
  return NextResponse.json({ books });
}
