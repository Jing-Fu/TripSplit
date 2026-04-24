"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";

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

type User = {
  id: string;
  email: string;
  name: string;
};

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");

  useEffect(() => {
    const bootstrap = async () => {
      const sessionRes = await fetch("/api/auth/session");
      const sessionData = await sessionRes.json();
      setUser(sessionData.user);

      if (!sessionData.user) {
        setTrips([]);
        setLoading(false);
        return;
      }

      const tripsRes = await fetch("/api/trips");
      if (tripsRes.ok) {
        const tripData = await tripsRes.json();
        setTrips(tripData);
      }
      setLoading(false);
    };

    bootstrap();
  }, []);

  const handleJoin = async () => {
    if (!user) {
      router.push("/login");
      return;
    }

    setJoinError("");
    const res = await fetch("/api/trips/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: joinCode.trim() }),
    });

    if (res.ok) {
      const { tripId } = await res.json();
      router.push(`/trips/${tripId}`);
      return;
    }

    const data = await res.json();
    setJoinError(data.error || "邀請碼無效，請重新確認");
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50">
      <header className="sticky top-0 z-10 border-b border-primary-100 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-bold text-primary-600">✈️ TripSplit</h1>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-700">{user.name}</p>
                  <p className="text-xs text-gray-400">{user.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
                >
                  登出
                </button>
                <Link
                  href="/trips/new"
                  className="rounded-2xl bg-primary-500 px-5 py-2.5 font-medium text-white shadow-md shadow-primary-200 transition-colors hover:bg-primary-600"
                >
                  + 新增旅程
                </Link>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-2xl bg-primary-500 px-5 py-2.5 font-medium text-white shadow-md shadow-primary-200 transition-colors hover:bg-primary-600"
              >
                登入後開始使用
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8 rounded-3xl border border-primary-100 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-700">
            🔗 用邀請碼加入旅程
          </h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder={user ? "輸入邀請碼..." : "請先登入後加入旅程"}
              disabled={!user}
              className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:bg-gray-50"
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            />
            <button
              onClick={handleJoin}
              className="rounded-xl bg-accent-500 px-6 py-2.5 font-medium text-white transition-colors hover:bg-accent-600 disabled:bg-accent-300"
              disabled={!user}
            >
              加入
            </button>
          </div>
          {joinError && <p className="mt-2 text-sm text-red-500">{joinError}</p>}
        </div>

        {!user ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-white/70 px-6 py-14 text-center">
            <div className="mb-4 text-5xl">🔐</div>
            <h2 className="text-xl font-semibold text-gray-700">
              先登入，才會看到你參與的旅程
            </h2>
            <p className="mt-2 text-gray-400">
              現在系統已支援身份識別與權限控制，旅程、記帳與結算都會綁定到你的帳號。
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block rounded-2xl bg-primary-500 px-8 py-3 font-medium text-white transition-colors hover:bg-primary-600"
            >
              前往登入
            </Link>
          </div>
        ) : loading ? (
          <div className="py-20 text-center text-gray-400">載入中...</div>
        ) : trips.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mb-4 text-6xl">🌏</div>
            <h2 className="mb-2 text-xl font-semibold text-gray-600">
              還沒有任何旅程
            </h2>
            <p className="mb-6 text-gray-400">建立你的第一趟旅行，開始記帳吧！</p>
            <Link
              href="/trips/new"
              className="inline-block rounded-2xl bg-primary-500 px-8 py-3 font-medium text-white shadow-md shadow-primary-200 transition-colors hover:bg-primary-600"
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
                className="group rounded-3xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:border-primary-200 hover:shadow-md"
              >
                <div className="mb-3 flex items-start justify-between">
                  <span className="text-4xl">{trip.coverEmoji}</span>
                  <span className="rounded-full bg-primary-50 px-3 py-1 text-xs text-primary-600">
                    {trip._count.expenses} 筆
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-800 transition-colors group-hover:text-primary-600">
                  {trip.name}
                </h3>
                {trip.destination && (
                  <p className="mt-0.5 text-sm text-gray-400">📍 {trip.destination}</p>
                )}
                <p className="mt-2 text-sm text-gray-400">
                  {formatDate(trip.startDate)}
                  {trip.endDate && ` ~ ${formatDate(trip.endDate)}`}
                </p>
                <div className="mt-3 flex items-center gap-1.5">
                  {trip.members.slice(0, 4).map((member) => (
                    <span
                      key={member.id}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-100 text-xs font-medium text-accent-700"
                    >
                      {member.name[0]}
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
