import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, locationInfo } = body;

    // Resolve client IP address
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const clientIp = forwarded ? forwarded.split(",")[0].trim() : (realIp || "127.0.0.1");

    // Format human-readable location telemetry string
    const tz = locationInfo?.timezone || "Asia/Kolkata";
    let geoCoords = "";
    if (typeof locationInfo?.latitude === "number" && typeof locationInfo?.longitude === "number") {
      const latDir = locationInfo.latitude >= 0 ? "°N" : "°S";
      const lonDir = locationInfo.longitude >= 0 ? "°E" : "°W";
      geoCoords = `${Math.abs(locationInfo.latitude).toFixed(2)}${latDir}, ${Math.abs(locationInfo.longitude).toFixed(2)}${lonDir}`;
    }

    const tzParts = tz.split("/");
    const city = tzParts.length > 1 ? tzParts[1].replace(/_/g, " ") : tz;
    const locationStr = geoCoords ? `${city} (${geoCoords}) • ${clientIp}` : `${city} Terminal • ${clientIp}`;

    const metadata = {
      ip: clientIp,
      location: locationStr,
      userAgent: request.headers.get("user-agent") || "Browser Terminal",
    };

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email address and password are required." },
        { status: 400 }
      );
    }

    const authResult = AuthService.authenticate(email, password, metadata);

    const { user, session, permissions } = authResult;

    const response = NextResponse.json({
      success: true,
      user,
      permissions,
      expiresAt: session.expiresAt,
    });

    const isHttps = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
    // Set secure HTTP-only session cookie
    response.cookies.set("dreamdesk_session", session.sessionId, {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error: any) {
    console.error("Login failure:", error);
    return NextResponse.json(
      { error: error?.message || "Invalid credentials. Please try again." },
      { status: 401 }
    );
  }
}
