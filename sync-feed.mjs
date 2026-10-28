#!/usr/bin/env node
// Pulls the next 7 days of games (ESPN public scoreboard) and TV (TVmaze schedule)
// into feed.json next to the prototype. Run daily; the page loads feed.json first.
// Usage: node sync-feed.mjs [days]
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const DAYS = Number(process.argv[2] || 7);
const OUT = fileURLToPath(new URL('./feed.json', import.meta.url));
const TZ = 'America/New_York';

const LEAGUES = [
  ['basketball/nba', 'NBA', ''],
  ['hockey/nhl', 'NHL', ''],
  ['football/nfl', 'NFL', ''],
  ['soccer/eng.1', 'EPL', ''],
  ['basketball/mens-college-basketball', 'CBB', '&groups=50&limit=300'],
  ['basketball/womens-college-basketball', 'WCBB', '&groups=50&limit=300']
];
// TVmaze show ids the prototype has call kinds for
const SHOWS = { 71: 'dwts', 114: 'survivor', 58177: 'traitors', 18: 'race', 70: 'voice', 750: 'rhony', 49980: 'rhoslc', 361: 'snl', 59888: 'kardashians', 253: 'hells', 55350: 'abbott', 67: 'greys', 2900: 'belowdeck' };

const ymd = d => d.toLocaleDateString('en-CA', { timeZone: TZ }).replaceAll('-', '');
const iso = d => d.toLocaleDateString('en-CA', { timeZone: TZ });
const days = Array.from({ length: DAYS }, (_, i) => new Date(Date.now() + i * 86400000));

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'CallIt prototype feed sync' } });
      if (r.ok) return await r.json();
      if (r.status === 429) await new Promise(res => setTimeout(res, 2000 * (i + 1)));
    } catch (_) { /* retry */ }
  }
  return null;
}

function normEspn(ev, lg) {
  const c = ev.competitions?.[0]; if (!c) return null;
  const side = {};
  for (const t of c.competitors) {
    const r = t.curatedRank?.current;
    side[t.homeAway] = { a: t.team.abbreviation, n: t.team.shortDisplayName || t.team.location, c: '#' + (t.team.color || '444444'), s: t.score, rk: r && r < 26 ? r : null };
  }
  if (!side.home || !side.away) return null;
  return { id: ev.id, lg, t: ev.date, st: ev.status.type.state, d: ev.status.type.shortDetail, h: side.home, aw: side.away };
}

async function sports() {
  const out = [];
  for (const [path, lg, extra] of LEAGUES) {
    // one request per day: ESPN rejects some date ranges (NBA answers 400)
    const seen = new Map();
    for (const d of days) {
      const j = await getJson(`https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard?dates=${ymd(d)}${extra}`);
      for (const e of j?.events || []) { const n = normEspn(e, lg); if (n) seen.set(n.id, n); }
    }
    const evs = [...seen.values()];
    // college: ranked teams only, so the feed stays about games people care about
    const keep = lg === 'CBB' || lg === 'WCBB' ? evs.filter(e => e.h.rk || e.aw.rk) : evs;
    console.log(`${lg.padEnd(5)} ${keep.length} games`);
    out.push(...keep);
  }
  return out;
}

async function tv() {
  const out = new Map();
  for (const d of days) {
    for (const kind of ['schedule', 'schedule/web']) {
      const j = await getJson(`https://api.tvmaze.com/${kind}?country=US&date=${iso(d)}`);
      for (const x of j || []) {
        const show = x.show || x._embedded?.show; const key = SHOWS[show?.id]; if (!key) continue;
        const id = `tv-${show.id}-${x.season}-${x.number}`;
        if (!out.has(id)) out.set(id, { show: key, sid: show.id, n: show.name, net: show.network?.name || show.webChannel?.name || '', t: x.airstamp, rt: x.runtime || show.runtime || 60, s: x.season, e: x.number, ep: x.name });
      }
      await new Promise(res => setTimeout(res, 300)); // TVmaze allows about 20 calls per 10 seconds
    }
  }
  console.log(`TV    ${out.size} episodes`);
  return [...out.values()].sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
}

// Wikipedia: yesterday's most-read articles (attention, not prices). Skip site pages, adult topics and
// anything about a recent death, so a trend never becomes a call about someone dying.
const SKIP = /^(Main_Page|Special:|Wikipedia:|Portal:|File:|Help:|Talk:|User:|Category:|Template:|-$)|porn|xxx|sex|onlyfans|nude/i;
async function trends() {
  const d = new Date(Date.now() - 86400000); const [y, m, dd] = iso(d).split('-');
  const j = await getJson(`https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${y}/${m}/${dd}`);
  const out = [];
  for (const a of j?.items?.[0]?.articles || []) {
    if (out.length >= 8) break;
    if (SKIP.test(a.article)) continue;
    const sum = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(a.article)}`);
    const text = `${sum?.description || ''} ${sum?.extract || ''}`;
    if (/\bdied\b|death|killed|shooting|murder|obituar|–20\d\d\)|-20\d\d\)/i.test(text)) continue;
    out.push({ title: a.article.replaceAll('_', ' '), views: a.views, rank: a.rank, desc: sum?.description || '', date: iso(d) });
  }
  console.log(`TREND ${out.length} articles`);
  return out;
}
// Deezer global top 10 (no browser CORS, so the server fetches it)
async function charts() {
  const j = await getJson('https://api.deezer.com/chart/0/tracks?limit=10');
  const out = (j?.data || []).map((t, i) => ({ pos: i + 1, title: t.title_short || t.title, artist: t.artist?.name, id: t.id }));
  console.log(`CHART ${out.length} tracks`);
  return out;
}
// Open-Meteo: New York 7-day forecast, used to settle weather calls
async function weather() {
  const j = await getJson('https://api.open-meteo.com/v1/forecast?latitude=40.78&longitude=-73.97&daily=snowfall_sum,precipitation_probability_max,temperature_2m_min,temperature_2m_max&timezone=America%2FNew_York&forecast_days=7&temperature_unit=fahrenheit');
  const d = j?.daily; if (!d) return null;
  const out = d.time.map((t, i) => ({ date: t, snow_cm: d.snowfall_sum[i], rain_pct: d.precipitation_probability_max[i], lo_f: d.temperature_2m_min[i], hi_f: d.temperature_2m_max[i] }));
  console.log(`WX    ${out.length} days`);
  return { place: 'Central Park, New York', days: out };
}

const feed = { generated_at: new Date().toISOString(), days: DAYS, sources: ['ESPN public scoreboard', 'TVmaze schedule (CC BY-SA)', 'Wikimedia pageviews', 'Deezer chart', 'Open-Meteo'], sports: await sports(), tv: await tv(), trends: await trends(), charts: await charts(), weather: await weather() };
await writeFile(OUT, JSON.stringify(feed));
console.log(`Wrote ${OUT}`);
