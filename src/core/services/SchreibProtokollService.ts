import { Prisma } from '@prisma/client';
import { prisma } from '../db';

/**
 * Was hat ChatGPT geändert? Jeder Schreibvorgang über den MCP-Server, der
 * wirklich etwas geändert hat, landet in `mcp_write_log`. Sonst lässt sich
 * ein unerklärlicher Haken nicht zurückverfolgen.
 */
export interface Protokolleintrag {
  werkzeug: string;
  /** Der Tag des Hakens, `YYYY-MM-DD`. */
  tag: string;
  argumente: Record<string, unknown>;
  vorher: unknown;
  nachher: unknown;
  client: string;
}

const json = (v: unknown) => (v === null || v === undefined ? Prisma.JsonNull : (v as Prisma.InputJsonValue));

export class SchreibProtokollService {
  static async schreibe(e: Protokolleintrag): Promise<void> {
    await prisma.mcpWriteLog.create({
      data: {
        werkzeug: e.werkzeug,
        tag: new Date(`${e.tag}T00:00:00.000Z`),
        argumente: e.argumente as Prisma.InputJsonValue,
        vorher: json(e.vorher),
        nachher: json(e.nachher),
        client: e.client,
      },
    });
  }

  /** Was an einem Tag über den MCP-Server eingetragen wurde: Werkzeuge und Clients, `null` = nichts. */
  static async tag(tag: string): Promise<{ werkzeuge: string[]; clients: string[] } | null> {
    const zeilen = await prisma.mcpWriteLog.findMany({
      where: { tag: new Date(`${tag}T00:00:00.000Z`) },
      select: { werkzeug: true, client: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!zeilen.length) return null;
    return {
      werkzeuge: [...new Set(zeilen.map(z => z.werkzeug))],
      clients: [...new Set(zeilen.map(z => z.client))],
    };
  }
}

