import { NextRequest, NextResponse } from "next/server";
import { approveRoute, findRouteById } from "@/lib/db/queries";
import { isAuthorizedAdmin } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthorizedAdmin(request)) {
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
