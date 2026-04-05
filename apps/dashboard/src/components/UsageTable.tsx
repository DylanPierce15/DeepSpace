import type { UsageEntry } from '../lib/types'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'text-success'
    case 'failed':
      return 'text-destructive'
    case 'pending':
      return 'text-warning'
    default:
      return 'text-muted-foreground'
  }
}

export function UsageTable({ entries }: { entries: UsageEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No API usage yet.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">Integration</th>
            <th className="pb-2 pr-4 font-medium">Endpoint</th>
            <th className="pb-2 pr-4 font-medium text-right">Cost</th>
            <th className="pb-2 pr-4 font-medium">Status</th>
            <th className="pb-2 font-medium">Time</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b border-border/50">
              <td className="py-2 pr-4 text-foreground">{entry.integrationName}</td>
              <td className="py-2 pr-4 text-muted-foreground">{entry.endpoint}</td>
              <td className="py-2 pr-4 text-right font-mono text-foreground">
                ${parseFloat(entry.totalCost).toFixed(4)}
              </td>
              <td className={`py-2 pr-4 capitalize ${statusColor(entry.status)}`}>
                {entry.status}
              </td>
              <td className="py-2 text-muted-foreground">{formatDate(entry.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
