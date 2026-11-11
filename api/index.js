module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const q = req.query.q || 'axis opok';
  const page = parseInt(req.query.page || '1');
  const target = `https://sfile.co/search?q=${encodeURIComponent(q)}&page=${page}`;

  try {
    const r = await fetch(target, { 
      headers: { 
        "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
        "Referer": "https://sfile.co/",
        "Accept": "text/html"
      } 
    });
    const html = await r.text();

    let results = [];
    let seen = new Set();

    // SFILE pakai div dengan class list, kita split per file
    // cari semua potongan yang ada link file sfile
    const parts = html.split(/<div|<li/g);

    for (let part of parts) {
      if (!part.includes('sfile.co') && !part.includes('/')) continue;
      
      let linkMatch = part.match(/href="(\/[^"]+|https:\/\/sfile\.co[^"]+)"[^>]*>([^<]{5,150})</i);
      if (!linkMatch) continue;

      let href = linkMatch[1];
      let title = linkMatch[2].trim();

      if (!/\d/.test(href)) continue;
      if (href.includes('search') || /next|prev|page/i.test(title)) continue;
      if (!href.startsWith('http')) href = 'https://sfile.co' + href;

      let key = href.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      // FIX SIZE - cari di part yang sama (bukan 400 char, tapi 1 div penuh)
      let size = "Unknown";
      let sizeMatch = part.match(/(\d+(?:\.\d+)?\s*(?:B|KB|MB|GB))/i);
      if (sizeMatch) {
        size = sizeMatch[1].trim();
        // bersihin: kalau cuma "B" doang skip
        if (size.toLowerCase() === 'b') size = "Unknown";
      }

      // FIX IMAGE - cari di part yang sama
      let img = null;
      let imgMatch = part.match(/src="([^"]+\.(?:jpg|jpeg|png|webp|gif))"/i) || part.match(/data-src="([^"]+)"/i);
      if (imgMatch) {
        img = imgMatch[1];
        if (!img.startsWith('http')) img = 'https://sfile.co' + img;
      }

      // file_name bersihin
      if (title.length < 5) continue;

      results.push({
        file_name: title,
        file_size: size,
        file_url: href,
        file_img: img
      });

      if (results.length >= 20) break;
    }

    const data = {
      query: q,
      page: page,
      source: target,
      total_in_page: results.length,
      pagination: {
        current_page: page,
        has_next: results.length >= 10,
        has_prev: page > 1,
        next_page: results.length >= 10 ? page + 1 : null,
        prev_page: page > 1 ? page - 1 : null
      },
      results: results
    };

    if (req.query.callback) {
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      const cb = req.query.callback.replace(/[^a-zA-Z0-9_]/g, '');
      return res.send(`${cb}(${JSON.stringify(data)});`);
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.json(data);

  } catch (e) {
    return res.status(500).json({ error: e.message, results: [] });
  }
};