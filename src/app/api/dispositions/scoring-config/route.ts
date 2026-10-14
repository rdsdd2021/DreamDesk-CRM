import { NextRequest, NextResponse } from "next/server";
import { ScoringService } from "@/lib/services/scoringService";
import { AuthService } from "@/lib/services/authService";

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = AuthService.requireAuth(request);
    if (errorResponse) {
      return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
    }

    const config = ScoringService.getScoringConfig();
    return NextResponse.json({ config });
  } catch (error: any) {
    console.error("Failed to fetch scoring config:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch scoring configuration" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { session, errorResponse } = AuthService.requireAuth(request);
    if (errorResponse) {
      return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
    }

    // Only Admin or Team Lead can modify scoring policy algorithm weights
    if (!session.permissions.canManageCampaigns && !session.permissions.canManageSchema) {
      return NextResponse.json(
        { error: "Access denied. Only Admins can modify lead ranking algorithm weights." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { config: updates, recalculateAll } = body;

    let updatedConfig = ScoringService.getScoringConfig();
    if (updates && typeof updates === "object") {
      updatedConfig = ScoringService.updateScoringConfig(updates, session.user.name || "Admin");
    }

    let batchResult = null;
    if (recalculateAll) {
      batchResult = ScoringService.recalculateAllLeads(updatedConfig, session.user.name || "Admin");
    }

    return NextResponse.json({
      success: true,
      config: updatedConfig,
      batchResult,
    });
  } catch (error: any) {
    console.error("Failed to update scoring policy config:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update scoring policy config" },
      { status: 500 }
    );
  }
}
