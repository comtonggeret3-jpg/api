module.exports = async (req,res)=>{
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Cache-Control","no-store");
  try{
    const mainHtml = await (await fetch('https://danael.fun/create/cloudfront/?lang=en',{headers:{"User-Agent":"Mozilla/5.0"}})).text();
    let servers = [...mainHtml.matchAll(/id="mbps-([^"]+)"/g)].map(m=>m[1]);
    servers = [...new Set(servers)];
    if(!servers.length) servers=['usa','uk','mexico'];

    const results = await Promise.all(servers.map(async key=>{
      let mbps = null, akun = "?";
      try{
        const r1 = await fetch('https://danael.fun/create/cloudfront/mbps.php?server='+key,{headers:{Referer:'https://danael.fun/create/cloudfront/?lang=en'}});
        const j1 = await r1.json(); mbps = Number(j1.mbps);
      }catch{}
      try{
        // coba ambil jumlah akun dari halaman / status
        const r2 = await fetch('https://danael.fun/create/cloudfront/count.php?server='+key,{headers:{Referer:'https://danael.fun/create/cloudfront/'}});
        const t = await r2.text();
        // t biasanya angka atau json, ambil angka pertama
        const num = t.match(/\d+/); if(num) akun = num[0];
      }catch{}
      return {server:key, mbps, akun};
    }));
    return res.status(200).json({count:results.length, data:results});
  }catch(e){ return res.status(200).json({error:e.message, count:0, data:[]}); }
}