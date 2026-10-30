// "Open until 12:30", "Opens at 15:30", "Opens Mon 08:00", "Always open": from the opening hours (shops.js openOn).
import { openOn } from './shops.js';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Where a shop stands at `now` (a Date):
 *   {state: 'always'} | {state: 'open', until} | {state: 'later', at} (today) |
 *   {state: 'next', date, at} (another day within a week) | {state: 'closed'} (nothing in the next 7 days)
 * Times are minutes from midnight.
 */
export function shopStatus(shop, now = new Date()) {
  const today = iso(now);
  const minute = now.getHours() * 60 + now.getMinutes();
  const todays = openOn(shop, today);
  if (todays === null) return { state: 'always' };
  const cur = todays.find(([f, t]) => minute >= f && minute < t);
  if (cur) {
    // back-to-back ranges (8–12, 12–14) count as one
    let until = cur[1];
    for (const [f, t] of todays) if (f <= until && t > until) until = t;
    return { state: 'open', until };
  }
  const later = todays.find(([f]) => f > minute);
  if (later) return { state: 'later', at: later[0] };
  for (let k = 1; k <= 7; k++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k);
    const r = openOn(shop, iso(d));
    if (r && r.length) return { state: 'next', date: iso(d), at: r[0][0] };
  }
  return { state: 'closed' };
}
