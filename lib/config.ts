import { prisma } from "./db";
import { Prisma } from "@prisma/client";

export type ChatSettings = {
  headerText: string;
  thumbnailUrl: string;
};

const CHAT_HEADER_KEY = "chat_header_text";
const CHAT_THUMBNAIL_KEY = "chat_thumbnail_url";

const defaultChatSettings: ChatSettings = {
  headerText: "카피챗에게 모두 물어보세요!",
  thumbnailUrl: "/capychat_mascot.png",
};

const isMissingSiteConfig = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021";

export async function getChatSettings(): Promise<ChatSettings> {
  try {
    const rows = await prisma.siteConfig.findMany({
      where: { key: { in: [CHAT_HEADER_KEY, CHAT_THUMBNAIL_KEY] } },
    });

    const map = rows.reduce<Record<string, string>>((acc, cur) => {
      acc[cur.key] = cur.value;
      return acc;
    }, {});

    return {
      headerText: map[CHAT_HEADER_KEY] ?? defaultChatSettings.headerText,
      thumbnailUrl: map[CHAT_THUMBNAIL_KEY] ?? defaultChatSettings.thumbnailUrl,
    };
  } catch (err) {
    if (isMissingSiteConfig(err)) {
      console.warn("[config] SiteConfig table not found; returning defaults");
      return defaultChatSettings;
    }
    throw err;
  }
}

export async function updateChatSettings(payload: Partial<ChatSettings>): Promise<ChatSettings> {
  const tasks = [];

  if (payload.headerText !== undefined) {
    tasks.push(
      prisma.siteConfig.upsert({
        where: { key: CHAT_HEADER_KEY },
        create: { key: CHAT_HEADER_KEY, value: payload.headerText },
        update: { value: payload.headerText },
      })
    );
  }

  if (payload.thumbnailUrl !== undefined) {
    tasks.push(
      prisma.siteConfig.upsert({
        where: { key: CHAT_THUMBNAIL_KEY },
        create: { key: CHAT_THUMBNAIL_KEY, value: payload.thumbnailUrl },
        update: { value: payload.thumbnailUrl },
      })
    );
  }

  try {
    if (tasks.length) {
      await prisma.$transaction(tasks);
    }
    return getChatSettings();
  } catch (err) {
    if (isMissingSiteConfig(err)) {
      console.warn("[config] SiteConfig table not found; update skipped, returning defaults");
      return defaultChatSettings;
    }
    throw err;
  }
}
