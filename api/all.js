module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method === "OPTIONS") return res.status(200).end();

  const url = req.query.url || '';
  let pathStr = req.query.path || 'body'; // default seluruh html kayak PHP

  if (!url) return res.json({ error: "butuh ?url=...&path=body>div>.class:0" });

  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
        "Referer": new URL(url).origin,
        "Accept": "text/html"
      }
    });
    let html = await r.text();
    const baseOrigin = new URL(url).origin;

    // ===== FUNGSI getPath() SAMA KAYAK PHP =====
    // path contoh: body > div > .search-result:0 > a:1
    function getPath(htmlStr, pathStr) {
      let cur = [htmlStr];
      const parts = pathStr.split('>').map(s => s.trim()).filter(Boolean);

      for (let rawP of parts) {
        if (!rawP || rawP === 'body' || rawP === 'html') continue;
        
        let idx = null;
        const m = rawP.match(/(.+):(\d+)$/);
        let p = rawP;
        if (m) { p = m[1].trim(); idx = parseInt(m[2]); }

        let next = [];
        for (let h of cur) {
          let regex;
          if (p.startsWith('.')) {
            // .className -> cari tag yang class nya mengandung itu
            const cls = p.substring(1);
            // cari <div class="...cls..."> ... </div>
            regex = new RegExp(`<([a-z0-9]+)[^>]*class="[^"]*${cls}[^"]*"[^>]*>([\\s\\S]*?)<\\/\\1>`, 'gi');
          } else {
            // tag biasa: div, a, p
            regex = new RegExp(`<${p}[^>]*>([\\s\\S]*?)<\\/${p}>`, 'gi');
          }

          let match;
          while ((match = regex.exec(h)) !== null) {
            next.push(match[0]); // full html element
          }
        }

        if (idx !== null) {
          cur = next[idx] ? [next[idx]] : [];
        } else {
          cur = next;
        }
        if (cur.length === 0) break;
      }
      return cur;
    }

    // ===== FUNGSI pecah_unlimited() SAMA KAYAK PHP =====
    let totalNodes = 0;
    function pecah_unlimited(htmlChunk) {
      const arr = [];
      if (totalNodes > 500 || !htmlChunk) return arr;

      // ambil inner content
      const innerMatch = htmlChunk.match(/^<[^>]+>([\s\S]*)<\/[^>]+>$/);
      const inner = innerMatch ? innerMatch[1] : htmlChunk;

      // regex cari child tag langsung
      const childRegex = /<([a-z0-9]+)([^>]*)>([\s\S]*?)<\/\1>/gi;
      let m;

      while ((m = childRegex.exec(inner)) !== null) {
        if (totalNodes > 500) break;

        const tag = m[1].toLowerCase();
        if (['script','style','noscript','svg','path'].includes(tag)) continue;

        const attrs = m[2];
        const content = m[3];

        totalNodes++;

        let text = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (text.length > 200) {
          const first = content.match(/^([^<]+)/);
          text = first ? first[1].trim().slice(0,100) : text.slice(0,100);
        }

        let item = { tag, text };

        // === KEY URL & SRC BIAR KEBACA (SAMA KAYAK PHP) ===
        const href = attrs.match(/href\s*=\s*["']([^"']+)["']/i);
        if (href) {
          let u = href[1];
          if (u.startsWith('/')) u = baseOrigin + u;
          if (!u.startsWith('#') && !u.startsWith('javascript')) item.url = u;
        }
        const src = attrs.match(/src\s*=\s*["']([^"']+)["']/i);
        if (src) {
          let s = src[1];
          if (s.startsWith('/')) s = baseOrigin + s;
          item.src = s;
        }

        // rekursif kayak di PHP
        if (content.includes('<') && text.length < 150) {
          const inside = pecah_unlimited(m[0]);
          if (inside.length) item.inside = inside;
        }

        if (item.text || item.url || item.src) {
          arr.push(item);
        }
      }
      return arr;
    }

    // ===== EKSEKUSI =====
    let targetHtmls = [];
    if (!pathStr || pathStr === 'body') {
      targetHtmls = [html]; // default seluruh isi html
    } else {
      targetHtmls = getPath(html, pathStr);
      // kalau path gak ketemu, fallback ke seluruh html biar gak kosong
      if (targetHtmls.length === 0) targetHtmls = [html];
    }

    let hasil = pecah_unlimited(targetHtmls[0]);

    // fallback terakhir biar gak kosong: cari semua <a>
    if (hasil.length === 0) {
      const aRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
      let am;
      while ((am = aRegex.exec(targetHtmls[0])) !== null) {
        if (totalNodes++ > 500) break;
        let u = am[1];
        if (u.startsWith('/')) u = baseOrigin + u;
        hasil.push({ tag: 'a', text: am[2].trim(), url: u });
      }
    }

    return res.json(hasil);

  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack });
  }
};