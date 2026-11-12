module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method === "OPTIONS") return res.status(200).end();

  const url = req.query.url || '';
  const pathStr = (req.query.path || 'body').toLowerCase();

  if (!url) return res.json({ error: "butuh ?url=...&path=body" });

  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
        "Referer": new URL(url).origin
      }
    });
    const html = await r.text();
    const baseOrigin = new URL(url).origin;

    // === MODE KHUSUS SFILE.CO - ini yang pasti ada hasil (dari contoh kamu yang work) ===
    if (url.includes('sfile.co')) {
      let mainHtml = html;
      let filesListMatch = html.match(/<!-- Files List -->([\s\S]*?)<!-- Pagination -->/i);
      if (filesListMatch) mainHtml = filesListMatch[0];

      let results = [];
      let groups = mainHtml.split('<div class="group px-2');
      
      for (let g of groups) {
        if (!g.includes('search-result-link')) continue;
        let aMatch = g.match(/<a href="(https:\/\/sfile\.co\/[^"]+)" class="search-result-link[^>]*>\s*([^<]+?)\s*<\/a>/i);
        if (!aMatch) continue;
        
        let href = aMatch[1];
        let title = aMatch[2].trim();
        
        // BIKIN FORMAT KAYAK PHP pecah_unlimited
        results.push({
          tag: "a",
          text: title,
          url: href,
          file_name: title,
          file_url: href
        });
      }
      // Kalau path nya body, langsung return
      if (results.length > 0) return res.json(results);
    }

    // === MODE UNIVERSAL (untuk url lain) - PAKAI REGEX SEDERHANA BIAR GAK KOSONG ===
    let totalNodes = 0;
    function pecah_unlimited_simple(htmlChunk) {
      let arr = [];
      // regex paling simple: cari <a href="">
      const aRegex = /<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
      let m;
      while ((m = aRegex.exec(htmlChunk)) !== null) {
        if (totalNodes > 500) break;
        totalNodes++;
        let href = m[1];
        let txt = m[2].trim();
        if (txt.length < 2) continue;
        if (href.startsWith('/')) href = baseOrigin + href;
        arr.push({ tag: "a", text: txt, url: href });
      }
      return arr;
    }

    // getPath sederhana
    let targetHtml = html;
    if (pathStr !== 'body') {
      // kalau path ada .class, filter html yang mengandung class itu
      if (pathStr.startsWith('.')) {
        let cls = pathStr.substring(1);
        let re = new RegExp(`<[^>]*class="[^"]*${cls}[^"]*"[^>]*>[\\s\\S]*?<\\/div>`, 'gi');
        let matches = html.match(re);
        if (matches) targetHtml = matches.join(' ');
      }
    }

    let hasil = pecah_unlimited_simple(targetHtml);
    
    if (hasil.length === 0) {
      // fallback terakhir biar gak kosong: ambil semua tag
      const allTagRegex = /<(a|div|p|h1|h2|h3)[^>]*>([^<]{3,100})<\/(a|div|p|h1|h2|h3)>/gi;
      let m;
      while ((m = allTagRegex.exec(targetHtml)) !== null) {
        if (totalNodes > 200) break;
        totalNodes++;
        hasil.push({ tag: m[1], text: m[2].trim() });
      }
    }

    return res.json(hasil.length ? hasil : [{ info: "html dapet tapi tidak ada <a>", html_length: html.length, sample: html.slice(0,300) }]);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};