module.exports = async function(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  try {
    const mainRes = await fetch('https://danael.fun/create/cloudfront/?lang=en', {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0" }
    });
    if (!mainRes.ok) throw new Error("main fetch failed: " + mainRes.status);
    const html = await mainRes.text();
    
    let servers = [];
    const re = /id="mbps-([^"]+)"/g;
    let m;
    while ((m = re.exec(html)) !== null) { servers.push(m[1]); }
    servers = [...new Set(servers)];
    if (servers.length === 0) servers = ['usa','uk','mexico'];

    const results = await Promise.all(servers.map(async (key) => {
      try {
        const r = await fetch('https://danael.fun/create/cloudfront/mbps.php?server=' + encodeURIComponent(key), {
          headers: { "Referer": "https://danael.fun/create/cloudfront/?lang=en", "User-Agent": "Mozilla/5.0" },
          cache: "no-store"
        });
        const j = await r.json();
        return { server: key, mbps: Number(j.mbps), text: Number(j.mbps).toFixed(1) + " Mbps", ok: true };
      } catch (err) {
        return { server: key, mbps: null, text: "— Mbps", ok: false };
      }
    }));

    if (req.query.html === '1') {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(results.map(s => '<div><strong id="mbps-'+s.server+'">'+(s.mbps!==null?s.mbps.toFixed(1):'—')+'</strong> Mbps <small>'+s.server.toUpperCase()+'</small></div>').join(''));
    }
    res.setHeader("Content-Type","application/json; charset=utf-8");
    return res.status(200).json({ count: results.length, servers: servers, data: results });
  } catch (e) {
    console.error(e);
    res.setHeader("Content-Type","application/json; charset=utf-8");
    return res.status(200).json({ error: e.message, count:0, servers:[], data:[] });
  }
}