import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { TelegramGate, type TgUser } from "@/components/TelegramGate";
import { SignalsPanel } from "@/components/SignalsPanel";
import { AdminPanel } from "@/components/AdminPanel";

import { VipLocked, VipWelcome } from "@/components/VipNotice";
import { syncUser } from "@/lib/vip.functions";

const LOGO = "https://i.ibb.co/ZRwKk7rf/IMG-20260730-162018-470.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dr Thet Pyinn VIP Signals — Live Signals & Results" },
      {
        name: "description",
        content:
          "Live results, current period, countdown timer and VIP signals from Dr Thet Pyinn VIP Signals.",
      },
      { property: "og:title", content: "Dr Thet Pyinn VIP Signals" },
      {
        property: "og:description",
        content: "Live period, countdown, VIP signals and game history feed.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: LOGO },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: LOGO },
    ],
  }),
  component: Index,
});

type Item = {
  issueNumber: string;
  number: string;
  color: string;
  blockTimestamp: number;
};

type Tab = "signals" | "history" | "admin";

function colorDots(color: string) {
  return color.split(",").map((c) => c.trim());
}

function dotClass(c: string) {
  if (c === "red") return "bg-destructive";
  if (c === "green") return "bg-success";
  if (c === "violet") return "bg-pending";
  return "bg-muted-foreground";
}

function fmtTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-GB", { hour12: false });
}

function fmtDate(ts: number) {
  const d = new Date(ts);
  return d.toISOString().slice(0, 10);
}

function Index() {
  return <TelegramGate>{(user) => <Dashboard user={user} />}</TelegramGate>;
}

function Dashboard({ user }: { user: TgUser }) {
  const [list, setList] = useState<Item[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("signals");
  const [access, setAccess] = useState<{
    isVip: boolean;
    isAdmin: boolean;
    expiresAt: string | null;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const res = await syncUser({
          telegramId: String(user.id),
          username: user.username ?? null,
          firstName: user.first_name ?? null,
          photoUrl: user.photo_url ?? null,
        });
        if (alive) setAccess(res);
      } catch {
        if (alive) setAccess({ isVip: false, isAdmin: false, expiresAt: null });
      }
    };
    check();
    const id = setInterval(check, 60000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [user]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/public/results");
        const json = await res.json();
        if (!alive) return;
        const rows: Item[] = json?.data?.list ?? [];
        setList(rows);
        setError(rows.length ? null : "No data");
      } catch {
        if (alive) setError("Connection failed");
      }
    };
    load();
    const poll = setInterval(load, 5000);
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  const latest = list[0];

  const { period, remaining } = useMemo(() => {
    // The transaction number must always come from the live feed. Never advance
    // it from the local clock: if the upstream pauses, that creates fake periods
    // which can never be matched to a result for WIN/LOSS settlement.
    const rem = 60 - Math.floor((now % 60000) / 1000);
    if (!latest) return { period: "------", remaining: rem };
    const next = String(BigInt(latest.issueNumber) + 1n);
    return { period: next, remaining: rem };
  }, [latest, now]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  const isAdmin = access?.isAdmin ?? false;
  const isVip = access?.isVip ?? false;

  useEffect(() => {
    if (tab === "admin" && access && !isAdmin) setTab("signals");
  }, [tab, access, isAdmin]);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "signals", label: "Signals", icon: "M3 17l6-6 4 4 8-8" },
    { id: "history", label: "History", icon: "M4 6h16M4 12h16M4 18h10" },
    
    ...(isAdmin
      ? [{ id: "admin" as Tab, label: "Admin", icon: "M12 3l8 4v5c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7l8-4z" }]
      : []),
  ];

  return (
    <main className="min-h-screen bg-background pb-24 font-body text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <img
            src={LOGO}
            alt="Dr Thet Pyinn VIP Signals logo"
            className="h-11 w-11 rounded-full border border-gold object-cover"
            loading="eager"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg font-bold tracking-wide">
              Dr Thet Pyinn <span className="text-gold">VIP</span> Signals
            </h1>
          </div>
          <span className="flex max-w-[40%] items-center gap-2 rounded-full border border-border px-2 py-1 text-xs text-muted-foreground">
            {user.photo_url ? (
              <img
                src={user.photo_url}
                alt={user.first_name ?? "user"}
                className="h-5 w-5 rounded-full object-cover"
              />
            ) : (
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            )}
            <span className="truncate text-foreground">
              {user.username ? `@${user.username}` : (user.first_name ?? "VIP")}
            </span>
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-5">
        <section className="mb-5 rounded-xl border border-border bg-surface p-5 shadow-brand">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="font-display text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Current Period
              </p>
              <p className="mt-1 truncate font-display text-xl font-bold text-foreground">
                {period}
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Time Remaining
              </p>
              <p className="font-display text-4xl font-black tabular-nums text-primary">
                {mm}
                <span className="text-gold">:</span>
                {ss}
              </p>
            </div>
          </div>
        </section>

        {access === null ? (
          <p className="py-10 text-center font-display text-sm tracking-[0.2em] text-muted-foreground">
            CHECKING ACCESS...
          </p>
        ) : tab === "admin" && isAdmin ? (
          <AdminPanel adminId={String(user.id)} />
        ) : !isVip ? (
          <VipLocked />
        ) : (
          <>
            <VipWelcome expiresAt={access.expiresAt} />
            {tab === "signals" ? (
              <SignalsPanel />
            ) : (
              <section>
                <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-[0.2em] text-gold">
                  Game History
                </h2>
                <div className="overflow-hidden rounded-xl border border-border">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-primary text-primary-foreground">
                        <th className="px-3 py-3 text-left font-display font-bold">Period</th>
                        <th className="px-3 py-3 text-left font-display font-bold">Time</th>
                        <th className="px-3 py-3 text-center font-display font-bold">No.</th>
                        <th className="px-3 py-3 text-right font-display font-bold">B/S</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="bg-surface px-3 py-6 text-center text-muted-foreground"
                          >
                            {error ?? "Loading live data..."}
                          </td>
                        </tr>
                      )}
                      {list.map((row) => {
                        const n = parseInt(row.number, 10);
                        const big = n >= 5;
                        return (
                          <tr key={row.issueNumber} className="border-t border-border bg-surface">
                            <td className="px-3 py-3 font-display tabular-nums">
                              {row.issueNumber}
                            </td>
                            <td className="px-3 py-3 font-display tabular-nums text-muted-foreground">
                              <div className="text-foreground">{fmtTime(row.blockTimestamp)}</div>
                              <div className="whitespace-nowrap text-xs">
                                {fmtDate(row.blockTimestamp)}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <div
                                className={`font-display text-xl font-bold ${
                                  colorDots(row.color).includes("red")
                                    ? "text-destructive"
                                    : "text-foreground"
                                }`}
                              >
                                {row.number}
                              </div>
                              <div className="mt-1 flex justify-center gap-1">
                                {colorDots(row.color).map((c) => (
                                  <span key={c} className={`h-2 w-2 rounded-full ${dotClass(c)}`} />
                                ))}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-right">
                              <span
                                className={`inline-block rounded-md px-3 py-1 font-display text-xs font-bold ${
                                  big
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-foreground text-background"
                                }`}
                              >
                                {big ? "Big" : "Small"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          © Dr Thet Pyinn VIP Signals
        </p>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 flex-col items-center gap-1 py-3 transition-colors ${
                tab === t.id ? "text-gold" : "text-muted-foreground"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d={t.icon} />
              </svg>
              <span className="font-display text-[11px] font-bold uppercase tracking-widest">
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}
