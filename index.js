import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────
// Per-client revenue rules. To change pricing, edit this object and redeploy.
// ─────────────────────────────────────────────────────────────────────────
const REVENUE_RULES = {
  "(Nico) PROS Tree & Landscape": {
    label: "$1,000/week (flat)",
    revenue: ({ days }) => (days / 7) * 1000,
  },
  "(Ed) Protree Services LLC": {
    label: "$85/lead",
    revenue: ({ leads }) => leads * 85,
  },
  "(Leonardo) HLI Tree Experts": {
    label: "$80/lead",
    revenue: ({ leads }) => leads * 80,
  },
  "(Chris) Five Star Tree Service Long Island": {
    label: "$75/lead",
    revenue: ({ leads }) => leads * 75,
  },
  "(Mario) Arborcare Group": {
    label: "$65/lead",
    revenue: ({ leads }) => leads * 65,
  },
  "(Tomas) Green Leaves Tree Care Corp": {
    label: "$75/lead",
    revenue: ({ leads }) => leads * 75,
  },
  "(Gerald) GBZ Tree LLC": {
    label: "Tiered",
    revenue: ({ leads, lifetimeTotal = leads }) => {
      const lifetimeBefore = lifetimeTotal - leads;
      const tier1Remaining = Math.max(0, 10 - lifetimeBefore);
      const tier1Leads = Math.min(leads, tier1Remaining);
      const tier2Leads = leads - tier1Leads;
      return tier1Leads * 46 + tier2Leads * 70;
    },
  },
  "(Edgar) Vema Tree Service": {
    label: "$90/lead",
    revenue: ({ leads }) => leads * 90,
  },
  "(Cesar) Cesar Tree Service Inc": {
    label: "Paused",
    revenue: () => 0,
    paused: true,
  },
};

const LIFETIME_LEADS = {
  "(Gerald) GBZ Tree LLC": 12,
};

const isClientCampaign = (c) => c.startsWith('(');
const clientFromCampaign = (c) => isClientCampaign(c) ? c.replace(/\s*-\s*Tree Service.*$/, '') : c;

const fmt$ = (n) => '$' + (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt$0 = (n) => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n ?? 0)).toLocaleString();
const fmtSigned$ = (n) => (n >= 0 ? '+' : '−') + '$' + Math.abs(Math.round(n)).toLocaleString();
const fmtPct = (n) => (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
const fmtNum = (n) => (n ?? 0).toLocaleString();
const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const Card = ({ children, style = {} }) => (
  <div style={{
    background: 'white',
    border: '1px solid #e8e3da',
    borderRadius: 14,
    boxShadow: '0 1px 0 rgba(0,0,0,0.02), 0 4px 14px -8px rgba(60,40,20,0.06)',
    ...style,
  }}>{children}</div>
);

const selectBase = {
  width: '100%',
  appearance: 'none',
  background: 'white',
  border: '1px solid #e8e3da',
  borderRadius: 11,
  padding: '10px 34px 10px 13px',
  fontSize: 13.5,
  color: '#1f1b16',
  fontFamily: 'inherit',
  cursor: 'pointer',
  outline: 'none',
};

const Select = ({ value, onChange, options }) => (
  <div style={{ position: 'relative' }}>
    <select value={value} onChange={(e) => onChange(e.target.value)} style={selectBase}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
    <ChevronDown size={15} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: '#8a7d6b', pointerEvents: 'none' }} />
  </div>
);

const DATE_PRESETS = ['Today', 'Last 1 Day', 'Last 3 Days', 'Last 7 Days', 'Last 14 Days', 'Custom…'];

