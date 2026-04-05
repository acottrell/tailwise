import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import {
  insertWeeklyAnnouncement,
  deleteWeeklyAnnouncement,
} from "@/lib/db/queries";
import { sanitizeOrReject } from "@/lib/sanitize";

function verifyAdmin(request: NextRequest): boolean {
  const secret = process.env.LBRCC_ADMIN_SECRET;
  if (!secret) return false;

  const cookie = request.cookies.get("lbrcc_admin")?.value;
  if (cookie === secret) return true;

  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

const announcementSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1).max(200),
  body: z.string().max(1000).optional(),
  routeId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = announcementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { weekStart, title, body: announcementBody, routeId } = parsed.data;

  const cleanTitle = sanitizeOrReject(title, 200);
  if (!cleanTitle) {
    return NextResponse.json({ error: "Invalid title" }, { status: 400 });
  }
  const cleanBody = announcementBody
    ? sanitizeOrReject(announcementBody, 1000)
    : undefined;

  const id = nanoid();
  await insertWeeklyAnnouncement({
    id,
    weekStart,
    title: cleanTitle,
    body: cleanBody || null,
    routeId: routeId || null,
  });

  return NextResponse.json({ id }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await deleteWeeklyAnnouncement(id);
  return NextResponse.json({ ok: true });
}
