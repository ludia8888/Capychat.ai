import { NextResponse } from "next/server";
import { getChatSettings, updateChatSettings } from "../../../../lib/config";
import { AuthError, getUserFromCookies, requireAdmin } from "../../../../lib/auth";
import { resolveTenantId } from "../../../../lib/tenant";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const user = await getUserFromCookies();
    const tenant = await resolveTenantId({ tenantIdFromUser: user?.tenantId });
    const settings = await getChatSettings(tenant.id);
    return NextResponse.json({ settings });
  } catch (err: any) {
    console.error("GET /api/config/chat error", err);
    const status = err?.status || 500;
    return NextResponse.json({ error: err?.message || "Failed to load chat settings" }, { status });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const payload: { headerText?: string; thumbnailUrl?: string; thumbnailDataUrl?: string; systemPrompt?: string } = {};

    if (typeof body?.headerText === "string") payload.headerText = body.headerText.trim();
    if (typeof body?.thumbnailUrl === "string") payload.thumbnailUrl = body.thumbnailUrl.trim();
    if (typeof body?.thumbnailDataUrl === "string") payload.thumbnailDataUrl = body.thumbnailDataUrl;
    if (typeof body?.systemPrompt === "string") payload.systemPrompt = body.systemPrompt.trim();

    if (!Object.keys(payload).length) {
      return NextResponse.json({ error: "No fields provided" }, { status: 400 });
    }

    const settings = await updateChatSettings(user.tenantId, payload);
    return NextResponse.json({ settings });
  } catch (err: any) {
    console.error("PUT /api/config/chat error", err);
    if (err instanceof AuthError || err?.status === 401 || err?.status === 403) {
      return NextResponse.json({ error: err?.message || "Unauthorized" }, { status: err?.status || 401 });
    }
    return NextResponse.json({ error: "Failed to save chat settings" }, { status: 500 });
  }
}
