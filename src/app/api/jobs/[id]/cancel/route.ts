import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { JobsService } from "@/lib/services/jobsService";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, errorResponse } = AuthService.requireAuth(req);
    if (errorResponse) {
      return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
    }

    const { id } = await params;
    const job = JobsService.getJob(id);
    if (!job) {
      return NextResponse.json({ error: "Background job not found" }, { status: 404 });
    }

    if (job.created_by && job.created_by !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = JobsService.cancelJob(id, session.user.name);
    return NextResponse.json({ success: true, job: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to cancel background job" },
      { status: 500 }
    );
  }
}
