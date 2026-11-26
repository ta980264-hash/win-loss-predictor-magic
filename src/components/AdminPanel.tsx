import { useCallback, useEffect, useState } from "react";
import { listUsers, setVip } from "@/lib/vip.functions";

type Row = {
  telegram_id: string;
  username: string | null;
  first_name: string | null;
  vip_expires_at: string | null;
  last_seen_at: string;
};

export function AdminPanel({ adminId }: { adminId: string }) {
  const [users, setUsers] = useState<Row[]>([]);
  const [manualId, setManualId] = useState("");
  const [manualDays, setManualDays] = useState("7");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await listUsers(adminId);
      setUsers(res.users as Row[]);
    } catch {
      setMsg("Failed to load users");
    }
  }, [adminId]);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = async (
    telegramId: string,
    plan: "1h" | "1m" | "days" | "revoke",
    days?: number,
  ) => {
    if (!telegramId) return;
    if (plan === "days" && (!days || days < 1)) {
      setMsg("Enter number of days");
      return;
    }
    setBusy(telegramId + plan);
    try {
      await setVip({ adminId, telegramId, plan, days });
      setMsg(
        plan === "revoke"
          ? `Removed VIP for ${telegramId}`
          : `VIP granted (${plan === "1h" ? "1 hour" : plan === "1m" ? "1 month" : `${days} days`}) to ${telegramId}`,
      );
      await load();
    } catch {
      setMsg("Action failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section>
      <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-[0.2em] text-gold">
        Admin Panel
      </h2>

      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="font-display text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Grant by Telegram ID
        </p>
        <div className="mt-2 flex gap-2">
          <input
            value={manualId}
            onChange={(e) => setManualId(e.target.value.trim())}
            inputMode="numeric"
            placeholder="e.g. 5471930058"
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 font-display text-sm outline-none focus:border-gold"
          />
          <button
            onClick={() => apply(manualId, "1h")}
            className="rounded-lg bg-primary px-3 py-2 font-display text-xs font-bold text-primary-foreground"
          >
            1 Hour
          </button>
          <button
            onClick={() => apply(manualId, "1m")}
            className="rounded-lg bg-gold px-3 py-2 font-display text-xs font-bold text-background"
          >
            1 Month
          </button>
        </div>

        <p className="mt-4 font-display text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Manual — custom days
        </p>
        <div className="mt-2 flex gap-2">
          <input
            value={manualDays}
            onChange={(e) => setManualDays(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            placeholder="Days e.g. 7"
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 font-display text-sm outline-none focus:border-gold"
          />
          <button
            onClick={() => apply(manualId, "days", Number(manualDays))}
            disabled={busy === manualId + "days"}
            className="rounded-lg bg-gold px-3 py-2 font-display text-xs font-bold text-background disabled:opacity-50"
          >
            Grant Days
          </button>
        </div>

        {msg && <p className="mt-2 text-xs text-muted-foreground">{msg}</p>}
      </div>

      <div className="mt-4 space-y-3">
        {users.length === 0 && (
          <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-sm text-muted-foreground">
            No users yet
          </p>
        )}
        {users.map((u) => {
          const active = u.vip_expires_at && new Date(u.vip_expires_at).getTime() > Date.now();
          return (
            <div key={u.telegram_id} className="rounded-xl border border-border bg-surface p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-bold">
                    {u.first_name ?? "User"}{" "}
                    {u.username && (
                      <span className="text-muted-foreground">@{u.username}</span>
                    )}
                  </p>
                  <p className="font-display text-[11px] text-muted-foreground tabular-nums">
                    ID {u.telegram_id}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-md px-2 py-1 font-display text-[10px] font-bold uppercase ${
                    active ? "bg-success text-success-foreground" : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {active ? "VIP" : "Free"}
                </span>
              </div>
              {active && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Until {new Date(u.vip_expires_at as string).toLocaleString()}
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  disabled={busy === u.telegram_id + "1h"}
                  onClick={() => apply(u.telegram_id, "1h")}
                  className="flex-1 rounded-lg bg-primary px-2 py-2 font-display text-xs font-bold text-primary-foreground disabled:opacity-50"
                >
                  1 Hour
                </button>
                <button
                  disabled={busy === u.telegram_id + "1m"}
                  onClick={() => apply(u.telegram_id, "1m")}
                  className="flex-1 rounded-lg bg-gold px-2 py-2 font-display text-xs font-bold text-background disabled:opacity-50"
                >
                  1 Month
                </button>
                <button
                  disabled={busy === u.telegram_id + "revoke"}
                  onClick={() => apply(u.telegram_id, "revoke")}
                  className="rounded-lg border border-border px-3 py-2 font-display text-xs font-bold text-destructive hover:border-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
