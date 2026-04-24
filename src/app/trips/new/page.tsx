"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CURRENCIES, TRIP_EMOJIS } from "@/lib/constants";
import { formatDateForInput } from "@/lib/utils";

type User = {
  id: string;
  email: string;
  name: string;
};

export default function NewTripPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    destination: "",
    startDate: formatDateForInput(new Date()),
    endDate: "",
    currency: "TWD",
    coverEmoji: "✈️",
  });
  const [members, setMembers] = useState<string[]>([""]);

  useEffect(() => {
    const bootstrap = async () => {
      const res = await fetch("/api/auth/session");
      const data = await res.json();

      if (!data.user) {
        router.replace("/login");
        return;
      }

      setUser(data.user);
      setCheckingAuth(false);
    };

    bootstrap();
  }, [router]);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addMember = () => setMembers((prev) => [...prev, ""]);
  const removeMember = (idx: number) =>
    setMembers((prev) => prev.filter((_, i) => i !== idx));
  const updateMember = (idx: number, value: string) =>
    setMembers((prev) => prev.map((member, i) => (i === idx ? value : member)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const validMembers = members.filter((member) => member.trim());
    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        members: validMembers,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "建立旅程失敗");
      setSaving(false);
      return;
    }

    router.push(`/trips/${data.id}`);
  };

  if (checkingAuth) {
    return <div className="py-20 text-center text-gray-400">登入狀態確認中...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50">
      <header className="sticky top-0 z-10 border-b border-primary-100 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-4 py-4">
          <Link href="/" className="text-gray-400 transition-colors hover:text-gray-600">
            ← 返回
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-800">🎒 新增旅程</h1>
            {user && <p className="text-xs text-gray-400">建立者：{user.name}</p>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-5 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="rounded-2xl bg-primary-50 px-4 py-3 text-sm text-primary-700">
              你會自動成為旅程建立者與第一位成員，下面只需要補其他旅伴即可。
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-600">
                旅程圖示
              </label>
              <div className="flex flex-wrap gap-2">
                {TRIP_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => updateField("coverEmoji", emoji)}
                    className={`flex h-11 w-11 items-center justify-center rounded-xl text-2xl transition-all ${
                      form.coverEmoji === emoji
                        ? "scale-110 bg-primary-100 ring-2 ring-primary-400"
                        : "bg-gray-50 hover:bg-gray-100"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-600">
                旅程名稱 *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="例：2026 東京自由行"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-600">
                目的地
              </label>
              <input
                type="text"
                value={form.destination}
                onChange={(e) => updateField("destination", e.target.value)}
                placeholder="例：東京"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-600">
                簡述
              </label>
              <textarea
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="旅程備忘..."
                rows={2}
                className="w-full resize-none rounded-xl border border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-600">
                  開始日期 *
                </label>
                <input
                  type="date"
                  required
                  value={form.startDate}
                  onChange={(e) => updateField("startDate", e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-600">
                  結束日期
                </label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => updateField("endDate", e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-600">
                主要幣別
              </label>
              <select
                value={form.currency}
                onChange={(e) => updateField("currency", e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.symbol} {currency.name} ({currency.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-700">👥 其他旅伴</h2>
                <p className="text-xs text-gray-400">你的身份會由系統自動加入，不需要重複輸入。</p>
              </div>
              <button
                type="button"
                onClick={addMember}
                className="text-sm font-medium text-primary-500 hover:text-primary-600"
              >
                + 新增成員
              </button>
            </div>

            <div className="space-y-3">
              {members.map((member, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    value={member}
                    onChange={(e) => updateMember(idx, e.target.value)}
                    placeholder={`旅伴 ${idx + 1} 的名字`}
                    className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                  {members.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMember(idx)}
                      className="px-2 text-gray-300 transition-colors hover:text-red-400"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-2xl bg-primary-500 py-3.5 text-lg font-semibold text-white shadow-md shadow-primary-200 transition-colors hover:bg-primary-600 disabled:bg-primary-300"
          >
            {saving ? "建立中..." : "🚀 建立旅程"}
          </button>
        </form>
      </main>
    </div>
  );
}
