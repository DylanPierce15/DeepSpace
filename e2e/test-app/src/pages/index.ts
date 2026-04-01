export const indexPage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DeepSpace SDK Test</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0a0f1a; color: #f1f5f9; padding: 2rem; }
    .check { padding: 0.5rem 1rem; border-radius: 0.5rem; margin: 0.5rem 0; font-size: 0.9rem; }
    .ok { background: #065f46; }
    .err { background: #7f1d1d; }
    .pending { background: #1e293b; }
    #results { max-width: 600px; }
  </style>
</head>
<body>
  <h1 id="heading">DeepSpace SDK Test App</h1>
  <div id="results">
    <p id="status" class="check pending">Running checks...</p>
    <div id="checks"></div>
  </div>
  <script>
    const checks = document.getElementById('checks')
    const status = document.getElementById('status')

    function addCheck(name, ok, detail) {
      const div = document.createElement('div')
      div.className = 'check ' + (ok ? 'ok' : 'err')
      div.textContent = (ok ? 'PASS' : 'FAIL') + ': ' + name + (detail ? ' — ' + detail : '')
      div.dataset.check = name
      checks.appendChild(div)
    }

    async function run() {
      let passed = 0, total = 0

      total++
      try {
        const r = await fetch('/api/health')
        const d = await r.json()
        const ok = d.app === 'deepspace-sdk-test'
        if (ok) passed++
        addCheck('app-health', ok, d.app)
      } catch(e) { addCheck('app-health', false, e.message) }

      total++
      try {
        const r = await fetch('/api/platform-health')
        const d = await r.json()
        const ok = d.status === 'ok'
        if (ok) passed++
        addCheck('platform-health', ok, d.service)
      } catch(e) { addCheck('platform-health', false, e.message) }

      total++
      try {
        const r = await fetch('/api/app-registry')
        const d = await r.json()
        const ok = Array.isArray(d.apps)
        if (ok) passed++
        addCheck('app-registry', ok, d.apps?.length + ' apps')
      } catch(e) { addCheck('app-registry', false, e.message) }

      status.textContent = 'App: deepspace-sdk-test | Status: ok | Checks: ' + passed + '/' + total
      status.className = 'check ' + (passed === total ? 'ok' : 'err')
    }

    run()
  </script>
</body>
</html>`
