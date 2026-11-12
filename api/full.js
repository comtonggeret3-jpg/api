module.exports = async (req,res)=>{
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Cache-Control","no-store");
  try{
    const mainHtml = await (await fetch('https://danael.fun/create/cloudfront/?lang=en',{headers:{"User-Agent":"Mozilla/5.0"}})).text();
    
    // 1. Deteksi server
    let servers = [...mainHtml.matchAll(/id="mbps-([^"]+)"/g)].map(m=>m[1]);
    servers = [...new Set(servers)];
    if(!servers.length) servers=['usa','uk','mexico'];

    // 2. Deteksi jumlah akun dari HTML yang sama
    // Coba 3 pola yang biasa dipakai danael
    let counts = {};
    // Pola A: id="count-usa"> 847 / 1200
    [...mainHtml.matchAll(/id="count-([a-z0-9_-]+)"[^>]*>\s*(\d+)\s*\/\s*1200/gi)].forEach(m=> counts[m[1].toLowerCase()] = m[2]);
    // Pola B: data-akun usa 847/1200 atau akun-usa
    [...mainHtml.matchAll(/(\b[a-z]{2,10}\b)[^0-9]{0,20}(\d+)\s*\/\s*1200/gi)].forEach(m=> {
        let srv = m[1].toLowerCase();
        if(servers.includes(srv) && !counts[srv]) counts[srv]=m[2];
    });
    // Pola C: cari di sekitar server-traffic
    servers.forEach(srv=>{
        if(!counts[srv]){
            let blockRe = new RegExp(srv+'[\\s\\S]{0,300}?([0-9]{1,4})\\s*\\/\\s*1200','i');
            let f = mainHtml.match(blockRe);
            if(f) counts[srv]=f[1];
        }
    });

    // 3. Ambil Mbps live
    const results = await Promise.all(servers.map(async key=>{
      let mbps = null;
      try{
        const r1 = await fetch('https://danael.fun/create/cloudfront/mbps.php?server='+key,{headers:{Referer:'https://danael.fun/create/cloudfront/?lang=en', "User-Agent":"Mozilla/5.0"}, cache:"no-store"});
        const j1 = await r1.json(); mbps = Number(j1.mbps);
      }catch{}
      return {server:key, mbps, akun: counts[key.toLowerCase()] || "0", total:"1200"};
    }));

    return res.status(200).json({count:results.length, data:results, debug_counts:counts});
  }catch(e){ return res.status(200).json({error:e.message, count:0, data:[]}); }
}