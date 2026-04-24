"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-TW">
      <body className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <div className="mb-4 text-6xl">😵</div>
          <h2 className="mb-2 text-xl font-bold text-gray-800">發生了意外錯誤</h2>
          <p className="mb-6 text-gray-500 text-sm">
            {error.message || "很抱歉，應用程式遇到了問題。請嘗試重新載入。"}
          </p>
          <button
            onClick={reset}
            className="rounded-2xl bg-blue-500 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-600"
          >
            重新載入
          </button>
        </div>
      </body>
    </html>
  );
}
