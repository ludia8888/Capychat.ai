import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { Prisma } from "@prisma/client";
import { resolveTenantId } from "../../../../lib/tenant";

const isMissingTable = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021";

export async function POST(req: Request) {
  try {
    const tenant = await resolveTenantId({ req });
    const body = await req.json().catch(() => ({}));
    const type = body?.type;
    if (type !== "chat_question" && type !== "faq_click") {
      return NextResponse.json({ error: "invalid type" }, { status: 400 });
    }

    const faqId = body?.faqId ? Number(body.faqId) : null;
    const faqTitle = typeof body?.faqTitle === "string" ? body.faqTitle : null;
    const payload = body?.payload ?? null;
    const message =
      typeof body?.message === "string"
        ? body.message.slice(0, 500)
        : typeof payload?.message === "string"
        ? payload.message.slice(0, 500)
        : null;

    await prisma.interactionLog.create({
      data: {
        tenantId: tenant.id,
        type,
        faqId,
        faqTitle,
        message,
        payload,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isMissingTable(err)) {
      console.warn("[analytics] InteractionLog table missing; skipping log write");
      return NextResponse.json({ ok: false, detail: "table_missing" }, { status: 200 });
    }
    console.error("POST /api/analytics/events error", err);
    return NextResponse.json({ error: "Failed to log event" }, { status: 500 });
  }
}
