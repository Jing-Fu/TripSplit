import { NextResponse } from "next/server";

const CACHE: Record<string, { rate: number; timestamp: number }> = {};
const CACHE_TTL = 60 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || "USD";
  const to = searchParams.get("to") || "TWD";
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
    const fallbackRates: Record<string, Record<string, number>> = {
      USD: { TWD: 31.5, JPY: 149.5, KRW: 1350, EUR: 0.92, GBP: 0.79 },
      TWD: { USD: 0.032, JPY: 4.75, KRW: 42.9, EUR: 0.029, GBP: 0.025 },
      JPY: { TWD: 0.21, USD: 0.0067, KRW: 9.03, EUR: 0.0062, GBP: 0.0053 },
    };

    const rate = fallbackRates[from]?.[to];
    if (rate) {
      return NextResponse.json({ rate, from, to, fallback: true });
    }

    return NextResponse.json({ error: "無法取得匯率" }, { status: 503 });
  }
}
