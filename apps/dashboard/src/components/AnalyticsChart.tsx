import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface DataPoint {
  datetime: string
  requests: number
  errors: number
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function AnalyticsChart({
  data,
  period,
}: {
  data: DataPoint[]
  period: string
}) {
  const showDate = period === '7d' || period === '30d'
  const formatter = showDate ? formatDate : formatTime

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(63,63,70,0.3)" />
          <XAxis
            dataKey="datetime"
            tickFormatter={formatter}
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
            axisLine={{ stroke: 'rgba(63,63,70,0.5)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: '1px solid rgba(63,63,70,0.5)',
              borderRadius: '0.5rem',
              color: '#fafafa',
              fontSize: 13,
            }}
            labelFormatter={(label) => {
              const d = new Date(label as string)
              return d.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            }}
          />
          <Area
            type="monotone"
            dataKey="requests"
            stroke="#818cf8"
            fill="rgba(129,140,248,0.15)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="errors"
            stroke="#ef4444"
            fill="rgba(239,68,68,0.1)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
