// Server-side route. Calls Windsor with the API key, returns JSON to the page.
// The key never reaches the browser — it lives in process.env on Vercel.

export default async function handler(req, res) {
  const apiKey = process.env.WINDSOR_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'WINDSOR_API_KEY not set in environment' });
  }

  const fields = ['date', 'campaign', 'campaign_id', 'spend', 'actions_lead', 'clicks', 'impressions'];
  const url = new URL('https://connectors.windsor.ai/facebook');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('fields', fields.join(','));
  url.searchParams.set('date_preset', 'last_14dT');

  try {
    const r = await fetch(url.toString(), { cache: 'no-store' });
    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: 'Windsor request failed', body: text });
    }
    const json = await r.json();
    // Windsor wraps results in { data: [...] }
    const rows = Array.isArray(json) ? json : (json.data || []);
    // Drop B2B campaigns server-side
    const b2c = rows.filter((row) => !String(row.campaign || '').startsWith('B2B'));
    // Normalize lead field name to "leads" so the front-end stays simple
    const normalized = b2c.map((row) => ({
      date: row.date,
      campaign: row.campaign,
      campaign_id: row.campaign_id,
      spend: Number(row.spend) || 0,
      leads: Number(row.actions_lead) || 0,
      clicks: Number(row.clicks) || 0,
      impressions: Number(row.impressions) || 0,
    }));
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ rows: normalized, fetched_at: new Date().toISOString() });
  } catch (err) {
    return res.status(500).json({ error: 'Fetch error', message: String(err) });
  }
}
