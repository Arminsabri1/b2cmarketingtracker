// GET /api/windsor — Facebook ad metrics by day, all-time.

export default async function handler(req, res) {
  const apiKey = process.env.WINDSOR_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'WINDSOR_API_KEY not set in environment' });
  }

  // Pull all-time. Windsor needs an explicit range — picking a very wide window
  // (Jan 1, 2024 → today) is effectively all-time for this account.
  const dateTo = new Date().toISOString().slice(0, 10);
  const dateFrom = '2024-01-01';

  const url = `https://connectors.windsor.ai/facebook?api_key=${apiKey}` +
    `&fields=date,campaign,campaign_id,spend,actions_lead,clicks,impressions` +
    `&date_from=${dateFrom}&date_to=${dateTo}`;

  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: 'Windsor request failed', body: text.slice(0, 500) });
    }
    const json = await r.json();
    const raw = json.data || [];
    // Filter out B2B campaigns, normalize actions_lead → leads
    const rows = raw
      .filter(r => r.campaign && !r.campaign.toLowerCase().includes('b2b'))
      .map(r => ({
        date: r.date,
        campaign: r.campaign,
        campaign_id: r.campaign_id,
        spend: Number(r.spend) || 0,
        leads: Number(r.actions_lead) || 0,
        clicks: Number(r.clicks) || 0,
        impressions: Number(r.impressions) || 0,
      }));
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ rows, fetched_at: new Date().toISOString() });
  } catch (err) {
    return res.status(500).json({ error: 'Fetch error', message: String(err) });
  }
}
