import { NextRequest, NextResponse } from "next/server";
import { approveRoute, findRouteById } from "@/lib/db/queries";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const secret = request.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const route = await findRouteById(id);
  if (!route) {
    return NextResponse.json({ error: "Route not found" }, { status: 404 });
  }

  await approveRoute(id);
  return NextResponse.json({ message: "Route approved" });
}
