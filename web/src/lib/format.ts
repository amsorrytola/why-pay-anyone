import { format } from "d3-format";

export const pct0 = (n: number) => `${Math.round(n * 100)}%`;
export const pct1 = (n: number) => `${(n * 100).toFixed(1)}%`;
export const mult = (n: number) => (n >= 100 ? `${Math.round(n)}×` : n >= 10 ? `${n.toFixed(1)}×` : `${n.toFixed(2)}×`);
export const int = format(",.0f");
export const compact = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (a >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toFixed(0);
};
export const usd = (n: number) => (n >= 100 ? `$${Math.round(n)}` : n >= 1 ? `$${n.toFixed(2)}` : n >= 0.01 ? `$${n.toFixed(3)}` : `$${n.toFixed(4)}`);
export const usdPerM = (n: number) => `${usd(n)} per million tokens`;
export const monthToYear = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return y + (mo - 0.5) / 12;
};
export const fmtLogTick = (n: number) => {
  if (n >= 1) return `$${format(",.0f")(n)}`;
  if (n >= 0.1) return `$${n.toFixed(1)}`;
  if (n >= 0.01) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(3)}`;
};
