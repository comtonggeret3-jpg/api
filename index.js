export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const q = req.query.q || 'axis opok';
  const page = parseInt(req.query.page || '1');
  const callback = req.query.callback;
  const target = `https://sfile.co/search?q=${encodeURIComponent(q)}&page=${page}`;

  try {
    const r = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://sfile.co/" } });
    const html = await r.text();

    let mainHtml = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
    let results = [];
    let seen = {};

    let regex = /<a[^>]+href="([^"]+)"[^>]*>([^<]{5,200})<\/a>/gi, m;
    while ((m = regex.exec(mainHtml)) !== null) {
      let href = m[1]; let title = m[2].trim();
      if (!/\d/.test(href) || href.includes('search')) continue;
      if (!href.startsWith('http')) href = 'https://sfile.co' + href;
      let key = title.toLowerCase();
      if (seen[key]) continue;
      seen[key] = true;

      let sizeMatch = mainHtml.substring(m.index, m.index+300).match(/(\d+(\.\d+)?\s*(B|KB|MB|GB))/i);
      let imgMatch = mainHtml.substring(m.index-200, m.index+300).match(/<img[^>]+src="([^"]+)"/i);

      results.push({
        file_name: title,
        file_size: sizeMatch ? sizeMatch[1] : "Unknown",
        file_url: href,
        file_img: imgMatch ? (imgMatch[1].startsWith('http') ? imgMatch[1] : 'https://sfile.co'+imgMatch[1]) : null
      });
      if (results.length >= 20) break;
    }

    let total_number = 0; let total_text = null;
    let tm = mainHtml.match(/Found\s+(\d+)\s+files/i);
    if (tm) { total_number = parseInt(tm[1]); total_text = tm[0]; }

    let has_next = mainHtml.includes(`page=${page+1}`) || /next/i.test(mainHtml);

    const data = {
      query: q, page: page, source: target,
      total_results_text: total_text,
      total_results_number: total_number,
      pagination: { current_page: page, has_next, has_prev: page>1, next_page: has_next?page+1:null, prev_page: page>1?page-1:null },
      total_in_page: results.length,
      results: results
    };

    const json = JSON.stringify(data, null, 2);
    if (callback) {
      res.setHeader("Content-Type", "application/javascript");
      res.send(`${callback.replace(/[^a-zA-Z0-9_]/g,'')}(${json});`);
    } else {
      res.setHeader("Content-Type", "application/json");
      res.send(json);
    }
  } catch (e) {
    res.status(500).json({ error: e.message, results: [] });
  }
}
