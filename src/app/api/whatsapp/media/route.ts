import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { KapsoWhatsappService } from "@/lib/services/kapsoWhatsappService";

export const dynamic = "force-dynamic";

function inferMimeFromUrl(url: string): string | null {
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".mp4")) return "video/mp4";
  if (clean.endsWith(".webm")) return "video/webm";
  if (clean.endsWith(".3gp")) return "video/3gpp";
  if (clean.endsWith(".mp3")) return "audio/mpeg";
  if (clean.endsWith(".ogg")) return "audio/ogg";
  if (clean.endsWith(".wav")) return "audio/wav";
  if (clean.endsWith(".aac")) return "audio/aac";
  if (clean.endsWith(".m4a")) return "audio/mp4";
  if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return "image/jpeg";
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".pdf")) return "application/pdf";
  return null;
}

export async function GET(request: NextRequest) {
  const { errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  const mediaId = request.nextUrl.searchParams.get("id");
  const rawUrl = request.nextUrl.searchParams.get("url");
  if (!mediaId && !rawUrl) {
    return NextResponse.json({ error: "Media id or url is required" }, { status: 400 });
  }

  try {
    const cfg = KapsoWhatsappService.getRawConfig();
    if (!cfg.kapso_api_key) {
      return NextResponse.json({ error: "Kapso API key missing" }, { status: 400 });
    }

    let downloadUrl = "";
    let metaMime: string | undefined;

    if (mediaId) {
      const metaRes = await fetch(`https://api.kapso.ai/meta/whatsapp/v24.0/${encodeURIComponent(mediaId)}`, {
        headers: { "X-API-Key": cfg.kapso_api_key },
      });
      const metaJson = await metaRes.json().catch(() => ({}));
      downloadUrl = metaJson?.url || "";
      metaMime = metaJson?.mime_type;
      if (!metaRes.ok || !downloadUrl) {
        return NextResponse.json({ error: "Media URL not found" }, { status: 404 });
      }
    } else if (rawUrl) {
      let parsed: URL;
      try {
        parsed = new URL(rawUrl);
      } catch {
        return NextResponse.json({ error: "Invalid media url" }, { status: 400 });
      }
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return NextResponse.json({ error: "Unsupported protocol" }, { status: 400 });
      }
      downloadUrl = parsed.toString();
    }

    const isKapsoHost = /^https?:\/\/([^/]+\.)?kapso\.ai(\/|$)/i.test(downloadUrl);
    const binRes = await fetch(downloadUrl, {
      headers: isKapsoHost ? { "X-API-Key": cfg.kapso_api_key } : {},
    });
    if (!binRes.ok) {
      return NextResponse.json({ error: `Failed to fetch media binary (${binRes.status})` }, { status: 502 });
    }

    const buffer = Buffer.from(await binRes.arrayBuffer());
    const totalLength = buffer.byteLength;
    const rawCt = binRes.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    const isGenericCt = !rawCt || rawCt === "application/octet-stream" || rawCt === "binary/octet-stream";
    const contentType =
      (!isGenericCt ? rawCt : null) ||
      metaMime ||
      inferMimeFromUrl(downloadUrl) ||
      "application/octet-stream";

    const range = request.headers.get("range");
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
      if (match) {
        const start = match[1] ? parseInt(match[1], 10) : 0;
        const end = match[2] ? Math.min(parseInt(match[2], 10), totalLength - 1) : totalLength - 1;
        if (start >= 0 && start <= end && end < totalLength) {
          const chunk = buffer.subarray(start, end + 1);
          return new NextResponse(chunk, {
            status: 206,
            headers: {
              "Content-Type": contentType,
              "Content-Range": `bytes ${start}-${end}/${totalLength}`,
              "Accept-Ranges": "bytes",
              "Content-Length": String(chunk.byteLength),
              "Cache-Control": "private, max-age=3600",
            },
          });
        }
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${totalLength}` },
        });
      }
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Content-Length": String(totalLength),
        "Cache-Control": "private, max-age=3600",
      },
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
