"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CURRENCIES, TRIP_EMOJIS } from "@/lib/constants";
import { formatDateForInput } from "@/lib/utils";

export default function NewTripPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
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

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addMember = () => setMembers((prev) => [...prev, ""]);
  const removeMember = (idx: number) =>
    setMembers((prev) => prev.filter((_, i) => i !== idx));
  const updateMember = (idx: number, value: string) =>
    setMembers((prev) => prev.map((m, i) => (i === idx ? value : m)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const validMembers = members.filter((m) => m.trim());
    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        members: validMembers,
      }),
    });

    if (res.ok) {
      const trip = await res.json();
      router.push(`/trips/${trip.id}`);
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-primary-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/"
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← 返回
          </Link>
          <h1 className="text-xl font-bold text-gray-800">🎒 新增旅程</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                旅程圖示
              </label>
              <div className="flex flex-wrap gap-2">
                {TRIP_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => updateField("coverEmoji", emoji)}
                    className={`text-2xl w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                      form.coverEmoji === emoji
                        ? "bg-primary-100 ring-2 ring-primary-400 scale-110"
                        : "bg-gray-50 hover:bg-gray-100"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">
                旅程名稱 *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="例：2024 東京自由行"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">
                目的地
              </label>
              <input
                type="text"
                value={form.destination}
                onChange={(e) => updateField("destination", e.target.value)}
                placeholder="例：東京"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">
                簡述
              </label>
              <textarea
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="旅程備忘..."
                rows={2}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  開始日期 *
                </label>
                <input
                  type="date"
                  required
                  value={form.startDate}
                  onChange={(e) => updateField("startDate", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  結束日期
                </label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => updateField("endDate", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">
                主要幣別
              </label>
              <select
                value={form.currency}
                onChange={(e) => updateField("currency", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.symbol} {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-700">
                👥 旅伴成員
              </h2>
              <button
                type="button"
                onClick={addMember}
                className="text-sm text-primary-500 hover:text-primary-600 font-medium"
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
                    placeholder={`成員 ${idx + 1} 的名字`}
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                  {members.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMember(idx)}
                      className="text-gray-300 hover:text-red-400 transition-colors px-2"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-white py-3.5 rounded-2xl font-semibold text-lg transition-colors shadow-md shadow-primary-200"
          >
            {saving ? "建立中..." : "🚀 建立旅程"}
          </button>
        </form>
      </main>
    </div>
  );
}
