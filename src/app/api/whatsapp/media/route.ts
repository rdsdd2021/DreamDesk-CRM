import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { KapsoWhatsappService } from "@/lib/services/kapsoWhatsappService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Media file is required" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const result = await KapsoWhatsappService.uploadMedia(
      buffer,
      file.name || "upload.bin",
      file.type || "application/octet-stream"
    );

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to upload media to Kapso" },
      { status: 400 }
    );
  }
}
