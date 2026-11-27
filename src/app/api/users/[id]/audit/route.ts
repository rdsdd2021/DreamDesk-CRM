import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = AuthService.requireAuth(request, "canManageTeam");
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  try {
    const { id } = await params;
    const details = AuthService.getUserAuditDetails(id);
    return NextResponse.json(details);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load user audit details" },
      { status: 500 }
    );
  }
}
