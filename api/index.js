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
    const parts = html.split(/<div|<li/g);

    for (let part of parts) {
      if (!part.includes('sfile.co')) continue;
      let linkMatch = part.match(/href="(\/[^"]+|https:\/\/sfile\.co[^"]+)"[^>]*>([^<]{5,150})</i);
      if (!linkMatch) continue;
      let href = linkMatch[1]; let title = linkMatch[2].trim();
      if (!/\d/.test(href) || href.includes('search') || /next|prev/i.test(title)) continue;
      if (!href.startsWith('http')) href = 'https://sfile.co' + href;
      let key = href.toLowerCase(); if (seen.has(key)) continue; seen.add(key);

      let size = "Unknown";
      let sizeMatch = part.match(/(\d+(?:\.\d+)?\s*(?:B|KB|MB|GB))/i);
      if (sizeMatch) size = sizeMatch[1].trim();

      // SELECTOR IMG LENGKAP - semua kemungkinan
      let img = null;
      let imgSelectors = [
        /<img[^>]+data-src="([^"]+)"/i,
        /<img[^>]+data-original="([^"]+)"/i,
        /<img[^>]+data-lazy-src="([^"]+)"/i,
        /<img[^>]+src="([^"]+)"/i,
        /<source[^>]+srcset="([^"]+)"/i,
        /background-image:\s*url\(['"]?([^'")]+)['"]?\)/i
      ];
      for (let sel of imgSelectors) {
        let m = part.match(sel);
        if (m && m[1]) {
          img = m[1].split(' ')[0].split(',')[0]; // ambil url pertama kalau srcset
          if (img.includes('data:image') || img.includes('blank.gif') || img.includes('lazy')) continue;
          if (!img.startsWith('http')) img = 'https://sfile.co' + img;
          break;
        }
      }

      if (title.length < 5) continue;
      results.push({ file_name: title, file_size: size, file_url: href, file_img: img });
      if (results.length >= 20) break;
    }

    const data = { query: q, page, total_in_page: results.length, pagination: { current_page: page, has_next: results.length>=10, has_prev: page>1, next_page: page+1, prev_page: page>1?page-1:null }, results };
    if (req.query.callback) {
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      return res.send(`${req.query.callback.replace(/[^a-zA-Z0-9_]/g,'')}(${JSON.stringify(data)});`);
    }
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message, results: [] }); }
};