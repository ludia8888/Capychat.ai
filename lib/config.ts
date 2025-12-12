import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { DEFAULT_SYSTEM_PROMPT } from "./chatbotPrompt";

export type ChatSettings = {
  headerText: string;
  thumbnailUrl: string;
  thumbnailDataUrl: string;
  systemPrompt: string;
};

const CHAT_HEADER_KEY = "chat_header_text";
const CHAT_THUMBNAIL_KEY = "chat_thumbnail_url";
const CHAT_THUMBNAIL_DATA_URL_KEY = "chat_thumbnail_data_url";
const CHAT_SYSTEM_PROMPT_KEY = "chat_system_prompt";

const defaultChatSettings: ChatSettings = {
  headerText: "당특순에게 모두 물어보세요!",
  thumbnailUrl: "/capychat_mascot.png",
  thumbnailDataUrl: "",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
};

const isMissingSiteConfig = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021";

export async function getChatSettings(tenantId: number): Promise<ChatSettings> {
  try {
    const rows = await prisma.siteConfig.findMany({
      where: { tenantId, key: { in: [CHAT_HEADER_KEY, CHAT_THUMBNAIL_KEY, CHAT_THUMBNAIL_DATA_URL_KEY, CHAT_SYSTEM_PROMPT_KEY] } },
    });

    const map = rows.reduce<Record<string, string>>((acc, cur) => {
      acc[cur.key] = cur.value;
      return acc;
    }, {});

    const storedPrompt = map[CHAT_SYSTEM_PROMPT_KEY];

    return {
      headerText: map[CHAT_HEADER_KEY] ?? defaultChatSettings.headerText,
      thumbnailUrl: map[CHAT_THUMBNAIL_KEY] ?? defaultChatSettings.thumbnailUrl,
      thumbnailDataUrl: map[CHAT_THUMBNAIL_DATA_URL_KEY] ?? defaultChatSettings.thumbnailDataUrl,
      systemPrompt: storedPrompt?.trim() ? storedPrompt : defaultChatSettings.systemPrompt,
    };
  } catch (err) {
    if (isMissingSiteConfig(err)) {
      console.warn("[config] SiteConfig table not found; returning defaults");
      return defaultChatSettings;
    }
    throw err;
  }
}

export async function updateChatSettings(tenantId: number, payload: Partial<ChatSettings>): Promise<ChatSettings> {
  const tasks = [];

  if (payload.headerText !== undefined) {
    tasks.push(
      prisma.siteConfig.upsert({
        where: { tenantId_key: { tenantId, key: CHAT_HEADER_KEY } },
        create: { tenantId, key: CHAT_HEADER_KEY, value: payload.headerText },
        update: { value: payload.headerText },
      })
    );
  }

  if (payload.thumbnailUrl !== undefined) {
    tasks.push(
      prisma.siteConfig.upsert({
        where: { tenantId_key: { tenantId, key: CHAT_THUMBNAIL_KEY } },
        create: { tenantId, key: CHAT_THUMBNAIL_KEY, value: payload.thumbnailUrl },
        update: { value: payload.thumbnailUrl },
      })
    );
  }

  if (payload.thumbnailDataUrl !== undefined) {
    tasks.push(
      prisma.siteConfig.upsert({
        where: { tenantId_key: { tenantId, key: CHAT_THUMBNAIL_DATA_URL_KEY } },
        create: { tenantId, key: CHAT_THUMBNAIL_DATA_URL_KEY, value: payload.thumbnailDataUrl },
        update: { value: payload.thumbnailDataUrl },
      })
    );
  }

  if (payload.systemPrompt !== undefined) {
    tasks.push(
      prisma.siteConfig.upsert({
        where: { tenantId_key: { tenantId, key: CHAT_SYSTEM_PROMPT_KEY } },
        create: { tenantId, key: CHAT_SYSTEM_PROMPT_KEY, value: payload.systemPrompt },
        update: { value: payload.systemPrompt },
      })
    );
  }

  try {
    if (tasks.length) {
      await prisma.$transaction(tasks);
    }
    return getChatSettings(tenantId);
  } catch (err) {
    if (isMissingSiteConfig(err)) {
      console.warn("[config] SiteConfig table not found; update skipped, returning defaults");
      return defaultChatSettings;
    }
    throw err;
  }
}
