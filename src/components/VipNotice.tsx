const LOCK_IMG = "https://i.ibb.co/M0d0b90/file-00000000761c820b8ab63dbcb68674f8.png";
const WELCOME_IMG = "https://i.ibb.co/PZ85sz4V/file-00000000888c81faaf389bdf2f54ade2.png";

const OWNER_TG = "5471930058";

export function VipLocked() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 text-center shadow-brand">
      <img
        src={LOCK_IMG}
        alt="VIP members only"
        className="mx-auto w-full rounded-xl object-cover"
      />
      <h2 className="mt-4 font-display text-lg font-bold text-gold">VIP Members Only</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        ဒီ signals တွေကို VIP member များသာ ကြည့်ရှုနိုင်ပါသည်။ VIP ရယူရန် owner ကို
        ဆက်သွယ်ပါ။
      </p>
      <a
        href={`tg://user?id=${OWNER_TG}`}
        className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 font-display text-sm font-bold uppercase tracking-widest text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Contact Owner for VIP
      </a>
      <p className="mt-3 font-display text-xs text-muted-foreground">
        Telegram ID: {OWNER_TG}
      </p>
    </div>
  );
}

export function VipWelcome({ expiresAt }: { expiresAt: string | null }) {
  return (
    <div className="mb-5 overflow-hidden rounded-2xl border border-border bg-surface text-center shadow-brand">
      <img src={WELCOME_IMG} alt="VIP member welcome" className="w-full object-cover" />
      <div className="px-4 py-3">
        <p className="font-display text-sm font-bold text-gold">
          VIP member ဖြစ်ပါပြီ — ကြိုဆိုပါတယ်!
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {expiresAt
            ? `Access valid until ${new Date(expiresAt).toLocaleString()}`
            : "Unlimited access"}
        </p>
      </div>
    </div>
  );
}
