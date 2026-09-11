import type { ActionEvent } from '@/lib/backend'

export function ActionAudit({ history }: { history: ActionEvent[] }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="mb-2 text-sm font-medium">STS2MCP actions</div>
      {history.length === 0 ? (
        <p className="text-xs text-muted-foreground">No gameplay action has been dispatched.</p>
      ) : (
        <ol className="max-h-64 space-y-2 overflow-auto font-mono text-xs">
          {history.slice(-50).reverse().map((event, index) => (
            <li key={event.id || `${event.t}-${index}`} className="rounded bg-muted/50 p-2">
              <div>{new Date(event.t).toLocaleTimeString()} · {event.action} · {event.verification}</div>
              <div className="break-all text-muted-foreground">{JSON.stringify(event.params)}</div>
              <div className="break-all text-muted-foreground">ack {event.acknowledgement}{event.result == null ? '' : ` · ${JSON.stringify(event.result)}`}</div>
              {event.verificationDetail && <div className="break-words text-destructive">{event.verificationDetail}</div>}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
