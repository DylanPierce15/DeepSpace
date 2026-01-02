import React, { useMemo } from 'react';
import { COLORS, VIEWS } from '../utils/constants';
import { getHistoryRange, formatDisplayDate } from '../utils/dateUtils';

function StatsPanel({ currentDateKey, foodHistory, dailyGoal, resetHour, activeView, onViewChange }) {
  const stats = useMemo(() => {
    // Today's total
    const todayFoods = foodHistory[currentDateKey] || [];
    const todayTotal = todayFoods.reduce((sum, food) => sum + food.calories, 0);

    // History stats (last 30 days with data)
    const historyDates = getHistoryRange(resetHour);
    let historyTotal = 0;
    let daysWithData = 0;
    let daysOverGoal = 0;
    let daysUnderGoal = 0;
    let daysAtGoal = 0;
    const daysWithDataArray = [];
    
    historyDates.forEach(date => {
      const foods = foodHistory[date] || [];
      const dayTotal = foods.reduce((s, f) => s + f.calories, 0);
      if (dayTotal > 0) {
        historyTotal += dayTotal;
        daysWithData++;
        daysWithDataArray.push({ date, total: dayTotal });
        
        const diff = dayTotal - dailyGoal;
        const isAtGoal = Math.abs(diff) < 50;
        
        if (isAtGoal) {
          daysAtGoal++;
        } else if (diff > 0) {
          daysOverGoal++;
        } else {
          daysUnderGoal++;
        }
      }
    });
    
    // Calculate average only over days with actual data
    const historyAvg = daysWithData > 0 ? Math.round(historyTotal / daysWithData) : 0;

    return {
      today: todayTotal,
      historyTotal,
      historyAvg,
      daysWithData,
      daysOverGoal,
      daysUnderGoal,
      daysAtGoal,
      daysWithDataArray
    };
  }, [foodHistory, currentDateKey, resetHour, dailyGoal]);

  const progressPercent = Math.min((stats.today / dailyGoal) * 100, 100);
  const remaining = Math.max(dailyGoal - stats.today, 0);

  const getProgressColor = () => {
    if (progressPercent >= 100) return COLORS.success;
    if (progressPercent >= 75) return COLORS.warning;
    return COLORS.primary;
  };

  return (
    <div style={{
      background: 'white',
      borderRadius: '16px',
      padding: '24px',
      marginBottom: '20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
    }}>
      {/* View Selector */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        marginBottom: '20px',
        borderBottom: `1px solid ${COLORS.border}`,
        paddingBottom: '12px'
      }}>
        {[
          { value: VIEWS.TODAY, label: 'Today', icon: 'today' },
          { value: VIEWS.HISTORY, label: 'History', icon: 'calendar_month' }
        ].map(view => (
          <button
            key={view.value}
            onClick={() => onViewChange(view.value)}
            style={{
              flex: 1,
              padding: '10px 16px',
              border: 'none',
              borderRadius: '8px',
              background: activeView === view.value 
                ? `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`
                : COLORS.background,
              color: activeView === view.value ? 'white' : COLORS.text,
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <span className="material-icons" style={{ fontSize: '16px' }}>
              {view.icon}
            </span>
            {view.label}
          </button>
        ))}
      </div>

      {/* Today View */}
      {activeView === VIEWS.TODAY && (
        <>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: '12px'
            }}>
              <h3 style={{ 
                margin: 0, 
                fontSize: '16px', 
                fontWeight: '500',
                color: COLORS.text 
              }}>
                Today's Intake
              </h3>
              <div style={{ fontSize: '12px', color: COLORS.textSecondary }}>
                Goal: {dailyGoal} cal
              </div>
            </div>

            <div style={{ 
              fontSize: '36px', 
              fontWeight: '600',
              color: getProgressColor(),
              marginBottom: '8px'
            }}>
              {stats.today}
              <span style={{ 
                fontSize: '18px', 
                fontWeight: '400',
                color: COLORS.textSecondary,
                marginLeft: '6px'
              }}>
                / {dailyGoal} cal
              </span>
            </div>

            {/* Progress Bar */}
            <div style={{
              height: '12px',
              background: COLORS.background,
              borderRadius: '6px',
              overflow: 'hidden',
              marginBottom: '8px'
            }}>
              <div style={{
                height: '100%',
                width: `${progressPercent}%`,
                background: `linear-gradient(90deg, ${getProgressColor()}, ${getProgressColor()})`,
                transition: 'width 0.5s ease',
                borderRadius: '6px'
              }} />
            </div>

            <div style={{ 
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '13px',
              color: COLORS.textSecondary
            }}>
              <span>{progressPercent.toFixed(0)}% of goal</span>
              <span>{remaining} cal remaining</span>
            </div>
          </div>

          {stats.today > 0 && (
            <div style={{
              padding: '16px',
              background: COLORS.background,
              borderRadius: '10px',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ 
                  fontSize: '11px', 
                  color: COLORS.textSecondary,
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  fontWeight: '500'
                }}>
                  Breakfast
                </div>
                <div style={{ 
                  fontSize: '18px', 
                  fontWeight: '600',
                  color: COLORS.text 
                }}>
                  0
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ 
                  fontSize: '11px', 
                  color: COLORS.textSecondary,
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  fontWeight: '500'
                }}>
                  Lunch
                </div>
                <div style={{ 
                  fontSize: '18px', 
                  fontWeight: '600',
                  color: COLORS.text 
                }}>
                  0
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ 
                  fontSize: '11px', 
                  color: COLORS.textSecondary,
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  fontWeight: '500'
                }}>
                  Dinner
                </div>
                <div style={{ 
                  fontSize: '18px', 
                  fontWeight: '600',
                  color: COLORS.text 
                }}>
                  0
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* History View - Last 30 Days with Progress Bars */}
      {activeView === VIEWS.HISTORY && (
        <div>
          {/* Summary Stats */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ 
              fontSize: '32px', 
              fontWeight: '600',
              color: COLORS.primary,
              marginBottom: '8px'
            }}>
              {stats.historyAvg}
              <span style={{ 
                fontSize: '16px', 
                fontWeight: '400',
                color: COLORS.textSecondary,
                marginLeft: '6px'
              }}>
                cal/day avg
              </span>
            </div>
            
            {/* Quick Stats Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '12px',
              marginBottom: '12px'
            }}>
              <div style={{
                padding: '12px',
                background: COLORS.background,
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <div style={{ 
                  fontSize: '20px', 
                  fontWeight: '600',
                  color: COLORS.text 
                }}>
                  {stats.daysWithData}
                </div>
                <div style={{ 
                  fontSize: '11px', 
                  color: COLORS.textSecondary,
                  marginTop: '2px'
                }}>
                  Days Tracked
                </div>
              </div>
              
              <div style={{
                padding: '12px',
                background: COLORS.background,
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <div style={{ 
                  fontSize: '20px', 
                  fontWeight: '600',
                  color: COLORS.success 
                }}>
                  {stats.daysAtGoal}
                </div>
                <div style={{ 
                  fontSize: '11px', 
                  color: COLORS.textSecondary,
                  marginTop: '2px'
                }}>
                  At Goal
                </div>
              </div>
              
              <div style={{
                padding: '12px',
                background: COLORS.background,
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <div style={{ 
                  fontSize: '20px', 
                  fontWeight: '600',
                  color: COLORS.error 
                }}>
                  {stats.daysOverGoal}
                </div>
                <div style={{ 
                  fontSize: '11px', 
                  color: COLORS.textSecondary,
                  marginTop: '2px'
                }}>
                  Over Goal
                </div>
              </div>
              
              <div style={{
                padding: '12px',
                background: COLORS.background,
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <div style={{ 
                  fontSize: '20px', 
                  fontWeight: '600',
                  color: COLORS.primary 
                }}>
                  {stats.daysUnderGoal}
                </div>
                <div style={{ 
                  fontSize: '11px', 
                  color: COLORS.textSecondary,
                  marginTop: '2px'
                }}>
                  Under Goal
                </div>
              </div>
            </div>
            
            <div style={{ 
              fontSize: '12px', 
              color: COLORS.textSecondary,
              textAlign: 'center'
            }}>
              {stats.historyTotal.toLocaleString()} total calories
            </div>
          </div>

          <div style={{
            padding: '16px',
            background: COLORS.background,
            borderRadius: '10px',
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            <div style={{ 
              fontSize: '12px', 
              color: COLORS.textSecondary,
              marginBottom: '12px',
              fontWeight: '500'
            }}>
              {stats.daysWithData > 0 ? 'Daily Breakdown' : 'No data yet'}
            </div>
            {stats.daysWithData === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: COLORS.textSecondary
              }}>
                <span className="material-icons" style={{ 
                  fontSize: '48px', 
                  color: COLORS.border,
                  marginBottom: '12px',
                  display: 'block'
                }}>
                  calendar_today
                </span>
                <div style={{ fontSize: '14px' }}>
                  Start tracking to see your history
                </div>
              </div>
            ) : (
              <div style={{ 
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                {stats.daysWithDataArray.reverse().map(({ date, total: dayTotal }) => {
                  const dayPercent = dailyGoal > 0 ? (dayTotal / dailyGoal) * 100 : 0;
                  const diff = dayTotal - dailyGoal;
                  const isOver = diff > 0;
                  const isUnder = diff < 0 && dayTotal > 0;
                  const isAtGoal = Math.abs(diff) < 50 && dayTotal > 0;

                  return (
                    <div key={date} style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px'
                      }}>
                        <div style={{
                          fontSize: '11px',
                          color: COLORS.textSecondary,
                          width: '70px',
                          flexShrink: 0
                        }}>
                          {formatDisplayDate(date)}
                        </div>
                        <div style={{
                          flex: 1,
                          height: '24px',
                          background: '#e8e8e8',
                          borderRadius: '6px',
                          overflow: 'hidden',
                          position: 'relative'
                        }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(dayPercent, 100)}%`,
                            background: isAtGoal || dayPercent >= 95 && dayPercent <= 105
                              ? COLORS.success
                              : isOver
                                ? COLORS.error
                                : COLORS.primary,
                            borderRadius: '6px',
                            transition: 'width 0.3s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            paddingRight: '8px'
                          }}>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: '600',
                              color: 'white'
                            }}>
                              {dayTotal}
                            </span>
                          </div>
                          {/* Goal line marker */}
                          {dailyGoal > 0 && (
                            <div style={{
                              position: 'absolute',
                              right: 0,
                              top: 0,
                              bottom: 0,
                              width: '2px',
                              background: 'rgba(0,0,0,0.2)'
                            }} />
                          )}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          color: isAtGoal
                            ? COLORS.success
                            : isOver
                              ? COLORS.error
                              : COLORS.primary,
                          width: '60px',
                          textAlign: 'right',
                          flexShrink: 0
                        }}>
                          {isOver 
                            ? `+${Math.abs(diff)}`
                            : isUnder
                              ? `-${Math.abs(diff)}`
                              : '✓'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {stats.daysWithData > 0 && (
              <div style={{
                marginTop: '16px',
                padding: '12px',
                background: 'white',
                borderRadius: '8px',
                fontSize: '11px',
                color: COLORS.textSecondary,
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ 
                    width: '12px', 
                    height: '12px', 
                    borderRadius: '2px', 
                    background: COLORS.success 
                  }} />
                  <span>At goal</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ 
                    width: '12px', 
                    height: '12px', 
                    borderRadius: '2px', 
                    background: COLORS.primary 
                  }} />
                  <span>Under goal</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ 
                    width: '12px', 
                    height: '12px', 
                    borderRadius: '2px', 
                    background: COLORS.error 
                  }} />
                  <span>Over goal</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default StatsPanel;

