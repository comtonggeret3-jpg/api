module.exports = function(req, res) {
  res.setHeader("Content-Type","text/html; charset=utf-8");
  const interval = parseInt(req.query.sec || '2') * 1000;
  res.status(200).send(`<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:system-ui;background:#0f172a;color:#fff;padding:16px}.server-traffic{display:flex;gap:8px;background:#1e293b;padding:12px 16px;border-radius:12px;margin-bottom:10px}strong{font-size:28px;color:#22d3ee}small{margin-left:auto;background:#334155;padding:4px 10px;border-radius:20px}</style>
</head><body>
<div id="list">loading...</div><div id="status" style="font-size:11px;opacity:.5;text-align:center;margin-top:10px"></div>
<script>
var intervalMs = ${interval};
var list = document.getElementById('list');
var status = document.getElementById('status');
async function poll(){
  try{
    var res = await fetch('/api/mbps?cache='+Date.now(),{cache:'no-store'});
    var json = await res.json();
    if(!json.data) throw new Error(json.error||'no data');
    list.innerHTML = json.data.map(function(s){
      return '<div class="server-traffic"><strong>'+(s.mbps!==null?s.mbps.toFixed(1):'—')+'</strong> Mbps <small>'+s.server.toUpperCase()+'</small></div>';
    }).join('');
    status.textContent = json.count+' servers | '+new Date().toLocaleTimeString()+' | live '+(intervalMs/1000)+'s';
  }catch(e){ status.textContent = 'error: '+e.message; }
}
poll(); setInterval(poll, intervalMs);
</script></body></html>`);
};