"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const [error, setError] = useState("");

  useEffect(() => {
    const message = new URLSearchParams(window.location.search).get("error");
    if (message) {
      setError(decodeURIComponent(message));
    }
  }, []);

  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  const lineLoginUrl = liffId
    ? `https://liff.line.me/${liffId}`
    : "#";

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 px-4 py-10">
      <div className="mx-auto max-w-md">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
          ← 返回首頁
        </Link>

        <div className="mt-6 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-800">登入 TripSplit</h1>
          <p className="mt-2 text-sm text-gray-400">
            使用 LINE 帳號登入，開始管理你的旅遊分帳。
          </p>

          <div className="mt-6">
            <a
              href={lineLoginUrl}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#06C755] px-6 py-3 text-white font-medium hover:bg-[#05b34c] transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
              </svg>
              使用 LINE 登入
            </a>
          </div>

          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
        </div>
      </div>
    </div>
  );
}
