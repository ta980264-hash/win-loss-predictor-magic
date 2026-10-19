import { createFileRoute } from "@tanstack/react-router";

const CHANNEL = "https://t.me/s/formula_1_si";

type Direction = "BIG" | "SMALL";
type Signal = {
  signalId: string;
  period: string;
  sourceDirection: Direction;
  direction: Direction;
  level: number;
  sourceText: string;
  postedAt: string | null;
};

function parse(html: string): Signal[] {
  const out = new Map<string, Signal>();
  const re = /js-message_text"[^>]*>([\s\S]*?)<\/div>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const text = (m[1] ?? "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Formula 1 posts use formats such as:
    // "TRX 64 B 300" or "TRX 64 BIG 300".
    const match = text.match(/\bTRX\s*[-:#]?\s*(\d{1,30})\s+(B|S|BIG|SMALL)\b(?:\s+(\d+))?/i);
    if (!match) continue;

    const period = match[1] ?? "";
    const rawDirection = (match[2] ?? "").toUpperCase();
    const sourceDirection: Direction =
      rawDirection === "B" || rawDirection === "BIG" ? "BIG" : "SMALL";

    // The website intentionally mirrors the channel in the opposite direction.
    const direction: Direction = sourceDirection === "BIG" ? "SMALL" : "BIG";
    const level = Number(match[3] ?? 1);
    const messageEnd = html.indexOf("</div></div>", m.index);
    const messageHtml = html.slice(m.index, messageEnd === -1 ? undefined : messageEnd);
    const postedAt = messageHtml.match(/<time\s+datetime="([^"]+)"/i)?.[1] ?? null;

    // Keep the first version seen for a period in this fetch. The database
    // insert below is ignore-on-conflict, so an old signal can never be edited
    // by a later Telegram update.
    if (!out.has(period)) {
      out.set(period, {
        signalId: `${period}:${postedAt ?? text}`,
        period,
        sourceDirection,
        direction,
        level,
        sourceText: text,
        postedAt,
      });
    }
  }
  return [...out.values()].reverse();
}

// Same format as the <time datetime> attribute on t.me/s, so a post read via
// the bot and via the web preview produces the identical signalId (no dupes).
function toTelegramIso(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

function parseText(text: string, postedAt: string): Signal | null {
  const clean = text.replace(/\s+/g, " ").trim();
  const match = clean.match(/\bTRX\s*[-:#]?\s*(\d{1,30})\s+(B|S|BIG|SMALL)\b(?:\s+(\d+))?/i);
  if (!match) return null;
  const period = match[1] ?? "";
  const rawDirection = (match[2] ?? "").toUpperCase();
  const sourceDirection: Direction =
    rawDirection === "B" || rawDirection === "BIG" ? "BIG" : "SMALL";
  const direction: Direction = sourceDirection === "BIG" ? "SMALL" : "BIG";
  return {
    signalId: `${period}:${postedAt}`,
    period,
    sourceDirection,
    direction,
    level: Number(match[3] ?? 1),
    sourceText: clean,
    postedAt,
  };
}

const CHANNEL_USERNAME = "formula_1_si";

// The t.me/s web preview lags the real channel by up to ~70 seconds. When a
// bot that is an admin of the channel is configured, read new posts straight
// from the Bot API, which delivers them the moment they are published.
type BotFetch = { signals: Signal[]; ack: number | null };

async function fetchFromBot(): Promise<BotFetch> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) return { signals: [], ack: null };
  const api = `https://api.telegram.org/bot${token}`;
  const res = await fetch(
    `${api}/getUpdates?timeout=0&allowed_updates=${encodeURIComponent('["channel_post"]')}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    console.error("[v0] telegram bot status:", res.status);
    return { signals: [], ack: null };
  }
  const json = (await res.json()) as {
    result?: {
      update_id: number;
      channel_post?: {
        date: number;
        text?: string;
        caption?: string;
        chat?: { username?: string };
      };
    }[];
  };
  const updates = json.result ?? [];
  const signals: Signal[] = [];
  for (const update of updates) {
    const post = update.channel_post;
    if (!post || post.chat?.username?.toLowerCase() !== CHANNEL_USERNAME) continue;
    const signal = parseText(post.text ?? post.caption ?? "", toTelegramIso(post.date));
    if (signal) signals.push(signal);
  }
  const lastUpdate = updates[updates.length - 1];
  return { signals, ack: lastUpdate ? lastUpdate.update_id + 1 : null };
}

async function ackBotUpdates(offset: number) {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/getUpdates?timeout=0&limit=1&offset=${offset}`, {
    cache: "no-store",
  }).catch(() => {});
}

async function fetchFromWebPreview(): Promise<Signal[]> {
  const headers = {
    accept: "text/html",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  };
  // Two URL variants are served from different cache entries; whichever is
  // fresher wins, which trims a few seconds off the preview lag.
  const urls = [`${CHANNEL}?t=${Date.now()}`, `${CHANNEL}?before=999999999&t=${Date.now()}`];
  const pages = await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetch(url, { headers, cache: "no-store" });
        if (res.ok) return parse(await res.text());
        console.error("[v0] signals upstream status:", res.status);
      } catch (upstreamError) {
        console.error("[v0] signals upstream unavailable:", String(upstreamError));
      }
      return [] as Signal[];
    }),
  );
  return pages.flat();
}

