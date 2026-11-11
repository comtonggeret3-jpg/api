module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const q = req.query.q || 'axis opok';
  const page = parseInt(req.query.page || '1');
  const target = `https://sfile.co/search?q=${encodeURIComponent(q)}&page=${page}`;

  try {
    const r = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0 Chrome/120", "Referer": "https://sfile.co/" } });
    const html = await r.text();

    // 1. AMBIL MAIN - Files List
    let mainHtml = html;
    let filesListMatch = html.match(/<!-- Files List -->([\s\S]*?)<!-- Pagination -->/i);
    if (filesListMatch) mainHtml = filesListMatch[0];
    
    // SIMPAN HTML ATAS UNTUK TOTAL - total ada di atas Files List
    let headerHtml = html;

    let results = []; let seen = {};
    let groups = mainHtml.split('<div class="group px-2');

    for (let g of groups) {
      if (!g.includes('search-result-link')) continue;
      let aMatch = g.match(/<a href="(https:\/\/sfile\.co\/[^"]+)" class="search-result-link[^>]*>\s*([^<]+?)\s*<\/a>/i);
      if (!aMatch) continue;
      let href = aMatch[1].trim();
      let title = aMatch[2].trim();
      if (title.length < 3 || href.includes('search?q=')) continue;
      let key = title.toLowerCase(); if (seen[key]) continue; seen[key] = true;

      let size = "Unknown";
      let sizeMatch = g.match(/<p class="mt-1[^>]*>\s*([^<]+)\s*<\/p>/i);
      if (sizeMatch) {
        let s = sizeMatch[1].match(/(\d+(?:\.\d+)?\s*(?:B|KB|MB|GB))/i);
        if (s) size = s[1].trim();
      }

      let img = null;
      let imgMatch = g.match(/<img[^>]*src="([^"]+)"/i);
      if (imgMatch) img = imgMatch[1].trim();

      results.push({ file_name: title, file_size: size, file_url: href, file_img: img });
    }

    // 2. TOTAL HASIL - REVISI SESUAI HTML KAMU
    let total_text = null;
    let total_number = 0;

    // selector baru: <h1 class="text-2xl font-bold text-white">60 results for "axis"</h1>
    let h1Match = headerHtml.match(/<h1[^>]*>\s*(\d+)\s+results for[^<]*<\/h1>/i);
    if (h1Match) {
      total_number = parseInt(h1Match[1]);
      total_text = h1Match[0].replace(/<[^>]+>/g, '').trim(); // "60 results for "axis""
    }

    // fallback: Showing 21-40 of 60 results
    if (total_number === 0) {
      let showingMatch = headerHtml.match(/Showing\s+\d+-\d+\s+of\s+(\d+)\s+results/i);
      if (showingMatch) {
        total_number = parseInt(showingMatch[1]);
        total_text = showingMatch[0];
      }
    }

    // fallback lama
    if (total_number === 0) {
      let oldMatch = headerHtml.match(/Found\s+(\d+)\s+files|(\d+)\s+results/i);
      if (oldMatch) {
        total_number = parseInt(oldMatch[1] || oldMatch[2]);
        total_text = oldMatch[0];
      }
    }

    // 3. PAGINATION - dari HTML kamu: Page 2 of 3
    let has_next = false;
    let total_pages = 0;
    let pageMatch = headerHtml.match(/Page\s+(\d+)\s+of\s+(\d+)/i);
    if (pageMatch) {
      let cur = parseInt(pageMatch[1]);
      total_pages = parseInt(pageMatch[2]);
      has_next = cur < total_pages;
    } else {
      // fallback kalau gak ada Page X of Y, cek kalau result 20 berarti masih ada next
      has_next = results.length >= 20;
    }

    const data = {
      query: q,
      page: page,
      source: target,
      total_results_text: total_text || (total_number ? total_number + ' results for "'+q+'"' : null),
      total_results_number: total_number,
      total_pages: total_pages || (total_number ? Math.ceil(total_number / 20) : null),
      pagination: {
        current_page: page,
        has_next: has_next,
        has_prev: page > 1,
        next_page: has_next ? page + 1 : null,
        prev_page: page > 1 ? page - 1 : null,
        next_url: has_next ? `https://${req.headers.host}/api?q=${encodeURIComponent(q)}&page=${page+1}` : null,
        prev_url: page > 1 ? `https://${req.headers.host}/api?q=${encodeURIComponent(q)}&page=${page-1}` : null
      },
      total_in_page: results.length,
      results: results
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