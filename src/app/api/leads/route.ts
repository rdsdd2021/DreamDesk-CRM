import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";
import { AuthService } from "@/lib/services/authService";
import { FilterParams } from "@/types/crm";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const search = searchParams.get("search") || undefined;
    const sortBy = searchParams.get("sortBy") || "id";
    const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || "desc";

    // Parse status array: ?status=New,Contacted
    const statusParam = searchParams.get("status");
    const status = statusParam ? statusParam.split(",").filter(Boolean) : undefined;

    // Parse assigned_to array: ?assigned_to=usr_rohit,unassigned
    const assignedParam = searchParams.get("assigned_to");
    const assigned_to = assignedParam ? assignedParam.split(",").filter(Boolean) : undefined;

    // Parse campaign_id array: ?campaign_id=camp_delhi_fair
    const campaignParam = searchParams.get("campaign_id");
    const campaign_id = campaignParam ? campaignParam.split(",").filter(Boolean) : undefined;

    // Parse disposition_id array: ?disposition_id=disp_high_intent
    const dispositionParam = searchParams.get("disposition_id");
    const disposition_id = dispositionParam ? dispositionParam.split(",").filter(Boolean) : undefined;

    // Parse dynamic facets from query params: ?facet_stream=Science&facet_school=DPS
    let filterParamsCampaigns: string[] | undefined = undefined;
    let filterParamsDisps: string[] | undefined = undefined;
    const facets: Record<string, string[]> = {};
    for (const [key, value] of searchParams.entries()) {
      if (key.startsWith("facet_") && value) {
        const fieldName = key.replace("facet_", "");
        if (fieldName === "campaign_id") {
          // If passed as facet_campaign_id, merge with campaign_id
          const vals = value.split(",").filter(Boolean);
          if (vals.length > 0) {
            filterParamsCampaigns = vals;
          }
        } else if (fieldName === "disposition_id") {
          const vals = value.split(",").filter(Boolean);
          if (vals.length > 0) {
            filterParamsDisps = vals;
          }
        } else {
          facets[fieldName] = value.split(",").filter(Boolean);
        }
      }
    }

    // Check user session for Strict Private Leads RBAC enforcement
    const sessionId = request.cookies.get("dreamdesk_session")?.value;
    let currentUser = null;
    let userScope = undefined;
    if (sessionId) {
      const session = AuthService.getSession(sessionId);
      if (session) {
        currentUser = session.user;
        userScope = {
          userId: currentUser.id,
          role: currentUser.role,
          canViewAllLeads: session.permissions.canViewAllLeads,
          name: currentUser.name,
        };
      }
    }

    let finalAssignedTo = assigned_to;
    // If user is counselor or telecaller, enforce strict private leads!
    if (userScope && !userScope.canViewAllLeads) {
      finalAssignedTo = [userScope.userId];
    }

    const date_from = searchParams.get("date_from") || undefined;
    const date_to = searchParams.get("date_to") || undefined;

    const filterParams: FilterParams = {
      page,
      limit,
      search,
      status,
      assigned_to: finalAssignedTo,
      campaign_id: campaign_id || filterParamsCampaigns,
      disposition_id: disposition_id || filterParamsDisps,
      facets: Object.keys(facets).length > 0 ? facets : undefined,
      date_from,
      date_to,
      sort_by: sortBy,
      sort_order: sortOrder,
    };

    const result = LeadsService.getLeads(filterParams, userScope);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Failed to fetch leads:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch leads" },
      { status: 500 }
    );
  }
}
