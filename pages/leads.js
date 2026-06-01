// GET /api/leads — Airtable lead counts per (client, date).
// Returns: { leadsByKey: { "ClientName|YYYY-MM-DD": billedCount }, fetched_at }
// A lead is "billed" if Lead Cost is a price ($45-$115) — NOT Free/Replacement/Prepay/Unbilled/empty.
// For PROS, ALL leads count (flat retainer).

const BASE_ID = 'appG9APSCkeYOQLbl';
const LEADS_TABLE = 'tblpbVnP4y7YlGcML';
const CLIENTS_TABLE = 'tblTEOPYFNgfE5NdU';

const F = {
  assignedClient: 'fld0jZsUHXQtBWg0C',  // linked record to Clients
  leadCost: 'fldDOfkTeK59hcQou',         // single select
  createdTime: 'fldtSB4pL0xNOX9T4',      // ISO timestamp
};

const BILLED_PRICES = new Set(['$45','$55','$65','$70','$75','$80','$85','$90','$95','$115']);
const PROS_CLIENT_NAME = 'PROS Tree & Landscape (Phoenix)';

async function fetchAll(url, apiKey) {
  const all = [];
  let next = url;
  while (next) {
    const r = await fetch(next, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!r.ok) throw new Error('Airtable ' + r.status + ': ' + await r.text());
    const json = await r.json();
    all.push(...(json.records || []));
    if (json.offset) {
      const u = new URL(url);
      u.searchParams.set('offset', json.offset);
      next = u.toString();
    } else {
      next = null;
    }
  }
  return all;
}

export default async function handler(req, res) {
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'AIRTABLE_API_KEY not set in environment' });
  }

  try {
    // Build clientId → clientName map
    const clientsUrl = `https://api.airtable.com/v0/${BASE_ID}/${CLIENTS_TABLE}?pageSize=100`;
    const clientRecs = await fetchAll(clientsUrl, apiKey);
    const clientNameById = {};
    for (const rec of clientRecs) {
      // Primary field is the company name in your Clients table
      const f = rec.fields || {};
      const name = f['Company Name'] || f['Name'] || rec.id;
      clientNameById[rec.id] = name;
    }

    // Fetch ALL leads — only the fields we need
    const fieldsParam = ['Assigned Client', 'Lead Cost'].map(n => `fields%5B%5D=${encodeURIComponent(n)}`).join('&');
    const leadsUrl = `https://api.airtable.com/v0/${BASE_ID}/${LEADS_TABLE}?pageSize=100&${fieldsParam}`;
    const leadRecs = await fetchAll(leadsUrl, apiKey);

    // Group billed leads by (clientName, YYYY-MM-DD)
    const leadsByKey = {};
    let totalLeads = 0;
    let billedLeads = 0;
    for (const rec of leadRecs) {
      totalLeads++;
      const f = rec.fields || {};
      const linked = f['Assigned Client'];
      // Resolve client name — Airtable returns linked-record IDs in array form
      let clientName = null;
      if (Array.isArray(linked) && linked.length > 0) {
        // linked entries are record IDs, look up names
        const id = linked[0];
        clientName = clientNameById[id] || null;
      }
      if (!clientName) continue;

      const leadCost = f['Lead Cost'] || '';
      const isBilled = BILLED_PRICES.has(leadCost) || clientName === PROS_CLIENT_NAME;
      if (!isBilled) continue;

      const createdISO = rec.createdTime; // e.g. "2026-04-24T14:56:11.000Z"
      if (!createdISO) continue;
      const date = createdISO.slice(0, 10);

      const key = `${clientName}|${date}`;
      leadsByKey[key] = (leadsByKey[key] || 0) + 1;
      billedLeads++;
    }

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({
      leadsByKey,
      stats: { totalLeads, billedLeads, uniqueClients: Object.keys(clientNameById).length },
      fetched_at: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Fetch error', message: String(err) });
  }
}
