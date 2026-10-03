import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";
import { AuthService } from "@/lib/services/authService";
import { AnalyticsReportParams, UserScope } from "@/types/crm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const sessionId = request.cookies.get("dreamdesk_session")?.value;
    let userScope: UserScope | undefined = undefined;

    if (sessionId) {
      const session = AuthService.getSession(sessionId);
      if (session) {
        userScope = {
          userId: session.user.id,
          role: session.user.role,
          canViewAllLeads: session.permissions.canViewAllLeads,
          name: session.user.name,
        };
      }
    }

    const date_preset = searchParams.get("date_preset") || undefined;
    const date_from = searchParams.get("date_from") || undefined;
    const date_to = searchParams.get("date_to") || undefined;
    const assigned_to = searchParams.get("assigned_to") || undefined;
    const campaign_id = searchParams.get("campaign_id") || undefined;
    const status = searchParams.get("status") || undefined;
    const stream = searchParams.get("stream") || undefined;
    const disposition_id = searchParams.get("disposition_id") || undefined;
    const min_score = searchParams.get("min_score") ? parseInt(searchParams.get("min_score")!, 10) : undefined;

    const params: AnalyticsReportParams = {
      date_preset,
      date_from,
      date_to,
      assigned_to,
      campaign_id,
      status,
      stream,
      disposition_id,
      min_score,
    };

    const report = LeadsService.getFilteredAnalyticsReport(params, userScope);

    return NextResponse.json(report, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: any) {
    console.error("Failed to generate analytics report:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate analytics report" },
      { status: 500 }
    );
  }
}