export default function SmartLeadzTracker() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);

  const [datePreset, setDatePreset] = useState('Last 14 Days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [clientFilter, setClientFilter] = useState('All Clients');

  // Fetch live data from our serverless API route on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch('/api/windsor')
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error + (data.message ? ': ' + data.message : ''));
          setLoading(false);
          return;
        }
        const fresh = data.rows || [];
        setRows(fresh);
        setFetchedAt(data.fetched_at);
        if (fresh.length > 0) {
          const latest = fresh.reduce((m, r) => r.date > m ? r.date : m, fresh[0].date);
          setCustomEnd(latest);
          setCustomStart(addDays(latest, -6));
        }
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(String(err));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const latestDate = useMemo(() => {
    if (rows.length === 0) return null;
    return rows.reduce((m, r) => r.date > m ? r.date : m, rows[0].date);
  }, [rows]);
  const earliestDate = useMemo(() => {
    if (rows.length === 0) return null;
    return rows.reduce((m, r) => r.date < m ? r.date : m, rows[0].date);
  }, [rows]);

  const { startDate, endDate, windowDays } = useMemo(() => {
    if (!latestDate) return { startDate: null, endDate: null, windowDays: 0 };
    if (datePreset === 'Custom…') {
      const s = customStart || latestDate;
      const e = customEnd || latestDate;
      const days = (new Date(e) - new Date(s)) / 86400000 + 1;
      return { startDate: s, endDate: e, windowDays: Math.max(1, days) };
    }
    if (datePreset === 'Today') {
      return { startDate: latestDate, endDate: latestDate, windowDays: 1 };
    }
    const map = { 'Last 1 Day': 1, 'Last 3 Days': 3, 'Last 7 Days': 7, 'Last 14 Days': 14 };
    const days = map[datePreset] ?? 14;
    return { startDate: addDays(latestDate, -(days - 1)), endDate: latestDate, windowDays: days };
  }, [datePreset, customStart, customEnd, latestDate]);

  const filteredRows = useMemo(() => {
    if (!startDate || !endDate) return [];
    return rows.filter(r => {
      if (r.date < startDate || r.date > endDate) return false;
      if (clientFilter === 'All Clients') return true;
      return clientFromCampaign(r.campaign) === clientFilter;
    });
  }, [rows, startDate, endDate, clientFilter]);

  const allClients = useMemo(() => {
    const set = new Set(rows.filter(r => isClientCampaign(r.campaign)).map(r => clientFromCampaign(r.campaign)));
    return ['All Clients', ...Array.from(set).sort()];
  }, [rows]);

  const tableRows = useMemo(() => {
    const grouped = {};
    for (const r of filteredRows) {
      if (!grouped[r.campaign]) grouped[r.campaign] = { campaign: r.campaign, spend: 0, leads: 0, clicks: 0, impressions: 0 };
      grouped[r.campaign].spend += r.spend;
      grouped[r.campaign].leads += r.leads;
      grouped[r.campaign].clicks += r.clicks;
      grouped[r.campaign].impressions += r.impressions;
    }
    return Object.values(grouped).map(r => ({
      ...r,
      cpl: r.leads > 0 ? r.spend / r.leads : null,
      ctr: r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0,
      cpc: r.clicks > 0 ? r.spend / r.clicks : 0,
      cpm: r.impressions > 0 ? (r.spend / r.impressions) * 1000 : 0,
      cvr: r.clicks > 0 ? (r.leads / r.clicks) * 100 : 0,
    })).sort((a, b) => b.spend - a.spend);
  }, [filteredRows]);

  const hardKpis = useMemo(() => {
    let spend = 0, leads = 0, revenue = 0;
    let hasRevenueClient = false;
    const perClient = {};
    for (const r of filteredRows) {
      const client = clientFromCampaign(r.campaign);
      if (!perClient[client]) perClient[client] = { spend: 0, leads: 0 };
      perClient[client].spend += r.spend;
      perClient[client].leads += r.leads;
      spend += r.spend;
      leads += r.leads;
    }
    for (const [client, agg] of Object.entries(perClient)) {
      const rule = REVENUE_RULES[client];
      if (!rule) continue;
      if (rule.paused) continue;
      hasRevenueClient = true;
      const lifetimeTotal = LIFETIME_LEADS[client];
      revenue += rule.revenue({ leads: agg.leads, days: windowDays, lifetimeTotal });
    }
    const profit = revenue - spend;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const cpl = leads > 0 ? spend / leads : null;
    const profitPerLead = leads > 0 ? profit / leads : null;
    return { spend, leads, revenue, profit, margin, cpl, profitPerLead, hasRevenueClient };
  }, [filteredRows, windowDays]);

  const softKpis = useMemo(() => {
    const t = filteredRows.reduce((acc, r) => ({
      spend: acc.spend + r.spend, leads: acc.leads + r.leads,
      clicks: acc.clicks + r.clicks, impressions: acc.impressions + r.impressions,
    }), { spend: 0, leads: 0, clicks: 0, impressions: 0 });
    return {
      ctr: t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0,
      cpc: t.clicks > 0 ? t.spend / t.clicks : 0,
      cpl: t.leads > 0 ? t.spend / t.leads : null,
      cpm: t.impressions > 0 ? (t.spend / t.impressions) * 1000 : 0,
      cvr: t.clicks > 0 ? (t.leads / t.clicks) * 100 : 0,
    };
  }, [filteredRows]);

  const lastSyncLabel = fetchedAt
    ? new Date(fetchedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—';

  const windowLabel = (startDate && endDate)
    ? (windowDays === 1
      ? new Date(startDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : `${new Date(startDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(endDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`)
    : '—';

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f4f1ec',
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
      color: '#1f1b16',
      padding: '36px 28px 64px',
      WebkitFontSmoothing: 'antialiased',
    }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>

        <header style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', color: '#8a7d6b', textTransform: 'uppercase', marginBottom: 6 }}>
                SmartLeadz · B2C Performance
              </div>
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', color: '#1f1b16' }}>Tracker</h1>
            </div>
            <div style={{ fontSize: 12, color: '#8a7d6b', textAlign: 'right' }}>
              <div>Live from Windsor.ai · Facebook</div>
              <div style={{ marginTop: 2 }}>{loading ? 'Loading…' : `Fetched: ${lastSyncLabel}`}</div>
            </div>
          </div>
        </header>

        {error && (
          <Card style={{ padding: 16, marginBottom: 18, background: '#f6e6e2', border: '1px solid #e8c8be' }}>
            <div style={{ fontSize: 13, color: '#9a3924', fontWeight: 500 }}>Couldn't load data</div>
            <div style={{ fontSize: 12, color: '#5e5345', marginTop: 4 }}>{error}</div>
          </Card>
        )}

        <Card style={{ padding: 14, marginBottom: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: datePreset === 'Custom…' ? '1fr 1fr 1fr 1.4fr' : '1fr 1.4fr', gap: 10, alignItems: 'center' }}>
            <Select value={datePreset} onChange={setDatePreset} options={DATE_PRESETS} />
            {datePreset === 'Custom…' && (
              <>
                <input type="date" value={customStart} min={earliestDate || undefined} max={latestDate || undefined} onChange={(e) => setCustomStart(e.target.value)} style={{ ...selectBase, padding: '10px 13px', cursor: 'text' }} />
                <input type="date" value={customEnd} min={customStart} max={latestDate || undefined} onChange={(e) => setCustomEnd(e.target.value)} style={{ ...selectBase, padding: '10px 13px', cursor: 'text' }} />
              </>
            )}
            <Select value={clientFilter} onChange={setClientFilter} options={allClients} />
          </div>
          <div style={{ fontSize: 11.5, color: '#8a7d6b', marginTop: 10, paddingLeft: 4 }}>
            Showing {windowLabel} · {windowDays} day{windowDays !== 1 ? 's' : ''}{clientFilter !== 'All Clients' ? ` · ${clientFilter}` : ''}
          </div>
        </Card>

        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', color: '#8a7d6b', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 4 }}>
            Hard Metrics
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 18 }}>
            <KpiCompact label="Spend" value={fmt$0(hardKpis.spend)} />
            <KpiCompact label="Revenue" value={hardKpis.hasRevenueClient ? fmt$0(hardKpis.revenue) : '—'} muted={!hardKpis.hasRevenueClient} />
            <KpiCompact label="CPL" value={hardKpis.cpl != null ? fmt$(hardKpis.cpl) : '—'} accent sub={`${hardKpis.leads} leads`} />
            <KpiCompact label="Profit / Lead" value={hardKpis.profitPerLead != null ? fmtSigned$(hardKpis.profitPerLead) : '—'} tone={hardKpis.profitPerLead == null ? 'neutral' : hardKpis.profitPerLead >= 0 ? 'good' : 'bad'} />
            <KpiCompact label="Margin" value={hardKpis.hasRevenueClient ? fmtPct(hardKpis.margin) : '—'} tone={!hardKpis.hasRevenueClient ? 'neutral' : hardKpis.margin >= 0 ? 'good' : 'bad'} sub={hardKpis.hasRevenueClient ? `${fmtSigned$(hardKpis.profit)} profit` : null} />
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', color: '#8a7d6b', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 4 }}>
            Soft Metrics
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            <KpiCompact label="CTR" value={softKpis.ctr.toFixed(2) + '%'} dim />
            <KpiCompact label="CPC" value={fmt$(softKpis.cpc)} dim />
            <KpiCompact label="CPL" value={softKpis.cpl != null ? fmt$(softKpis.cpl) : '—'} dim />
            <KpiCompact label="CPM" value={fmt$(softKpis.cpm)} dim />
            <KpiCompact label="CVR" value={softKpis.cvr.toFixed(2) + '%'} dim sub="leads / clicks" />
          </div>
        </div>

        <Card style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #f1ece4' }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1f1b16' }}>Performance by Campaign</h2>
            <div style={{ fontSize: 11.5, color: '#8a7d6b', marginTop: 2 }}>
              {tableRows.length} campaign{tableRows.length !== 1 ? 's' : ''} · {windowLabel}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: '#faf7f1' }}>
                  <Th>Campaign</Th>
                  <Th align="right">Spend</Th>
                  <Th align="right">Leads</Th>
                  <Th align="right">CPL</Th>
                  <Th align="right">Clicks</Th>
                  <Th align="right">CPC</Th>
                  <Th align="right">CTR</Th>
                  <Th align="right">CPM</Th>
                  <Th align="right">CVR</Th>
                  <Th align="right">Impressions</Th>
                </tr>
              </thead>
              <tbody>
                {loading && (<tr><td colSpan={10} style={{ padding: 28, textAlign: 'center', color: '#8a7d6b' }}>Loading…</td></tr>)}
                {!loading && tableRows.length === 0 && (<tr><td colSpan={10} style={{ padding: 28, textAlign: 'center', color: '#8a7d6b' }}>No rows match the current filters.</td></tr>)}
                {tableRows.map((r, i) => {
                  const tier = (r.leads === 0) ? 'bad' : (r.cpl <= 20 ? 'good' : r.cpl <= 35 ? 'warn' : 'bad');
                  return (
                    <tr key={r.campaign} style={{ borderTop: i === 0 ? 'none' : '1px solid #f4efe7' }}>
                      <Td style={{ fontWeight: 500, color: '#1f1b16', whiteSpace: 'nowrap' }}>{clientFromCampaign(r.campaign)}</Td>
                      <Td align="right">{fmt$(r.spend)}</Td>
                      <Td align="right" style={{ color: r.leads === 0 ? '#b94a3b' : '#1f1b16', fontWeight: r.leads === 0 ? 500 : 400 }}>{r.leads}</Td>
                      <Td align="right"><CplPill tier={tier} value={r.cpl} leads={r.leads} /></Td>
                      <Td align="right">{fmtNum(r.clicks)}</Td>
                      <Td align="right">{fmt$(r.cpc)}</Td>
                      <Td align="right">{r.ctr.toFixed(2)}%</Td>
                      <Td align="right">{fmt$(r.cpm)}</Td>
                      <Td align="right">{r.cvr.toFixed(2)}%</Td>
                      <Td align="right">{fmtNum(r.impressions)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div style={{ fontSize: 11, color: '#a99c87', textAlign: 'center', marginTop: 28, lineHeight: 1.7 }}>
          Live from Windsor.ai — refreshes on every page load. B2C campaigns only.<br />
          Pricing: Ed $85, HLI $80, Five Star $75, Arborcare $65, Green Leaves $75, Vema $90, PROS $1k/week, GBZ tiered.
        </div>
      </div>
    </div>
  );
}

const KpiCompact = ({ label, value, sub, accent, tone = 'default', dim = false, muted = false }) => {
  const palette = (() => {
    if (accent) return { bg: '#e8e4ff', border: '#d4ccff', labelColor: '#4c3fb5', valueColor: '#1f1b16', subColor: '#4c3fb5' };
    if (tone === 'good') return { bg: '#e8f3e3', border: '#c8e0bc', labelColor: '#3a6b29', valueColor: '#1f1b16', subColor: '#3a6b29' };
    if (tone === 'bad')  return { bg: '#f6e6e2', border: '#e8c8be', labelColor: '#9a3924', valueColor: '#1f1b16', subColor: '#9a3924' };
    return { bg: 'white', border: '#e8e3da', labelColor: '#8a7d6b', valueColor: muted ? '#a99c87' : '#1f1b16', subColor: '#8a7d6b' };
  })();
  return (
    <Card style={{ padding: '12px 14px', background: palette.bg, border: `1px solid ${palette.border}`, minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', color: palette.labelColor, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: dim ? 18 : 20, fontWeight: 600, color: palette.valueColor, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: palette.subColor, marginTop: 3 }}>{sub}</div>}
    </Card>
  );
};

const Th = ({ children, align = 'left' }) => (
  <th style={{ textAlign: align, padding: '10px 14px', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8a7d6b', borderBottom: '1px solid #efe9e0', whiteSpace: 'nowrap' }}>{children}</th>
);

const Td = ({ children, align = 'left', style = {} }) => (
  <td style={{ padding: '10px 14px', textAlign: align, color: '#3a3128', fontVariantNumeric: 'tabular-nums', ...style }}>{children}</td>
);

const CplPill = ({ tier, value, leads }) => {
  if (leads === 0) return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, background: '#f6e6e2', color: '#9a3924', fontSize: 11.5, fontWeight: 500 }}>—</span>;
  const styles = { good: { bg: '#e8f3e3', fg: '#3a6b29' }, warn: { bg: '#fdf2dc', fg: '#8a6310' }, bad: { bg: '#f6e6e2', fg: '#9a3924' } }[tier];
  return (<span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, background: styles.bg, color: styles.fg, fontSize: 11.5, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{fmt$(value)}</span>);
};
