"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-4 text-6xl">😵</div>
        <h2 className="mb-2 text-xl font-bold text-gray-800">載入頁面時發生錯誤</h2>
        <p className="mb-6 text-gray-500 text-sm">
          {error.message || "很抱歉，此頁面遇到了問題。請嘗試重新載入。"}
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-2xl bg-blue-500 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-600"
          >
            重新載入
          </button>
          <a
            href="/"
            className="rounded-2xl border border-gray-200 px-6 py-3 font-medium text-gray-500 transition-colors hover:border-gray-300"
          >
            回首頁
          </a>
        </div>
      </div>
    </div>
  );
}
