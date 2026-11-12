module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const server = req.query.server || 'cloudfront';
  const jsonMode = req.query.json !== '0';

  try {
    const r = await fetch(`https://danael.fun/create/cloudfront/mbps.php?server=${encodeURIComponent(server)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://danael.fun/create/cloudfront/?lang=en",
        "Cache-Control": "no-store"
      },
      cache: "no-store"
    });
    const data = await r.json(); // { mbps: 123.4 }

    if (jsonMode) {
      res.setHeader("Content-Type", "application/json");
      return res.json({
        server: server,
        mbps: Number(data.mbps),
        text: `${Number(data.mbps).toFixed(1)} Mbps`,
        raw: data
      });
    } else {
      res.setHeader("Content-Type", "text/html");
      return res.send(`<span id="mbps-${server}">${Number(data.mbps).toFixed(1)}</span> Mbps`);
    }

  } catch (e) {
    res.setHeader("Content-Type", "application/json");
    return res.status(500).json({ error: e.message, mbps: null });
  }
};