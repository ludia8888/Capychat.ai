import { NextResponse } from "next/server";
import { resolveTenantId } from "../../../../lib/tenant";
import { getChatSettings } from "../../../../lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const fallbackPath = "/capychat_mascot.png";

function toAbsoluteUrl(pathOrUrl: string, baseUrl: string) {
  try {
    return new URL(pathOrUrl, baseUrl).toString();
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const tenant = await resolveTenantId({ req });
    const settings = await getChatSettings(tenant.id);

    const dataUrl = (settings.thumbnailDataUrl || "").trim();
    const dataMatch = dataUrl.match(/^data:(image\/[-+.a-zA-Z0-9]+);base64,(.+)$/);
    if (dataMatch) {
      const mime = dataMatch[1];
      const base64 = dataMatch[2];
      const bytes = Buffer.from(base64, "base64");
      return new NextResponse(bytes, {
        headers: {
          "Content-Type": mime,
          "Cache-Control": "public, max-age=300",
        },
      });
    }

    const thumbnailUrl = (settings.thumbnailUrl || "").trim();
    if (thumbnailUrl && !thumbnailUrl.startsWith("data:")) {
      const abs = toAbsoluteUrl(thumbnailUrl, req.url);
      if (abs) {
        return NextResponse.redirect(abs, { status: 302 });
      }
    }
  } catch (err) {
    console.error("GET /api/public/chat-thumbnail error:", err);
  }

  return NextResponse.redirect(new URL(fallbackPath, req.url).toString(), { status: 302 });
}
