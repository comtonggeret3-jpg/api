const { JSDOM } = require('jsdom');

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method === "OPTIONS") return res.status(200).end();

  const url = req.query.url || '';
  let pathStr = req.query.path || 'body';

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

    const dom = new JSDOM(html);
    const document = dom.window.document;

    // ===== getPath() SAMA PERSIS KAYAK PHP =====
    function getPath(pathStr) {
      const parts = pathStr.split('>').map(s => s.trim()).filter(Boolean);
      let cur = [document];
      
      for (let rawP of parts) {
        if (!rawP || rawP === 'body' || rawP === 'html' || rawP === 'body html') continue;
        let idx = null;
        const m = rawP.match(/(.+):(\d+)$/);
        let p = rawP;
        if (m) { p = m[1].trim(); idx = parseInt(m[2]); }

        let next = [];
        for (let ctx of cur) {
          let found;
          if (p.startsWith('.')) {
            const cls = p.substring(1);
            found = ctx.querySelectorAll ? ctx.querySelectorAll(`[class*="${cls}"]`) : [];
          } else {
            try {
              found = ctx.querySelectorAll ? ctx.querySelectorAll(p) : [];
            } catch { found = []; }
          }
          found.forEach(el => next.push(el));
        }
        cur = idx !== null ? (next[idx] ? [next[idx]] : []) : next;
        if (cur.length === 0) break;
      }
      return cur;
    }

    // ===== pecah_unlimited() SAMA PERSIS KAYAK PHP =====
    let totalNodes = 0;
    function pecah_unlimited(node) {
      const arr = [];
      if (!node || !node.childNodes) return arr;
      
      for (let child of node.childNodes) {
        if (totalNodes > 500) break;
        if (child.nodeType !== 1) continue;
        totalNodes++;

        let txt = (child.textContent || '').trim();
        let shortText = txt;
        if (txt.length > 200) {
          shortText = child.firstChild ? (child.firstChild.textContent || '').trim().slice(0,100) : txt.slice(0,100);
        }

        let item = {
          tag: child.tagName.toLowerCase(),
          text: shortText
        };

        if (child.hasAttribute('href')) {
          let u = child.getAttribute('href');
          if (u.startsWith('/')) u = baseOrigin + u;
          item.url = u;
        }
        if (child.hasAttribute('src')) {
          let s = child.getAttribute('src');
          if (s.startsWith('/')) s = baseOrigin + s;
          item.src = s;
        }

        const inside = pecah_unlimited(child);
        if (inside.length) item.inside = inside;

        // biar gak kosong kayak sebelumnya, filter yang ada isinya
        if (item.text || item.url || item.src || item.inside) {
          arr.push(item);
        }
      }
      return arr;
    }

    // ===== EKSEKUSI =====
    let nodes = [];
    if (!pathStr || pathStr === 'body') {
      nodes = [document.body || document.documentElement];
    } else {
      nodes = getPath(pathStr);
      if (nodes.length === 0) nodes = [document.body]; // fallback biar gak kosong
    }

    const hasil = nodes.length ? pecah_unlimited(nodes[0]) : [];

    return res.json(hasil.length ? hasil : [{ error: "path tidak ketemu", path: pathStr, html_len: html.length }]);

  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack });
  }
};