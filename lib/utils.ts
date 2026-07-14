/** Join truthy class names — a tiny dependency-free `cn` helper. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/** Format a number as INR-ish currency without external deps. */
export function formatRent(amount: number): string {
  return "₹" + amount.toLocaleString("en-IN");
}

/** Human-readable date (YYYY-MM-DD -> e.g. "10 Jul 2026"). */
export function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
