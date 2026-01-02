import React, { useState, useEffect, useMemo } from 'react';

function ScheduleWidget() {
  const [tailwindLoaded, setTailwindLoaded] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [events, setEvents] = useGlobalStorage('schedule-events', []);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  // Load Tailwind CSS
  useEffect(() => {
    if (!document.getElementById('tailwind-script')) {
      const tailwindScript = document.createElement('script');
      tailwindScript.id = 'tailwind-script';
      tailwindScript.src = 'https://cdn.tailwindcss.com';
      tailwindScript.onload = () => {
        setTimeout(() => setTailwindLoaded(true), 100);
      };
      document.head.appendChild(tailwindScript);
    } else {
      setTailwindLoaded(true);
    }

    // Set pure white background
    document.body.style.background = '#ffffff';
    document.documentElement.style.minHeight = '100%';
    return () => {
      document.body.style.background = '';
      document.documentElement.style.minHeight = '';
    };
  }, []);

  // Generate time slots from 6 AM to 10 PM
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 6; hour <= 22; hour++) {
      const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const period = hour >= 12 ? 'PM' : 'AM';
      slots.push({
        hour,
        label: `${hour12}:00 ${period}`,
        time: `${hour.toString().padStart(2, '0')}:00`
      });
    }
    return slots;
  }, []);

  // Filter events for selected date
  const todayEvents = useMemo(() => {
    return events
      .filter(event => event.date === selectedDate)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [events, selectedDate]);

  const addEvent = (hour) => {
    setEditingEvent({
      date: selectedDate,
      time: `${hour.toString().padStart(2, '0')}:00`,
      title: '',
      duration: 60
    });
    setShowAddModal(true);
  };

  const saveEvent = (eventData) => {
    if (editingEvent.id) {
      // Update existing event
      setEvents(events.map(e => e.id === editingEvent.id ? { ...e, ...eventData } : e));
    } else {
      // Add new event
      setEvents([...events, { ...eventData, id: Date.now() }]);
    }
    setShowAddModal(false);
    setEditingEvent(null);
  };

  const deleteEvent = (id) => {
    setEvents(events.filter(e => e.id !== id));
  };

  const editEvent = (event) => {
    setEditingEvent(event);
    setShowAddModal(true);
  };

  // Navigate dates
  const changeDate = (delta) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + delta);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const goToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  // Format date display
  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  if (!tailwindLoaded) {
    return (
      <div style={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", sans-serif',
        color: '#000000'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto bg-white" style={{ 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", sans-serif'
    }}>
      {/* Header */}
      <div className="px-12 pt-12 pb-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-light tracking-tight text-gray-900 mb-2">
              Schedule
            </h1>
            <p className="text-sm font-normal text-gray-500">
              {formatDate(selectedDate)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => changeDate(-1)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              style={{
                border: '1px solid #f0f0f0',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)'
              }}
            >
              Previous
            </button>
            {!isToday && (
              <button
                onClick={goToToday}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                style={{
                  border: '1px solid #f0f0f0',
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)'
                }}
              >
                Today
              </button>
            )}
            <button
              onClick={() => changeDate(1)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              style={{
                border: '1px solid #f0f0f0',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)'
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Schedule Grid */}
      <div className="px-12 pb-12">
        <div className="space-y-0">
          {timeSlots.map((slot) => {
            const slotEvents = todayEvents.filter(e => e.time === slot.time);
            
            return (
              <div
                key={slot.hour}
                className="flex group hover:bg-gray-50 transition-colors"
                style={{
                  borderTop: '1px solid #f0f0f0',
                  minHeight: '80px'
                }}
              >
                {/* Time Label */}
                <div className="w-32 py-6 pr-8">
                  <span className="text-sm font-light text-gray-500">
                    {slot.label}
                  </span>
                </div>

                {/* Event Area */}
                <div className="flex-1 py-4 pl-8" style={{ borderLeft: '1px solid #f0f0f0' }}>
                  {slotEvents.length > 0 ? (
                    <div className="space-y-3">
                      {slotEvents.map((event) => (
                        <div
                          key={event.id}
                          className="group/event cursor-pointer"
                          onClick={() => editEvent(event)}
                        >
                          <div
                            className="px-6 py-4 bg-white hover:bg-blue-50 transition-all duration-200"
                            style={{
                              border: '1px solid #f0f0f0',
                              borderRadius: '12px',
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
                              borderLeft: '3px solid #3b82f6'
                            }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="text-base font-medium text-gray-900 mb-1">
                                  {event.title}
                                </h3>
                                <p className="text-sm font-light text-gray-500">
                                  {event.duration} minutes
                                </p>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteEvent(event.id);
                                }}
                                className="opacity-0 group-hover/event:opacity-100 transition-opacity text-gray-400 hover:text-red-500 ml-4"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <button
                      onClick={() => addEvent(slot.hour)}
                      className="w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <span className="text-sm font-light text-gray-400 hover:text-gray-600">
                        + Add event
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center"
          style={{ zIndex: 1000 }}
          onClick={() => {
            setShowAddModal(false);
            setEditingEvent(null);
          }}
        >
          <div
            className="bg-white p-10 w-full max-w-md"
            style={{
              borderRadius: '16px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.08)',
              border: '1px solid #f0f0f0'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-light text-gray-900 mb-8">
              {editingEvent?.id ? 'Edit Event' : 'New Event'}
            </h2>
            
            <EventForm
              event={editingEvent}
              onSave={saveEvent}
              onCancel={() => {
                setShowAddModal(false);
                setEditingEvent(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function EventForm({ event, onSave, onCancel }) {
  const [title, setTitle] = useState(event?.title || '');
  const [time, setTime] = useState(event?.time || '09:00');
  const [duration, setDuration] = useState(event?.duration || 60);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    onSave({
      ...event,
      title: title.trim(),
      time,
      duration: parseInt(duration)
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Event title"
          className="w-full px-5 py-3 text-base text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all"
          style={{
            border: '1px solid #f0f0f0',
            borderRadius: '10px'
          }}
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Time
        </label>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-full px-5 py-3 text-base text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all"
          style={{
            border: '1px solid #f0f0f0',
            borderRadius: '10px'
          }}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Duration (minutes)
        </label>
        <select
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className="w-full px-5 py-3 text-base text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all"
          style={{
            border: '1px solid #f0f0f0',
            borderRadius: '10px'
          }}
        >
          <option value="15">15 minutes</option>
          <option value="30">30 minutes</option>
          <option value="45">45 minutes</option>
          <option value="60">1 hour</option>
          <option value="90">1.5 hours</option>
          <option value="120">2 hours</option>
          <option value="180">3 hours</option>
        </select>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-6 py-3 text-base font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          style={{
            border: '1px solid #f0f0f0',
            borderRadius: '10px'
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!title.trim()}
          className="flex-1 px-6 py-3 text-base font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: title.trim() ? '#3b82f6' : '#93bbef',
            borderRadius: '10px',
            border: 'none',
            boxShadow: title.trim() ? '0 4px 12px rgba(59, 130, 246, 0.2)' : 'none'
          }}
        >
          Save
        </button>
      </div>
    </form>
  );
}

export default ScheduleWidget;