export const Route = createFileRoute("/api/public/signals")({
  server: {
    handlers: {
      GET: async () => {
        try {
          // Server-only ingestion + reads use the service-role client, which
          // bypasses RLS. The anon key only has SELECT (and no INSERT) on
          // signal_snapshots, so writing with it fails the RLS policy. This
          // route never ships to the client bundle, so the secret stays server-side.
          const { supabaseAdmin: supabase } = await import("@/integrations/supabase/client.server");

          // Fetch the Telegram channel, but never let an upstream outage take
          // down the whole endpoint: fall back to the signals already stored.
          const [bot, webSignals] = await Promise.all([
            fetchFromBot().catch((botError): BotFetch => {
              console.error("[v0] telegram bot unavailable:", String(botError));
              return { signals: [], ack: null };
            }),
            fetchFromWebPreview(),
          ]);
          const byId = new Map<string, Signal>();
          for (const signal of [...bot.signals, ...webSignals]) {
            if (!byId.has(signal.signalId)) byId.set(signal.signalId, signal);
          }
          const parsed = [...byId.values()];
          const botAck = bot.ack;

          // Insert only new periods. This makes the signal shown to every
          // visitor deterministic and prevents edited Telegram posts from
          // rewriting historical website signals.
          if (parsed.length) {
            const { error: insertError } = await supabase
              .from("signal_snapshots")
              .upsert(
                parsed.map((signal) => ({
                  signal_id: signal.signalId,
                  period: signal.period,
                  source_direction: signal.sourceDirection,
                  website_direction: signal.direction,
                  level: signal.level,
                  source_text: signal.sourceText,
                  posted_at: signal.postedAt,
                })),
                { onConflict: "signal_id", ignoreDuplicates: true },
              );

            if (insertError) throw new Error(insertError.message);
          }

          // Only confirm bot updates once they are safely stored.
          if (botAck) await ackBotUpdates(botAck);

          const { data: stored, error: readError } = await supabase
            .from("signal_snapshots")
            .select(
              "signal_id, period, source_direction, website_direction, level, source_text, posted_at, captured_at",
            )
            .order("posted_at", { ascending: false, nullsFirst: false })
            .limit(100);

          if (readError) throw new Error(readError.message);

          const list = (stored ?? []).map((row) => ({
            signalId: row.signal_id,
            period: row.period,
            sourceDirection: row.source_direction,
            direction: row.website_direction,
            level: row.level,
            sourceText: row.source_text,
            postedAt: row.posted_at,
            capturedAt: row.captured_at,
          }));

          // Newest post first. Periods reset (for example back to 1), so
          // sorting numerically by period made new signals sink to the bottom
          // and the site looked frozen on an old signal.
          list.sort((a, b) => {
            const ta = a.postedAt ? Date.parse(a.postedAt) : 0;
            const tb = b.postedAt ? Date.parse(b.postedAt) : 0;
            if (tb !== ta) return tb - ta;
            return b.capturedAt.localeCompare(a.capturedAt);
          });

          return new Response(JSON.stringify({ list }), {
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          });
        } catch (e) {
          return Response.json({ error: String(e) }, { status: 502 });
        }
      },
    },
  },
});
