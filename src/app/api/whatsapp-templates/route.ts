import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const templates = LeadsService.getWhatsAppTemplates();
    return NextResponse.json(templates);
  } catch (error: any) {
    console.error("Failed to get WhatsApp templates:", error);
    return NextResponse.json({ error: error.message || "Failed to get templates" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name || !body.template_body) {
      return NextResponse.json({ error: "Name and template body are required" }, { status: 400 });
    }
    const template = LeadsService.createWhatsAppTemplate({
      name: body.name,
      category: body.category,
      template_body: body.template_body,
    });
    return NextResponse.json(template, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create WhatsApp template:", error);
    return NextResponse.json({ error: error.message || "Failed to create template" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Template ID is required" }, { status: 400 });
    }
    LeadsService.deleteWhatsAppTemplate(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete WhatsApp template:", error);
    return NextResponse.json({ error: error.message || "Failed to delete template" }, { status: 500 });
  }
}
