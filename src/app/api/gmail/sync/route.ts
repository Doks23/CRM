import { NextResponse } from "next/server";
import { syncGmail } from "@/lib/gmail/sync";
import { auth } from "@/auth";

export async function POST() {
  const session = await auth();
  if (session?.user?.role !== "owner") return NextResponse.json({ error: "Only owner can sync" }, { status: 403 });

  const result = await syncGmail();
  return NextResponse.json(result);
}
