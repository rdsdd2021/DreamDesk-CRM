import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { KapsoWhatsappService } from "@/lib/services/kapsoWhatsappService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  const mediaId = request.nextUrl.searchParams.get("id");
  if (!mediaId) {
    return NextResponse.json({ error: "Media id is required" }, { status: 400 });
  }

  try {
    const cfg = KapsoWhatsappService.getRawConfig();
    if (!cfg.kapso_api_key) {
      return NextResponse.json({ error: "Kapso API key missing" }, { status: 400 });
    }
    const metaRes = await fetch(`https://api.kapso.ai/meta/whatsapp/v24.0/${encodeURIComponent(mediaId)}`, {
      headers: { "X-API-Key": cfg.kapso_api_key },
    });
    const metaJson = await metaRes.json().catch(() => ({}));
    const downloadUrl = metaJson?.url;
    if (!metaRes.ok || !downloadUrl) {
      return NextResponse.json({ error: "Media URL not found" }, { status: 404 });
    }

    const upstreamHeaders: Record<string, string> = { "X-API-Key": cfg.kapso_api_key };
    const range = request.headers.get("range");
    if (range) upstreamHeaders["Range"] = range;

    const binRes = await fetch(downloadUrl, {
      headers: upstreamHeaders,
    });
    if ((!binRes.ok && binRes.status !== 206) || !binRes.body) {
      return NextResponse.json({ error: "Failed to fetch media binary" }, { status: 502 });
    }

    const contentType = binRes.headers.get("content-type") || metaJson?.mime_type || "application/octet-stream";
    const resHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Accept-Ranges": binRes.headers.get("accept-ranges") || "bytes",
      "Cache-Control": "private, max-age=3600",
    };
    const contentLength = binRes.headers.get("content-length");
    if (contentLength) resHeaders["Content-Length"] = contentLength;
    const contentRange = binRes.headers.get("content-range");
    if (contentRange) resHeaders["Content-Range"] = contentRange;

    return new NextResponse(binRes.body, {
      status: binRes.status === 206 ? 206 : 200,
      headers: resHeaders,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Media proxy error" }, { status: 500 });
  }
}

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
