"use client";

import Script from "next/script";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleAccountsId = {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    use_fedcm_for_button?: boolean;
    ux_mode?: "popup" | "redirect";
    login_uri?: string;
    state?: string;
  }) => void;
  renderButton: (
    element: HTMLElement,
    options: {
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large" | "medium" | "small";
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      shape?: "rectangular" | "pill" | "circle" | "square";
      width?: number;
      locale?: string;
      logo_alignment?: "left" | "center";
    }
  ) => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleAccountsId;
      };
    };
  }
}

export default function LoginPage() {
  const router = useRouter();
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef(false);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [error, setError] = useState("");

  const isIos = useCallback(() => {
    if (typeof navigator === "undefined") return false;

    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }, []);

  const handleCredential = useCallback(
    async (credential: string) => {
      if (!credential) {
        setError("Google 登入憑證遺失，請重新嘗試");
        return;
      }

      setLoading(true);
      setError("");

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });

      const data = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        setError(data?.error || "Google 登入失敗");
        setLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    },
    [router]
  );

  const initializeGoogleButton = useCallback(() => {
    if (
      initializedRef.current ||
      !googleClientId ||
      !buttonRef.current ||
      !window.google?.accounts.id
    ) {
      return;
    }

    const useRedirectMode = isIos();

    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: (response) => {
        void handleCredential(response.credential ?? "");
      },
      use_fedcm_for_button: true,
      ux_mode: useRedirectMode ? "redirect" : "popup",
      login_uri: `${appUrl}/api/auth/login`,
      state: "/",
    });

    buttonRef.current.innerHTML = "";
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "pill",
      width: 320,
      locale: "zh-TW",
      logo_alignment: "left",
    });

    initializedRef.current = true;
    setGoogleReady(true);
  }, [appUrl, googleClientId, handleCredential, isIos]);

  useEffect(() => {
    initializeGoogleButton();
  }, [initializeGoogleButton]);

  useEffect(() => {
    const message = new URLSearchParams(window.location.search).get("error");
    if (message) {
      setError(decodeURIComponent(message));
    }
  }, []);

  const hasGoogleClientId = Boolean(googleClientId);

  return (
    <>
      {hasGoogleClientId && (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onLoad={initializeGoogleButton}
        />
      )}

      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 px-4 py-10">
        <div className="mx-auto max-w-md">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
            ← 返回首頁
          </Link>

          <div className="mt-6 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-bold text-gray-800">使用 Google 登入 TripSplit</h1>
            <p className="mt-2 text-sm text-gray-400">
              你的 Google 帳號會成為 TripSplit 的唯一登入方式。登入成功後，旅程、加入旅程與權限控制仍會沿用目前的帳號身份。
            </p>

            <div className="mt-6 rounded-2xl bg-primary-50 px-4 py-3 text-sm text-primary-700">
              若你的 Google Email 已存在於系統中，TripSplit 會自動綁定原帳號並保留既有顯示名稱。
            </div>

            <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700">
              手機測試時請使用 `npm run dev:lan` 啟動，並將目前瀏覽網址加入 Google Console 的 Authorized JavaScript origins / redirect URIs。
            </div>

            {!hasGoogleClientId ? (
              <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                尚未設定 Google 登入，請先在環境變數加入 <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>。
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="flex min-h-[44px] justify-center" ref={buttonRef} />
                {!googleReady && (
                  <p className="text-center text-sm text-gray-400">正在載入 Google 登入按鈕...</p>
                )}
              </div>
            )}

            {loading && (
              <p className="mt-4 text-center text-sm text-gray-500">Google 驗證中...</p>
            )}

            {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
          </div>
        </div>
      </div>
    </>
  );
}
