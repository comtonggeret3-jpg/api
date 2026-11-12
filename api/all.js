export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const url = req.query.url;
  const path = req.query.path || 'body';

  if (!url) {
    return res.status(400).json({ error: "butuh ?url=...&path=body" });
  }

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    const html = await response.text();

    // parser sederhana tanpa library biar ringan
    // kalau mau jsoup-style, ganti path > selector
    const getNodes = (htmlStr, selector) => {
      // untuk Vercel kita pakai regex cepat
      // selector contoh: body, body>div, .className
      if (selector.startsWith('.')) {
        const className = selector.slice(1);
        const regex = new RegExp(`<[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)</`, 'gi');
        return [...htmlStr.matchAll(regex)].map(m => m[0]);
      }
      return [htmlStr];
    };

    let totalNodes = 0;
    function pecah_unlimited(nodeHtml) {
      if (totalNodes > 300) return [];
      const tagRegex = /<([a-z0-9]+)([^>]*)>([^<]*)/gi;
      let arr = [];
      let match;
      
      // ambil semua tag di dalam
      const divRegex = /<([a-zA-Z0-9]+)([^>]*)>([\s\S]*?)<\/\1>/g;
      // Simplifikasi: kita parse flat aja biar gak hang
      const simpleTagRegex = /<([a-z0-9]+)[^>]*>/gi;
      let result;
      while ((result = simpleTagRegex.exec(nodeHtml)) !== null && totalNodes < 300) {
        totalNodes++;
        const tag = result[1];
        if(['html','head','script','style','meta','link'].includes(tag)) continue;
        
        // ambil href/src kalau ada
        const hrefMatch = result[0].match(/href=["']([^"']+)["']/);
        const srcMatch = result[0].match(/src=["']([^"']+)["']/);
        
        let item = { tag };
        if (hrefMatch) item.url = hrefMatch[1];
        if (srcMatch) item.src = srcMatch[1];
        
        arr.push(item);
        if(arr.length > 100) break;
      }
      return arr;
    }

    // versi PRO pakai DOMParser (work di Vercel Edge)
    const { JSDOM } = await import('jsdom').catch(() => ({ JSDOM: null }));
    
    let hasil = [];
    if (JSDOM) {
      const dom = new JSDOM(html);
      const document = dom.window.document;
      let target = document.querySelector(path.replace(/>/g, ' ')) || document.body;
      
      function pecahDOM(node, depth = 0) {
        if (totalNodes > 500 || depth > 8) return [];
        let arr = [];
        for (let child of node.children) {
          if (totalNodes++ > 500) break;
          let item = { tag: child.tagName.toLowerCase() };
          let txt = child.textContent?.trim() || "";
          if (txt.length < 200 && child.children.length === 0) item.text = txt;
          else if (txt) item.text = txt.slice(0, 100);
          
          if (child.getAttribute('href')) item.url = child.getAttribute('href');
          if (child.getAttribute('src')) item.src = child.getAttribute('src');
          
          let inside = pecahDOM(child, depth + 1);
          if (inside.length) item.inside = inside;
          arr.push(item);
        }
        return arr;
      }
      hasil = pecahDOM(target);
    } else {
      // fallback tanpa jsdom
      hasil = pecah_unlimited(html);
    }

    return res.status(200).json(hasil);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}