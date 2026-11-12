module.exports = (req,res)=>{
res.setHeader("Content-Type","text/html; charset=utf-8");
res.send(`
<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body{font-family:system-ui;background:#0f172a;color:#fff;padding:16px}
.server-traffic{display:flex;align-items:center;gap:8px;background:#1e293b;padding:12px 16px;border-radius:12px;margin-bottom:10px;animation:fade .3s}
.server-traffic strong{font-size:28px;color:#22d3ee}
.server-traffic small{margin-left:auto;background:#334155;padding:4px 10px;border-radius:20px;font-size:12px}
#status{font-size:11px;opacity:.5;text-align:center;margin-top:12px}
@keyframes fade{from{opacity:0}to{opacity:1}}
</style></head><body>
<div id="list">loading servers from danael...</div>
<div id="status"></div>
<script>
const list=document.getElementById('list'),status=document.getElementById('status');
let servers=[];
async function poll(){
  try{
    const res=await fetch('/api/mbps?cache='+Date.now(),{cache:'no-store'});
    const json=await res.json();
    servers=json.servers||[];
    list.innerHTML=json.data.map(s=>\`
      <div class="server-traffic">
        <strong id="mbps-\${s.server}">\${s.mbps!==null?s.mbps.toFixed(1):'—'}</strong>
        <span>Mbps</span><small>\${s.server.toUpperCase()}</small>
      </div>\`).join('');
    status.textContent=json.count+' servers detected | last: '+new Date().toLocaleTimeString()+' | live 5s';
  }catch(e){ status.textContent='error: '+e.message; }
}
poll(); setInterval(poll,1000);
<\/script></body></html>
`);
};
};