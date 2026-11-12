module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method === "OPTIONS") return res.status(200).end();

  const url = req.query.url || '';
  const pathStr = req.query.path || 'body';

  if (!url) {
    return res.json({ error: "butuh ?url=...&path=body" });
  }

  try {
    const r = await fetch(url, { 
      headers: { 
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
        "Referer": new URL(url).origin,
        "Accept": "text/html,application/xhtml+xml"
      } 
    });
    let html = await r.text();
    
    if (html.includes('Attention Required') || html.includes('cf-challenge')) {
      return res.json({ error: "KE-BLOCK CLOUDFLARE", url: url });
    }

    const baseOrigin = new URL(url).origin;

    // === FUNGSI getPath() ALA PHP, TAPI PAKAI REGEX KAYAK CONTOH KAMU ===
    function getPath(htmlStr, pathStr) {
      const parts = pathStr.split('>').map(s => s.trim()).filter(Boolean);
      let curHtmls = [htmlStr];

      for (let p of parts) {
        if (!p) continue;
        let idx = null;
        let m = p.match(/(.+):(\d+)$/);
        if (m) { p = m[1]; idx = parseInt(m[2]); }

        let nextHtmls = [];
        for (let h of curHtmls) {
          let regex;
          if (p.startsWith('.')) {
            // .classname
            let cls = p.substring(1);
            regex = new RegExp(`<([a-z0-9]+)[^>]*class="[^"]*${cls}[^"]*"[^>]*>([\\s\\S]*?)<\\/\\1>`, 'gi');
          } else if (p === 'body' || p === 'html') {
            regex = new RegExp(`<${p}[^>]*>([\\s\\S]*)<\\/${p}>`, 'i');
          } else {
            regex = new RegExp(`<${p}[^>]*>([\\s\\S]*?)<\\/${p}>`, 'gi');
          }
          
          let match;
          while ((match = regex.exec(h)) !== null) {
            nextHtmls.push(match[0]); // full tag
          }
        }
        if (idx !== null) {
          curHtmls = nextHtmls[idx] ? [nextHtmls[idx]] : [];
        } else {
          curHtmls = nextHtmls;
        }
      }
      return curHtmls;
    }

    // === FUNGSI pecah_unlimited() ALA PHP, TAPI PAKAI REGEX SPLIT KAYAK CONTOH SFILE ===
    let totalNodes = 0;
    function pecah_unlimited(htmlChunk) {
      let arr = [];
      if (totalNodes > 500) return arr;

      // split per tag kayak di contoh sfile kamu pakai split('<div')
      // ini kita pecah semua child element
      const tagRegex = /<([a-z0-9]+)([^>]*)>([\s\S]*?)<\/\1>|<([a-z0-9]+)([^>]*)\/>/gi;
      let match;
      
      // ambil inner HTML dulu
      let innerMatch = htmlChunk.match(/<[^>]+>([\s\S]*)<\/[^>]+>$/);
      let inner = innerMatch ? innerMatch[1] : htmlChunk;

      while ((match = tagRegex.exec(inner)) !== null) {
        if (totalNodes > 500) break;
        
        let tagName = (match[1] || match[4] || '').toLowerCase();
        if (!tagName || tagName === 'script' || tagName === 'style') continue;
        if (tagName.length > 20) continue;

        totalNodes++;

        let attrs = match[2] || match[5] || '';
        let content = match[3] || '';

        // text
        let text = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (text.length > 200) {
          // ambil firstChild text kayak PHP
          let firstTextMatch = content.match(/^([^<]+)/);
          text = firstTextMatch ? firstTextMatch[1].trim().substring(0,100) : text.substring(0,100);
        }

        let item = { tag: tagName, text: text };

        // href
        let hrefMatch = attrs.match(/href="([^"]+)"/i) || attrs.match(/href='([^']+)'/i);
        if (hrefMatch) {
          let href = hrefMatch[1];
          if (href.startsWith('/')) href = baseOrigin + href;
          if (!href.startsWith('javascript') && !href.startsWith('#')) {
            item.url = href; // BIAR KEBACA
          }
        }

        // src
        let srcMatch = attrs.match(/src="([^"]+)"/i) || attrs.match(/src='([^']+)'/i);
        if (srcMatch) {
          let src = srcMatch[1];
          if (src.startsWith('/')) src = baseOrigin + src;
          item.src = src;
        }

        // inside - rekursif
        if (content.includes('<') && content.includes('>')) {
          let inside = pecah_unlimited(content);
          if (inside.length) item.inside = inside;
        }

        // filter kosong
        if (item.text.length > 1 || item.url || item.src) {
          arr.push(item);
        }
      }
      return arr;
    }

    // === EKSEKUSI ===
    let nodesHtml = [];
    if (pathStr === 'body') {
      nodesHtml = [html];
    } else {
      nodesHtml = getPath(html, pathStr);
    }

    let hasil = [];
    if (nodesHtml.length > 0) {
      hasil = pecah_unlimited(nodesHtml[0]);
    }

    return res.json(hasil);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};