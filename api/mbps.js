module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  
  try {
    // 1. Ambil halaman utama dulu buat tau daftar server terbaru
    const mainHtmlRes = await fetch('https://danael.fun/create/cloudfront/?lang=en', {
      headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://danael.fun/" }
    });
    const html = await mainHtmlRes.text();

    // 2. Cari semua id="mbps-xxx" -> itu daftar server
    const serverMatches = [...html.matchAll(/id="mbps-([^"]+)"/g)];
    let servers = serverMatches.map(m => m[1].trim()).filter(Boolean);
    
    // Fallback kalau pola berubah, cari di data.servers = { ... }
    if (servers.length === 0) {
      const dataMatch = html.match(/data\.servers\s*=\s*(\{[^}]+\})/);
      if (dataMatch) {
        try { servers = Object.keys(JSON.parse(dataMatch[1].replace(/'/g,'"'))); } catch {}
      }
    }
    
    servers = [...new Set(servers)]; // hilangkan duplikat
    if (servers.length === 0) servers = ['usa','uk','mexico']; // fallback terakhir

    // 3. Poll semua server yang ketemu
    const results = await Promise.all(servers.map(async key => {
      try {
        const r = await fetch(`https://danael.fun/create/cloudfront/mbps.php?server=${encodeURIComponent(key)}`, {
          headers: { "Referer": "https://danael.fun/create/cloudfront/?lang=en", "User-Agent": "Mozilla/5.0" },
          cache: "no-store"
        });
        const j = await r.json();
        return { server: key, mbps: Number(j.mbps), text: `${Number(j.mbps).toFixed(1)} Mbps`, ok: true };
      } catch (e) {
        return { server: key, mbps: null, text: "— Mbps", ok: false, error: e.message };
      }
    }));

    // 4. Output
    if (req.query.html === '1') {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(results.map(s => 
        `<div class="server-traffic"><strong id="mbps-${s.server}">${s.mbps !== null ? s.mbps.toFixed(1) : '—'}</strong><span>Mbps</span><small>${s.server.toUpperCase()}</small></div>`
      ).join('\n'));
    }

    return res.json({
      detected_from: "https://danael.fun/create/cloudfront/",
      count: results.length,
      servers: servers, // <-- daftar server yang ke-detect hari ini
      data: results
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};