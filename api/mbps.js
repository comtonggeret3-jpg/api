module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const servers = ['usa','uk','mexico'];
  const wantHtml = req.query.html === '1';

  try {
    const results = await Promise.all(servers.map(async key => {
      try {
        const r = await fetch(`https://danael.fun/create/cloudfront/mbps.php?server=${key}`, {
          headers: { "Referer": "https://danael.fun/create/cloudfront/?lang=en", "User-Agent": "Mozilla/5.0" },
          cache: "no-store"
        });
        const j = await r.json();
        return { server: key, mbps: Number(j.mbps), text: `${Number(j.mbps).toFixed(1)} Mbps` };
      } catch { return { server: key, mbps: null, text: "— Mbps" }; }
    }));

    if (wantHtml) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      const html = results.map(s => 
        `<div class="server-traffic"><strong id="mbps-${s.server}">${s.mbps !== null ? s.mbps.toFixed(1) : '—'}</strong><span>Mbps</span><small>${s.server.toUpperCase()}</small></div>`
      ).join('\n');
      return res.send(html);
    } else {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.json({
        count: results.length,
        data: results,
        // buat gampang manggil yang lama: usa, uk, mexico
        usa: results.find(x=>x.server==='usa'),
        uk: results.find(x=>x.server==='uk'),
        mexico: results.find(x=>x.server==='mexico')
      });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};