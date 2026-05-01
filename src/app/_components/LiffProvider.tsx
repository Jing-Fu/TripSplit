"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type LiffMode = "liff" | "web" | "initializing";

interface LiffContextValue {
  mode: LiffMode;
  isReady: boolean;
  error: string | null;
}

const LiffContext = createContext<LiffContextValue>({
  mode: "initializing",
  isReady: false,
  error: null,
});

export function useLiff() {
  return useContext(LiffContext);
}

export function LiffProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mode, setMode] = useState<LiffMode>("initializing");
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) {
      setMode("web");
      setIsReady(true);
      return;
    }

    let cancelled = false;

    async function initLiff() {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId: liffId! });

        if (cancelled) return;

        if (liff.isInClient()) {
          setMode("liff");

          const idToken = liff.getIDToken();
          if (!idToken) {
            liff.login();
            return;
          }

          const sessionRes = await fetch("/api/auth/session", {
            cache: "no-store",
          });
          const sessionData = await sessionRes.json();

          if (!sessionData.user) {
            const res = await fetch("/api/auth/line", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ idToken }),
            });

            if (!res.ok && res.status === 401) {
              liff.login();
              return;
            }

            if (!res.ok) {
              throw new Error("LIFF session bootstrap failed");
            }

            router.refresh();
          }
        } else {
          setMode("web");
        }

        setIsReady(true);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "LIFF init failed");
        setMode("web");
        setIsReady(true);
      }
    }

    void initLiff();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <LiffContext.Provider value={{ mode, isReady, error }}>
      {children}
    </LiffContext.Provider>
  );
}
