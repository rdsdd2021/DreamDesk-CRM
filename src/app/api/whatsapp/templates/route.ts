import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { KapsoWhatsappService } from "@/lib/services/kapsoWhatsappService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  const onlyApproved = request.nextUrl.searchParams.get("approved") === "1";
  const templates = KapsoWhatsappService.listTemplates(onlyApproved);
  return NextResponse.json({ templates });
}

export async function POST(request: NextRequest) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }
  if (!["admin", "team_lead"].includes(session.user.role)) {
    return NextResponse.json(
      { error: "Only Admins and Team Leads can submit Meta/Kapso templates." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const template = await KapsoWhatsappService.createAndSubmitTemplate({
      name: body?.name,
      category: body?.category || "UTILITY",
      language: body?.language || "en_US",
      parameter_format: body?.parameter_format || "NAMED",
      header_type: body?.header_type || "NONE",
      header_text: body?.header_text,
      header_handle: body?.header_handle,
      body_text: body?.body_text,
      footer_text: body?.footer_text,
      variables: body?.variables,
      buttons: body?.buttons,
    });
    return NextResponse.json({ success: true, template }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to submit template to Meta/Kapso" },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }
  if (!["admin", "team_lead"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Template ID is required" }, { status: 400 });
  }

  try {
    await KapsoWhatsappService.deleteTemplate(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to delete template" },
      { status: 400 }
    );
  }
}
