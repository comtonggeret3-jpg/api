module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const q = req.query.q || 'axis opok';
  const page = parseInt(req.query.page || '1');
  const target = `https://sfile.co/search?q=${encodeURIComponent(q)}&page=${page}`;

  try {
    const r = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0 Chrome/120", "Referer": "https://sfile.co/" } });
    const html = await r.text();

    let results = []; let seen = new Set();

    // Regex sesuai HTML baru yang kamu kirim
    const regex = /<div class="group px-2[\s\S]*?<img src="([^"]+)"[\s\S]*?<a href="(https:\/\/sfile\.co\/[^"]+)" class="search-result-link[^>]*>([^<]+)<\/a>[\s\S]*?<p class="mt-1[^>]*>([^<]+)<\/p>/gi;

    let m;
    while ((m = regex.exec(html)) !== null) {
      let img = m[1].trim();
      let href = m[2].trim();
      let title = m[3].trim();
      let info = m[4].trim(); // "48.3 KB • 11 Nov 2026"

      if (seen.has(href.toLowerCase())) continue;
      seen.add(href.toLowerCase());

      let size = "Unknown";
      let sizeMatch = info.match(/(\d+(?:\.\d+)?\s*(?:B|KB|MB|GB))/i);
      if (sizeMatch) size = sizeMatch[1];

      if (!img.startsWith('http')) img = 'https://sfile.co' + img;

      results.push({
        file_name: title,
        file_size: size,
        file_url: href,
        file_img: img, // sekarang bakal https://sfile.co/icon/smallicon/hc.svg
        file_info: info
      });
    }

    const data = {
      query: q,
      page,
      source: target,
      total_in_page: results.length,
      pagination: { current_page: page, has_next: results.length>=10, has_prev: page>1, next_page: page+1, prev_page: page>1?page-1:null },
      results
    };

    if (req.query.callback) {
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      return res.send(`${req.query.callback.replace(/[^a-zA-Z0-9_]/g,'')}(${JSON.stringify(data)});`);
    }
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message, results: [] });
  }
};