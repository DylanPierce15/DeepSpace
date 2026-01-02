import React from 'react'

export default function QuickStats({ tasks = [], groups = [] }) {
  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.completed).length
  const pendingTasks = totalTasks - completedTasks
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  
  const tasksByGroup = groups.reduce((acc, group) => {
    const groupTasks = tasks.filter(t => t.groupId === group.id)
    acc[group.name] = groupTasks.length
    return acc
  }, {})

  const mostActiveGroup = Object.entries(tasksByGroup).reduce((max, [name, count]) => 
    count > max.count ? { name, count } : max, { name: 'None', count: 0 }
  )

  return (
    <div style={{
      background: '#0b1220',
      border: '1px solid #1f2937',
      borderRadius: 8,
      padding: 12,
      marginTop: 8
    }}>
      <div style={{ fontSize: 14, color: '#e2e8f0', marginBottom: 8, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
        📊 Quick Stats
        <div style={{ fontSize: 10, color: '#64748b', background: '#1f2937', padding: '2px 6px', borderRadius: 4 }}>
          LIVE
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, color: '#22c55e', fontWeight: 700 }}>{completedTasks}</div>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>Completed</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, color: '#ff00ff', fontWeight: 700 }}>{pendingTasks}</div>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>Pending</div>
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Completion Rate</div>
        <div style={{ 
          width: '100%', 
          height: 6, 
          background: '#1f2937', 
          borderRadius: 3,
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${completionRate}%`,
            height: '100%',
            background: completionRate >= 80 ? '#22c55e' : completionRate >= 50 ? '#f59e0b' : '#ef4444',
            transition: 'width 0.3s ease'
          }} />
        </div>
        <div style={{ fontSize: 10, color: '#94a3b8', textAlign: 'right', marginTop: 2 }}>
          {completionRate}%
        </div>
      </div>

      <div style={{ fontSize: 11, color: '#94a3b8' }}>
        Most active: <span style={{ color: '#e2e8f0' }}>{mostActiveGroup.name}</span> ({mostActiveGroup.count} tasks)
      </div>
    </div>
  )
}