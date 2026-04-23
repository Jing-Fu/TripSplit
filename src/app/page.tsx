"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";

type Trip = {
  id: string;
  name: string;
  destination: string | null;
  startDate: string;
  endDate: string | null;
  currency: string;
  coverEmoji: string;
  inviteCode: string;
  members: { id: string; name: string }[];
  _count: { expenses: number };
};

export default function HomePage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");

  useEffect(() => {
    fetch("/api/trips")
      .then((r) => r.json())
      .then(setTrips)
      .finally(() => setLoading(false));
  }, []);

  const handleJoin = async () => {
    setJoinError("");
    const res = await fetch("/api/trips/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: joinCode }),
    });
    if (res.ok) {
      const { tripId } = await res.json();
      window.location.href = `/trips/${tripId}`;
    } else {
      setJoinError("邀請碼無效，請重新確認");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-primary-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary-600">
            ✈️ TripSplit
          </h1>
          <Link
            href="/trips/new"
            className="bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-2xl font-medium transition-colors shadow-md shadow-primary-200"
          >
            + 新增旅程
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8 bg-white rounded-3xl p-6 shadow-sm border border-primary-100">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">
            🔗 用邀請碼加入旅程
          </h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="輸入邀請碼..."
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            />
            <button
              onClick={handleJoin}
              className="bg-accent-500 hover:bg-accent-600 text-white px-6 py-2.5 rounded-xl font-medium transition-colors"
            >
              加入
            </button>
          </div>
          {joinError && (
            <p className="text-red-500 text-sm mt-2">{joinError}</p>
          )}
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">載入中...</div>
        ) : trips.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🌏</div>
            <h2 className="text-xl font-semibold text-gray-600 mb-2">
              還沒有任何旅程
            </h2>
            <p className="text-gray-400 mb-6">建立你的第一趟旅行，開始記帳吧！</p>
            <Link
              href="/trips/new"
              className="inline-block bg-primary-500 hover:bg-primary-600 text-white px-8 py-3 rounded-2xl font-medium transition-colors shadow-md shadow-primary-200"
            >
              🎒 開始新旅程
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
              <Link
                key={trip.id}
                href={`/trips/${trip.id}`}
                className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-primary-200 transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-4xl">{trip.coverEmoji}</span>
                  <span className="text-xs bg-primary-50 text-primary-600 px-3 py-1 rounded-full">
                    {trip._count.expenses} 筆
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-800 group-hover:text-primary-600 transition-colors">
                  {trip.name}
                </h3>
                {trip.destination && (
                  <p className="text-sm text-gray-400 mt-0.5">
                    📍 {trip.destination}
                  </p>
                )}
                <p className="text-sm text-gray-400 mt-2">
                  {formatDate(trip.startDate)}
                  {trip.endDate && ` ~ ${formatDate(trip.endDate)}`}
                </p>
                <div className="flex items-center gap-1.5 mt-3">
                  {trip.members.slice(0, 4).map((m) => (
                    <span
                      key={m.id}
                      className="w-7 h-7 rounded-full bg-accent-100 text-accent-700 text-xs font-medium flex items-center justify-center"
                    >
                      {m.name[0]}
                    </span>
                  ))}
                  {trip.members.length > 4 && (
                    <span className="text-xs text-gray-400">
                      +{trip.members.length - 4}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
