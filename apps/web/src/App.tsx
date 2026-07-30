import { useCallback, useEffect, useState } from 'react'
import { api, type StatusResponse } from './api'

function Badge({ ok, label, variant }: { ok: boolean; label: string; variant?: 'warn' }) {
  const cls = variant === 'warn' ? 'warn' : ok ? 'ok' : 'off'
  return <span className={`badge ${cls}`}>{label}</span>
}

export function App() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null)
  const [logs, setLogs] = useState<string | null>(null)

  const showToast = (message: string, error = false) => {
    setToast({ message, error })
    setTimeout(() => setToast(null), 5000)
  }

  const refresh = useCallback(async () => {
    try {
      const data = await api.status()
      setStatus(data)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load status', true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 10_000)
    return () => clearInterval(id)
  }, [refresh])

  const runAction = async (
    key: string,
    fn: () => Promise<{ message?: string } | unknown>,
    fallbackMsg: string
  ) => {
    setBusy(key)
    try {
      const result = await fn()
      const msg =
        result && typeof result === 'object' && 'message' in result && result.message
          ? String(result.message)
          : fallbackMsg
      showToast(msg)
      await refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Action failed', true)
    } finally {
      setBusy(null)
    }
  }

  if (loading && !status) {
    return (
      <div className='loading'>
        <div className='spinner' />
        Loading OpenClaw Control…
      </div>
    )
  }

  const gatewayHealthy = status?.gateway.healthy ?? false
  const runtime = status?.runtime ?? 'none'
  const dashboardUrl = status?.dashboardUrl ?? status?.gateway.dashboardUrl

  const openDashboard = async () => {
    try {
      const url = dashboardUrl || (await api.dashboardUrl()).url
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to open dashboard', true)
    }
  }

  return (
    <div className='app-shell'>
      <header className='hero'>
        <div>
          <h1>
            Open<span>Claw</span> Control
          </h1>
          <p>
            Production local orchestrator — auto-starts Docker when needed, manages gateway, models,
            and keys.
          </p>
        </div>
        <div className='actions'>
          <button
            type='button'
            className='btn btn-ghost'
            disabled={!!busy}
            onClick={() => refresh()}
          >
            Refresh
          </button>
          {dashboardUrl && (
            <button type='button' className='link-btn btn-linkish' onClick={() => openDashboard()}>
              Open Gateway ↗
            </button>
          )}
        </div>
      </header>

      <section className='card highlight-card'>
        <div className='highlight-row'>
          <div>
            <h2 className='inline-title'>System Status</h2>
            <p className='muted'>
              Runtime: <strong>{runtime}</strong> · Mode default: {status?.defaultMode ?? 'auto'}
            </p>
          </div>
          <div className='actions'>
            <Badge
              ok={gatewayHealthy}
              label={gatewayHealthy ? 'Gateway Live' : 'Gateway Offline'}
            />
            <Badge
              ok={!!status?.docker.running}
              label={status?.docker.running ? 'Docker Ready' : 'Docker Down'}
              variant={status?.docker.running ? undefined : 'warn'}
            />
          </div>
        </div>
        <div className='actions'>
          <button
            type='button'
            className='btn btn-primary btn-lg'
            disabled={!!busy}
            onClick={() =>
              runAction(
                'ensure',
                async () => {
                  const result = await api.ensureGateway('auto')
                  if (result.healthy && result.dashboardUrl) {
                    window.open(result.dashboardUrl, '_blank', 'noopener,noreferrer')
                  }
                  return result
                },
                'Gateway orchestration complete'
              )
            }
          >
            {busy === 'ensure' ? 'Starting…' : 'Smart Start (Auto)'}
          </button>
          {gatewayHealthy && dashboardUrl && (
            <button
              type='button'
              className='btn btn-secondary btn-lg'
              disabled={!!busy}
              onClick={() => openDashboard()}
            >
              Open Gateway
            </button>
          )}
          <button
            type='button'
            className='btn btn-secondary'
            disabled={!!busy}
            onClick={() => runAction('repair', api.repair, 'Repair complete')}
          >
            {busy === 'repair' ? 'Repairing…' : 'Doctor + Restart'}
          </button>
          <button
            type='button'
            className='btn btn-ghost'
            disabled={!!busy}
            onClick={() => runAction('stop-all', api.stopAll, 'All gateways stopped')}
          >
            Stop All
          </button>
        </div>
      </section>

      <div className='grid'>
        <section className='card'>
          <h2>Gateway</h2>
          <div className='stat-row'>
            <span className='stat-label'>Health</span>
            <Badge ok={gatewayHealthy} label={gatewayHealthy ? 'Healthy' : 'Offline'} />
          </div>
          <div className='stat-row'>
            <span className='stat-label'>Runtime</span>
            <span className='stat-value'>{runtime}</span>
          </div>
          <div className='stat-row'>
            <span className='stat-label'>Port</span>
            <span className='stat-value'>{status?.gatewayPort ?? '—'}</span>
          </div>
          <div className='stat-row'>
            <span className='stat-label'>OpenClaw</span>
            <span className='stat-value'>{status?.version ?? '—'}</span>
          </div>
          <div className='actions'>
            <button
              type='button'
              className='btn btn-secondary'
              disabled={!!busy}
              onClick={() => runAction('native', () => api.startNative(), 'Native gateway')}
            >
              Native
            </button>
            <button
              type='button'
              className='btn btn-primary'
              disabled={!!busy}
              onClick={() => runAction('docker', () => api.startDocker(), 'Docker gateway')}
            >
              {busy === 'docker' ? 'Opening Docker…' : 'Docker'}
            </button>
          </div>
        </section>

        <section className='card'>
          <h2>Docker Engine</h2>
          <div className='stat-row'>
            <span className='stat-label'>Installed</span>
            <Badge
              ok={!!status?.docker.installed}
              label={status?.docker.installed ? 'Yes' : 'No'}
            />
          </div>
          <div className='stat-row'>
            <span className='stat-label'>Daemon</span>
            <Badge
              ok={!!status?.docker.running}
              label={status?.docker.running ? 'Running' : 'Stopped'}
            />
          </div>
          <div className='stat-row'>
            <span className='stat-label'>Container</span>
            <Badge
              ok={!!status?.docker.gatewayContainer}
              label={status?.docker.gatewayContainer ? 'openclaw-gateway' : 'None'}
            />
          </div>
          <div className='stat-row'>
            <span className='stat-label'>Image</span>
            <span className='stat-value stat-wrap'>{status?.docker.image ?? '—'}</span>
          </div>
          <div className='actions'>
            <button
              type='button'
              className='btn btn-ghost'
              disabled={!!busy}
              onClick={async () => {
                setBusy('logs')
                try {
                  const { logs: text } = await api.dockerLogs(100)
                  setLogs(text)
                } catch (err) {
                  showToast(err instanceof Error ? err.message : 'Failed to load logs', true)
                } finally {
                  setBusy(null)
                }
              }}
            >
              View Logs
            </button>
            <button
              type='button'
              className='btn btn-danger'
              disabled={!!busy}
              onClick={() => runAction('docker-stop', api.stopDocker, 'Docker stopped')}
            >
              Stop Docker
            </button>
          </div>
        </section>

        <section className='card'>
          <h2>OpenClaw CLI</h2>
          <div className='stat-row'>
            <span className='stat-label'>Installed</span>
            <span className='stat-value'>{status?.version ?? '—'}</span>
          </div>
          <div className='stat-row'>
            <span className='stat-label'>Channel</span>
            <span className='stat-value'>{status?.update.channel ?? '—'}</span>
          </div>
          <div className='stat-row'>
            <span className='stat-label'>Update</span>
            <Badge
              ok={!status?.update.updateAvailable}
              label={
                status?.update.updateAvailable
                  ? `Available (${status.update.latestVersion})`
                  : 'Up to date'
              }
              variant={status?.update.updateAvailable ? 'warn' : undefined}
            />
          </div>
          <div className='actions'>
            <button
              type='button'
              className='btn btn-primary'
              disabled={!!busy || !status?.update.updateAvailable}
              onClick={() =>
                runAction('update', api.updateOpenClaw, 'OpenClaw updated and gateway restarted')
              }
            >
              {busy === 'update' ? 'Updating…' : 'Update OpenClaw'}
            </button>
            <button
              type='button'
              className='btn btn-ghost'
              disabled={!!busy}
              onClick={() =>
                runAction('repair-update', api.repairOpenClawUpdate, 'Update repair complete')
              }
            >
              Repair Update
            </button>
          </div>
        </section>

        <section className='card'>
          <h2>Gateway Token</h2>
          <div className='stat-row'>
            <span className='stat-label'>Token</span>
            <span className='stat-value'>{status?.token?.masked ?? 'Not set'}</span>
          </div>
          <div className='actions'>
            <button
              type='button'
              className='btn btn-primary'
              disabled={!!busy || !dashboardUrl}
              onClick={() => openDashboard()}
            >
              Open Dashboard
            </button>
            <button
              type='button'
              className='btn btn-secondary'
              disabled={!!busy}
              onClick={() => runAction('token', api.generateToken, 'Token generated')}
            >
              Generate
            </button>
            <button
              type='button'
              className='btn btn-ghost'
              disabled={!!busy}
              onClick={async () => {
                setBusy('copy-cli')
                try {
                  const result = await api.copyDashboardUrl()
                  await navigator.clipboard.writeText(result.url)
                  showToast(result.cli || 'Authenticated URL copied')
                } catch (err) {
                  showToast(err instanceof Error ? err.message : 'Copy failed', true)
                } finally {
                  setBusy(null)
                }
              }}
            >
              {busy === 'copy-cli' ? 'Copying…' : 'Copy via CLI'}
            </button>
            <button
              type='button'
              className='btn btn-ghost'
              disabled={!!busy}
              onClick={async () => {
                setBusy('copy')
                try {
                  const { token } = await api.revealToken()
                  await navigator.clipboard.writeText(token)
                  showToast('Token copied')
                } catch (err) {
                  showToast(err instanceof Error ? err.message : 'Copy failed', true)
                } finally {
                  setBusy(null)
                }
              }}
            >
              Copy Token
            </button>
          </div>
        </section>
      </div>

      <section className='card'>
        <h2>API Keys</h2>
        <div className='keys-grid'>
          {status?.keys.map((key) => (
            <div key={key.env} className={`key-pill ${key.set ? 'set' : 'unset'}`}>
              <span>{key.label}</span>
              <span>{key.set ? '✓' : '—'}</span>
            </div>
          ))}
        </div>
      </section>

      <section className='card'>
        <h2>Model Selection</h2>
        <p className='muted mb'>
          Current: <span className='stat-value'>{status?.primaryModel ?? 'Not set'}</span>
        </p>
        <div className='model-grid'>
          {status?.presets.map((preset) => (
            <button
              key={preset.id}
              type='button'
              className={`model-option ${status.primaryModel === preset.id ? 'active' : ''}`}
              disabled={!!busy}
              onClick={() =>
                runAction(
                  preset.id,
                  () => api.setModel(preset.id, preset.tier === 'local'),
                  `Model → ${preset.label}`
                )
              }
            >
              <span>
                <strong>{preset.label}</strong>
                <br />
                <small>{preset.id}</small>
              </span>
              <span className={`badge ${preset.tier === 'cloud' ? 'warn' : 'ok'}`}>
                {preset.tier}
              </span>
            </button>
          ))}
        </div>
      </section>

      {logs && (
        <section className='card logs-card'>
          <div className='highlight-row'>
            <h2 className='inline-title'>Docker Logs</h2>
            <button type='button' className='btn btn-ghost' onClick={() => setLogs(null)}>
              Close
            </button>
          </div>
          <pre className='log-output'>{logs}</pre>
        </section>
      )}

      {toast && <div className={`toast ${toast.error ? 'error' : ''}`}>{toast.message}</div>}
    </div>
  )
}
