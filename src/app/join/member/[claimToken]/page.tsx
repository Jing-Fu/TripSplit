"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLiff } from "@/app/_components/LiffProvider";

type ClaimData = {
  tripId: string;
  tripName: string;
  tripCoverEmoji: string;
  memberName: string;
  claimed: boolean;
  claimedByViewer: boolean;
  viewerAlreadyJoined: boolean;
  viewerAuthenticated: boolean;
};

export default function MemberClaimPage() {
  const params = useParams();
  const router = useRouter();
  const { isReady } = useLiff();
  const claimToken = params.claimToken as string;
  const [claim, setClaim] = useState<ClaimData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isReady) return;

    const load = async () => {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/member-claims/${claimToken}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setClaim(null);
        setError(data?.error || "找不到這個專屬加入連結");
        setLoading(false);
        return;
      }

      setClaim(data);
      setLoading(false);
    };

    void load();
  }, [claimToken, isReady]);

  const handleClaim = async () => {
    setSubmitting(true);
    setError("");

    const res = await fetch(`/api/member-claims/${claimToken}`, {
      method: "POST",
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setError(data?.error || "認領失敗");
      setSubmitting(false);
      return;
    }

    router.push(`/trips/${data.tripId}`);
  };

  const returnTo = encodeURIComponent(`/join/member/${claimToken}`);

  if (loading) {
    return <div className="py-20 text-center text-gray-400">載入中...</div>;
  }

  if (!claim) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl border border-red-100 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-red-500">{error || "找不到這個專屬加入連結"}</p>
          <Link href="/" className="mt-4 inline-flex rounded-full bg-primary-500 px-5 py-2 text-sm text-white">
            回首頁
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 px-4 py-10">
      <div className="mx-auto max-w-md rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="text-center">
          <div className="text-5xl">{claim.tripCoverEmoji}</div>
          <h1 className="mt-4 text-2xl font-bold text-gray-800">認領你的旅伴身份</h1>
          <p className="mt-2 text-sm text-gray-500">
            你正在加入 <span className="font-medium text-gray-700">{claim.tripName}</span>
          </p>
        </div>

        <div className="mt-6 rounded-2xl bg-accent-50 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-accent-500">專屬身份</p>
          <p className="mt-2 text-lg font-semibold text-accent-800">{claim.memberName}</p>
          <p className="mt-2 text-sm text-accent-700">
            這個連結只用來認領這一個預先建立的旅伴名字，不會再靠 LINE 顯示名稱自動配對。
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-500">
            {error}
          </div>
        )}

        {claim.claimed && !claim.claimedByViewer && (
          <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            這個旅伴身份已經被其他人認領。
          </div>
        )}

        {claim.viewerAlreadyJoined && !claim.claimedByViewer && !claim.claimed && (
          <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            你已經加入這個旅程。如果要改成這個預創身份，需要請建立者協助調整。
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {!claim.viewerAuthenticated ? (
            <Link
              href={`/login?returnTo=${returnTo}`}
              className="inline-flex justify-center rounded-full bg-[#06C755] px-6 py-3 text-sm font-medium text-white"
            >
              先用 LINE 登入再認領
            </Link>
          ) : claim.claimedByViewer ? (
            <button
              onClick={() => router.push(`/trips/${claim.tripId}`)}
              className="rounded-full bg-primary-500 px-6 py-3 text-sm font-medium text-white"
            >
              前往旅程
            </button>
          ) : claim.claimed || claim.viewerAlreadyJoined ? (
            <Link
              href={`/trips/${claim.tripId}`}
              className="inline-flex justify-center rounded-full border border-gray-200 px-6 py-3 text-sm text-gray-600"
            >
              查看旅程
            </Link>
          ) : (
            <button
              onClick={handleClaim}
              disabled={submitting}
              className="rounded-full bg-primary-500 px-6 py-3 text-sm font-medium text-white disabled:bg-primary-300"
            >
              {submitting ? "認領中..." : `以「${claim.memberName}」加入旅程`}
            </button>
          )}

          <Link href="/" className="text-center text-sm text-gray-400 hover:text-gray-600">
            返回首頁
          </Link>
        </div>
      </div>
    </div>
  );
}
