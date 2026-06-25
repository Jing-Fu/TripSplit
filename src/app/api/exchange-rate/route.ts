import { NextResponse } from "next/server";

const CACHE: Record<string, { rate: number; timestamp: number }> = {};
const CACHE_TTL = 60 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = (searchParams.get("from") || "USD").toUpperCase();
  const to = (searchParams.get("to") || "TWD").toUpperCase();
  const cacheKey = `${from}_${to}`;

  if (CACHE[cacheKey] && Date.now() - CACHE[cacheKey].timestamp < CACHE_TTL) {
    return NextResponse.json({ rate: CACHE[cacheKey].rate, from, to, cached: true });
  }

  try {
    const res = await fetch(
      `https://api.exchangerate-api.com/v4/latest/${from}`,
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) {
      throw new Error("Exchange rate API error");
    }

    const data = await res.json();
    const rate = data.rates[to];

    if (!rate) {
      return NextResponse.json({ error: `不支援的幣別: ${to}` }, { status: 400 });
    }

    CACHE[cacheKey] = { rate, timestamp: Date.now() };
    return NextResponse.json({ rate, from, to, cached: false });
  } catch {
    const fallbackRatesToTwd: Record<string, number> = {
      TWD: 1,
      USD: 31.5,
      JPY: 0.21,
      KRW: 0.0233,
      EUR: 34.25,
      GBP: 39.9,
      CNY: 4.35,
      HKD: 4.03,
      SGD: 23.4,
      THB: 0.86,
      VND: 0.00124,
    };

    const fromRate = fallbackRatesToTwd[from];
    const toRate = fallbackRatesToTwd[to];
    const rate = fromRate && toRate ? fromRate / toRate : undefined;
    if (rate) {
      return NextResponse.json({ rate, from, to, fallback: true });
    }

    return NextResponse.json({ error: "無法取得匯率" }, { status: 503 });
  }
}
