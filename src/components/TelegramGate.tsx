import { useEffect, useState, type ReactNode } from "react";

export type TgUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        initDataUnsafe?: { user?: TgUser };
        colorScheme?: string;
      };
    };
  }
}

const STORE_KEY = "dtp_tg_user";

export function TelegramGate({ children }: { children: (user: TgUser) => ReactNode }) {
  const [user, setUser] = useState<TgUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const initializeTelegram = () => {
      const tg = window.Telegram?.WebApp;
      try {
        tg?.ready();
        tg?.expand();
      } catch {
        /* ignore */
      }
      const tgUser = tg?.initDataUnsafe?.user;
      if (tgUser?.id) {
        setUser(tgUser);
        try {
          localStorage.setItem(STORE_KEY, JSON.stringify(tgUser));
        } catch {
          /* ignore */
        }
      } else {
        try {
          const cached = localStorage.getItem(STORE_KEY);
          if (cached) setUser(JSON.parse(cached) as TgUser);
        } catch {
          /* ignore */
        }
      }
      setReady(true);
    };

    if (window.Telegram?.WebApp) {
      initializeTelegram();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-web-app.js";
    script.async = true;
    script.onload = initializeTelegram;
    script.onerror = initializeTelegram;
    document.head.appendChild(script);

    return () => {
      script.onload = null;
      script.onerror = null;
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="font-display text-sm tracking-[0.2em] text-muted-foreground">
          LOADING...
        </span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-7 text-center shadow-brand">
          <img
            src="https://i.ibb.co/TDnRFdGw/IMG-20260730-162018-470.jpg"
            alt="Dr Thet Pyinn VIP Signals logo"
            className="mx-auto h-20 w-20 rounded-full border border-gold object-cover"
          />
          <h1 className="mt-4 font-display text-xl font-bold">
            Dr Thet Pyinn <span className="text-gold">VIP</span> Signals
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            VIP signals ကြည့်ရန် Telegram account ဖြင့် ဝင်ရောက်ပါ။
          </p>
          <a
            href="https://t.me/formula_1_si"
            className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 font-display text-sm font-bold uppercase tracking-widest text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Open in Telegram
          </a>
          <p className="mt-4 text-xs text-muted-foreground">
            ဒီ site ကို Telegram Mini App ထဲမှာဖွင့်ပါက အလိုအလျောက် login ဝင်ပါမည်။
          </p>
        </div>
      </div>
    );
  }

  return <>{children(user)}</>;
}
