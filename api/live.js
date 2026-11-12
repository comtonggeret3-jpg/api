module.exports = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body{font-family:system-ui;background:#0f172a;color:#fff;padding:16px}
.server-traffic{display:flex;align-items:center;gap:8px;background:#1e293b;padding:12px 16px;border-radius:12px;margin-bottom:10px}
.server-traffic strong{font-size:28px;color:#22d3ee}
.server-traffic span{opacity:.7}
.server-traffic small{margin-left:auto;background:#334155;padding:4px 10px;border-radius:20px;font-size:12px}
#status{font-size:12px;opacity:.5;text-align:center;margin-top:10px}
</style>
</head>
<body>
<div id="list"></div>
<div id="status">live polling 5s...</div>
<script>
const servers = ['usa','uk','mexico'];
const list = document.getElementById('list');
const status = document.getElementById('status');

function render(data){
  list.innerHTML = data.map(s => \`
    <div class="server-traffic">
      <strong id="mbps-\${s.server}">\${s.mbps !== null ? s.mbps.toFixed(1) : '—'}</strong>
      <span>Mbps</span>
      <small>\${s.server.toUpperCase()}</small>
    </div>
  \`).join('');
}

async function poll(){
  try{
    const res = await fetch('/api/mbps?cache='+Date.now());
    const json = await res.json();
    const arr = json.data || [json.usa, json.uk, json.mexico].filter(Boolean);
    render(arr);
    status.textContent = 'last update: ' + new Date().toLocaleTimeString() + ' - live 5s';
  }catch(e){
    status.textContent = 'error: ' + e.message;
  }
}
poll();
setInterval(poll, 5000); // live tiap 5 detik kayak danael asli
</script>
</body>
</html>
  `);
};