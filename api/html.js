const { JSDOM } = require('jsdom');

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const url = req.query.url || '';
  let pathStr = req.query.path || 'body';
  const wantJson = req.query.json === '1' || req.query.json === 'true';

  if (!url) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.json({ error: "butuh ?url=...&path=body&json=1" });
  }

  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 Chrome/122.0", "Referer": new URL(url).origin } });
    const html = await r.text();
    const baseOrigin = new URL(url).origin;
    const dom = new JSDOM(html);
    const document = dom.window.document;

    document.querySelectorAll('[href^="/"], [src^="/"]').forEach(el => {
      if (el.getAttribute('href')?.startsWith('/')) el.setAttribute('href', baseOrigin + el.getAttribute('href'));
      if (el.getAttribute('src')?.startsWith('/')) el.setAttribute('src', baseOrigin + el.getAttribute('src'));
    });

    function getPath(pathStr) {
      const parts = pathStr.split('>').map(s => s.trim()).filter(Boolean);
      let cur = [document];
      for (let rawP of parts) {
        if (!rawP) continue;
        let idx = null;
        const m = rawP.match(/(.+):(\d+)$/);
        let p = rawP;
        if (m) { p = m[1].trim(); idx = parseInt(m[2]); }
        if ((p === 'body' || p === 'html') && cur[0] === document) {
          cur = [p === 'body' ? document.body : document.documentElement];
          continue;
        }
        let next = [];
        for (let ctx of cur) {
          let found = p.startsWith('.') ? ctx.querySelectorAll(`[class*="${p.substring(1)}"]`) : ctx.querySelectorAll(p);
          found.forEach(el => next.push(el));
        }
        cur = idx !== null ? (next[idx] ? [next[idx]] : []) : next;
        if (cur.length === 0) break;
      }
      return cur;
    }

    let nodes = (pathStr === 'body') ? [document.body] : (pathStr === 'html') ? [document.documentElement] : getPath(pathStr);

    if (nodes.length === 0) {
      if (wantJson) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        return res.json({ error: `path ${pathStr} tidak ketemu`, count: 0, html: "" });
      } else {
        res.setHeader("Content-Type", "text/html");
        return res.status(404).send(`<!-- path ${pathStr} tidak ketemu -->`);
      }
    }

    const resultHtml = nodes.map(n => n.outerHTML).join('\n');

    // ===== KALO MAU DIBUNGKUS JSON =====
    if (wantJson) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.json({
        url: url,
        path: pathStr,
        count: nodes.length,
        html: resultHtml
      });
    }

    // ===== DEFAULT PURE HTML =====
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(resultHtml);

  } catch (e) {
    if (wantJson) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(500).json({ error: e.message });
    } else {
      res.setHeader("Content-Type", "text/plain");
      return res.status(500).send(e.message);
    }
  }
};