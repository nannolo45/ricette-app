// Expiry dates for pantry items. Dates are plain "YYYY-MM-DD" strings (local day).

export function todayStr(timeZone) {
  // sv-SE formats as YYYY-MM-DD
  return new Date().toLocaleDateString('sv-SE', timeZone ? { timeZone } : undefined);
}

export function daysUntil(dateStr, today = todayStr()) {
  if (!dateStr) return null;
  const a = Date.parse(`${today}T00:00:00Z`);
  const b = Date.parse(`${dateStr}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86400000);
}

// 'expired' | 'soon' | 'ok' | null
export function expiryState(item, defaultDays, today) {
  const d = daysUntil(item.expires, today);
  if (d == null) return null;
  const remind = Number.isFinite(item.remindDays) ? item.remindDays : defaultDays;
  if (d < 0) return 'expired';
  if (d <= remind) return 'soon';
  return 'ok';
}
