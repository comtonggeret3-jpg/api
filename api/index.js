module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const q = req.query.q || 'axis opok';
  const page = parseInt(req.query.page || '1');
  const target = `https://sfile.co/search?q=${encodeURIComponent(q)}&page=${page}`;

  try {
    const r = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await r.text();
    let results = [];
    const regex = /<a[^>]+href="(\/[^"]+|https:\/\/sfile[^"]+)"[^>]*>([^<]{5,200})<\/a>/gi;
    let m;
    while ((m = regex.exec(html)) !== null) {
      let href = m[1]; let title = m[2].trim();
      if (!/\d/.test(href) || href.includes('search')) continue;
      if (!href.startsWith('http')) href = 'https://sfile.co' + href;
      if (results.find(x=>x.file_url===href)) continue;
      results.push({ file_name: title, file_size: "Unknown", file_url: href, file_img: null });
      if (results.length >= 15) break;
    }
    const data = { query: q, page, total_in_page: results.length, pagination: { current_page: page, has_next: results.length>=10, has_prev: page>1, next_page: page+1, prev_page: page>1?page-1:null }, results };
    if (req.query.callback) {
      res.setHeader("Content-Type", "application/javascript");
      return res.send(`${req.query.callback.replace(/[^a-zA-Z0-9_]/g,'')}(${JSON.stringify(data)});`);
    }
    res.setHeader("Content-Type", "application/json");
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message, results: [] });
  }
};
