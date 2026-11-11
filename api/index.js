module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const q = req.query.q || 'axis opok';
  const page = parseInt(req.query.page || '1');
  const target = `https://sfile.co/search?q=${encodeURIComponent(q)}&page=${page}`;

  try {
    const r = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0 Chrome/120", "Referer": "https://sfile.co/" } });
    const html = await r.text();

    // 1. AMBIL MAIN - sesuai code PHP kamu: cari Files List
    let mainHtml = html;
    let filesListMatch = html.match(/<!-- Files List -->([\s\S]*?)<!-- Pagination -->/i);
    if (filesListMatch) mainHtml = filesListMatch[1];
    else {
      // fallback cari div divide-y
      let divMatch = html.match(/<div class="divide-y divide-slate-100">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i);
      if (divMatch) mainHtml = divMatch[0];
    }

    let results = []; let seen = {};

    // 2. LIST FILE - parse tiap group px-2
    // split by group yang kamu kirim tadi
    let groups = mainHtml.split('<div class="group px-2');

    for (let g of groups) {
      if (!g.includes('search-result-link')) continue;

      // ambil href dan title
      let aMatch = g.match(/<a href="(https:\/\/sfile\.co\/[^"]+)" class="search-result-link[^>]*>\s*([^<]+?)\s*<\/a>/i);
      if (!aMatch) continue;
      let href = aMatch[1].trim();
      let title = aMatch[2].trim();

      if (title.length < 3) continue;
      if (href.includes('search?q=')) continue;
      let key = title.toLowerCase();
      if (seen[key]) continue;
      seen[key] = true;

      // size dari <p class="mt-1 text-xs text-slate-500">48.3 KB • ...
      let size = "Unknown";
      let sizeMatch = g.match(/<p class="mt-1[^>]*>\s*([^<]+)\s*<\/p>/i);
      if (sizeMatch) {
        let info = sizeMatch[1];
        let s = info.match(/(\d+(?:\.\d+)?\s*(?:B|KB|MB|GB))/i);
        if (s) size = s[1].trim();
      }

            // img - selector paling longgar
      let img = null;
      let imgMatch = g.match(/<img[^>]*src="([^"]+)"/i);
      if (imgMatch) {
        img = imgMatch[1].trim();
        if (!img.startsWith('http') && !img.startsWith('data:')) {
          img = 'https://sfile.co' + (img.startsWith('/') ? '' : '/') + img;
        }
      }

      results.push({
        file_name: title,
        file_size: size,
        file_url: href,
        file_img: img
      });
    }

    if (results.length === 0) {
      return res.json({ error: "selector main tidak match", debug_html_len: html.length, debug_main_len: mainHtml.length, sample: mainHtml.substring(0,500), query: q });
    }

    const data = {
      query: q,
      page,
      total_in_page: results.length,
      pagination: { current_page: page, has_next: results.length >= 10, has_prev: page > 1, next_page: page + 1, prev_page: page > 1 ? page - 1 : null },
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