module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  try {
    const mainRes = await fetch('https://danael.fun/create/cloudfront/?lang=en', {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    const html = await mainRes.text();
    let servers = [...html.matchAll(/id="mbps-([^"]+)"/g)].map(m=>m[1].trim());
    servers = [...new Set(servers)];
    if(!servers.length) servers = ['usa','uk','mexico'];

    const results = await Promise.all(servers.map(async key => {
      try {
        const r = await fetch(`https://danael.fun/create/cloudfront/mbps.php?server=${encodeURIComponent(key)}`, {
          headers: { "Referer": "https://danael.fun/create/cloudfront/?lang=en", "User-Agent": "Mozilla/5.0" },
          cache: "no-store"
        });
        const j = await r.json();
        return { server:key, mbps:Number(j.mbps), text:`${Number(j.mbps).toFixed(1)} Mbps`, ok:true };
      } catch { return { server:key, mbps:null, text:'— Mbps', ok:false }; }
    }));

    if(req.query.html==='1'){
      res.setHeader("Content-Type","text/html; charset=utf-8");
      return res.send(results.map(s=>`<div class="server-traffic"><strong id="mbps-${s.server}">${s.mbps!==null?s.mbps.toFixed(1):'—'}</strong><span>Mbps</span><small>${s.server.toUpperCase()}</small></div>`).join('\n'));
    }
    return res.json({ count:results.length, servers, data:results });
  } catch(e){ return res.status(500).json({ error:e.message }); }
};