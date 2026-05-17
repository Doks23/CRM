import { NextResponse } from "next/server";
import { syncGmail } from "@/lib/gmail/sync";
import { auth } from "@/auth";

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await syncGmail();
  return NextResponse.json(result);
}
