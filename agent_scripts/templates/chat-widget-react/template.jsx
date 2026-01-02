import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'

function ChatRoomWidget() {
  // Generate stable user ID
  const userId = useMemo(() => generateUserId(), [])
  
  // Widget storage for chat state (widget-specific, persisted per instance)
  const [chatData, setChatData] = useStorage('chat-room-data', {
    messages: [],
    users: {},
    channelName: 'chat-room',
    lastSync: 0
  })
  
  // Local UI state
  const [userName, setUserName] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [messageInput, setMessageInput] = useState('')
  const [isEditingChannel, setIsEditingChannel] = useState(false)
  const [channelNameInput, setChannelNameInput] = useState('')
  
  // Refs
  const messagesContainerRef = useRef(null)
  const messageInputRef = useRef(null)
  const channelInputRef = useRef(null)
  
  // Constants
  const MAX_MESSAGES = 100
  
  // Load user name from stored users
  useEffect(() => {
    if (chatData?.users?.[userId]) {
      setUserName(chatData.users[userId].name)
    }
  }, [chatData, userId])
  
  // Auto-scroll to bottom when messages change
  // Track last message ID to detect changes even when length stays at MAX_MESSAGES
  const lastMessageId = useMemo(() => {
    const messages = chatData?.messages || []
    return messages.length > 0 ? messages[messages.length - 1].id : null
  }, [chatData?.messages])
  
  useEffect(() => {
    if (messagesContainerRef.current && userName && lastMessageId) {
      const container = messagesContainerRef.current
      
      // Use requestAnimationFrame for smooth scrolling after DOM updates
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight
        })
      })
    }
  }, [lastMessageId, userName])
  
  // Focus channel name input when editing
  useEffect(() => {
    if (isEditingChannel && channelInputRef.current) {
      channelInputRef.current.focus()
      channelInputRef.current.select()
    }
  }, [isEditingChannel])
  
  // Join chat handler
  const handleJoinChat = useCallback(() => {
    const name = nameInput.trim()
    
    if (!name) {
      alert('Please enter your name')
      return
    }
    
    if (name.length > 30) {
      alert('Name must be 30 characters or less')
      return
    }
    
    // Check if name is already taken
    if (chatData?.users) {
      for (const [uid, user] of Object.entries(chatData.users)) {
        if (user.name === name && uid !== userId) {
          alert('This name is already taken')
          return
        }
      }
    }
    
    // Update chat data
    const newUsers = { ...(chatData?.users || {}), [userId]: { id: userId, name, joinedAt: Date.now() } }
    const newMessages = [...(chatData?.messages || [])]
    
    // Add join system message
    newMessages.push({
      id: generateMessageId(),
      text: `${name} joined the chat`,
      timestamp: Date.now(),
      type: 'system'
    })
    
    // Limit message history
    if (newMessages.length > MAX_MESSAGES) {
      newMessages.splice(0, newMessages.length - MAX_MESSAGES)
    }
    
    setChatData({
      ...chatData,
      messages: newMessages,
      users: newUsers,
      lastSync: Date.now()
    })
    
    setUserName(name)
  }, [nameInput, userId, chatData, setChatData])
  
  // Send message handler
  const handleSendMessage = useCallback(() => {
    const text = messageInput.trim()
    
    if (!text || !userName) return
    
    const newMessage = {
      id: generateMessageId(),
      userId,
      userName,
      text,
      timestamp: Date.now(),
      type: 'user'
    }
    
    const newMessages = [...(chatData?.messages || []), newMessage]
    
    // Limit message history
    if (newMessages.length > MAX_MESSAGES) {
      newMessages.splice(0, newMessages.length - MAX_MESSAGES)
    }
    
    setChatData({
      ...chatData,
      messages: newMessages,
      lastSync: Date.now()
    })
    
    setMessageInput('')
    
    // Focus back on input
    if (messageInputRef.current) {
      messageInputRef.current.focus()
    }
  }, [messageInput, userName, userId, chatData, setChatData])
  
  // Start editing channel name
  const handleStartEditChannel = useCallback(() => {
    setChannelNameInput(chatData?.channelName || 'chat-room')
    setIsEditingChannel(true)
  }, [chatData?.channelName])
  
  // Save channel name
  const handleSaveChannelName = useCallback(() => {
    const newName = channelNameInput.trim()
    
    if (newName && newName !== chatData?.channelName && newName.length <= 30) {
      // Add system message about name change
      const newMessages = [...(chatData?.messages || [])]
      newMessages.push({
        id: generateMessageId(),
        text: `Channel renamed to #${newName}`,
        timestamp: Date.now(),
        type: 'system'
      })
      
      // Limit message history
      if (newMessages.length > MAX_MESSAGES) {
        newMessages.splice(0, newMessages.length - MAX_MESSAGES)
      }
      
      setChatData({
        ...chatData,
        channelName: newName,
        messages: newMessages,
        lastSync: Date.now()
      })
    }
    
    setIsEditingChannel(false)
  }, [channelNameInput, chatData, setChatData])
  
  // Handle key presses
  const handleNameInputKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      handleJoinChat()
    }
  }, [handleJoinChat])
  
  const handleMessageInputKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }, [handleSendMessage])
  
  const handleChannelInputKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      handleSaveChannelName()
    } else if (e.key === 'Escape') {
      setIsEditingChannel(false)
    }
  }, [handleSaveChannelName])
  
  const handleChannelInputBlur = useCallback(() => {
    handleSaveChannelName()
  }, [handleSaveChannelName])
  
  // Format time
  const formatTime = useCallback((timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    
    // If today, show time only
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    
    // If this year, show month/day and time
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
             date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    
    // Otherwise show full date
    return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) + ' ' +
           date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }, [])
  
  // Get avatar letter
  const getAvatarLetter = useCallback((name) => {
    return name ? name.charAt(0).toUpperCase() : '?'
  }, [])
  
  // Check if user has joined
  const hasJoined = Boolean(userName && chatData?.users?.[userId])
  
  // Render join screen
  if (!hasJoined) {
    return (
      <div style={styles.joinScreen}>
        <h1 style={styles.joinTitle}>💬 Join Chat</h1>
        <p style={styles.joinSubtitle}>Enter your name to start chatting</p>
        
        <div style={styles.joinForm}>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyPress={handleNameInputKeyPress}
            placeholder="Enter your name"
            maxLength={30}
            style={styles.inputField}
          />
          <button
            onClick={handleJoinChat}
            disabled={!nameInput.trim()}
            style={{
              ...styles.joinButton,
              ...(nameInput.trim() ? {} : styles.joinButtonDisabled)
            }}
          >
            Join Chat
          </button>
        </div>
      </div>
    )
  }
  
  // Render chat screen
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.channelIcon}>#</div>
        {isEditingChannel ? (
          <input
            ref={channelInputRef}
            type="text"
            value={channelNameInput}
            onChange={(e) => setChannelNameInput(e.target.value)}
            onKeyPress={handleChannelInputKeyPress}
            onBlur={handleChannelInputBlur}
            maxLength={30}
            style={styles.channelNameInput}
          />
        ) : (
          <div
            style={styles.channelName}
            onClick={handleStartEditChannel}
          >
            {chatData?.channelName || 'chat-room'}
          </div>
        )}
        <div style={styles.channelDescription}>Real-time chat widget</div>
      </div>
      
      {/* Messages */}
      <div ref={messagesContainerRef} style={styles.messagesContainer}>
        {(chatData?.messages || []).map((message) => {
          if (message.type === 'system') {
            return (
              <div key={message.id} style={styles.systemMessage}>
                <div style={styles.systemMessageAvatar}>ℹ️</div>
                <div>{message.text}</div>
              </div>
            )
          }
          
          return (
            <div key={message.id} style={styles.message}>
              <div style={styles.messageAvatar}>
                {getAvatarLetter(message.userName)}
              </div>
              <div style={styles.messageContent}>
                <div style={styles.messageHeader}>
                  <span style={styles.messageAuthor}>{message.userName}</span>
                  <span style={styles.messageTime}>{formatTime(message.timestamp)}</span>
                </div>
                <div style={styles.messageText}>{message.text}</div>
              </div>
            </div>
          )
        })}
      </div>
      
      {/* Input */}
      <div style={styles.inputContainer}>
        <div style={styles.inputWrapper}>
          <textarea
            ref={messageInputRef}
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={handleMessageInputKeyPress}
            placeholder="Type a message..."
            rows={1}
            style={styles.messageInput}
          />
          <button
            onClick={handleSendMessage}
            disabled={!messageInput.trim()}
            style={{
              ...styles.sendButton,
              ...(messageInput.trim() ? {} : styles.sendButtonDisabled)
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

// Helper functions
function generateUserId() {
  // Try to get authenticated user ID first
  const authToken = getAuthToken()
  if (authToken) {
    try {
      const payload = JSON.parse(atob(authToken.split('.')[1]))
      return payload.sub // Clerk user ID
    } catch (error) {
      console.log('Failed to parse auth token')
    }
  }
  
  // Generate stable computer-specific ID
  return generateStableComputerId()
}

function getAuthToken() {
  // Check multiple sources for Clerk token
  if (typeof window !== 'undefined') {
    if (window.__clerk_token) return window.__clerk_token
    
    const localStorageToken = localStorage.getItem('__session')
    if (localStorageToken) return localStorageToken
    
    const cookies = document.cookie.split(';')
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=')
      if (name === '__session') return value
    }
  }
  
  return null
}

function generateStableComputerId() {
  const components = [
    navigator.userAgent,
    navigator.platform,
    navigator.language,
    screen.width + 'x' + screen.height + 'x' + screen.colorDepth,
    navigator.hardwareConcurrency || 'unknown',
    navigator.deviceMemory || 'unknown',
    navigator.maxTouchPoints || 0,
    getWebGLFingerprint(),
    navigator.cookieEnabled ? 'cookies' : 'no-cookies'
  ]
  
  const fingerprint = components.join('||')
  
  // Hash it
  let hash = 0
  for (let i = 0; i < fingerprint.length; i++) {
    hash = ((hash << 5) - hash) + fingerprint.charCodeAt(i)
    hash = hash & hash
  }
  
  return 'user_' + Math.abs(hash).toString(36)
}

function getWebGLFingerprint() {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (gl) {
      const renderer = gl.getParameter(gl.RENDERER)
      const vendor = gl.getParameter(gl.VENDOR)
      return renderer + '|' + vendor
    }
  } catch (e) {
    return 'no-webgl'
  }
  return 'no-webgl'
}

function generateMessageId() {
  return Date.now() + '_' + Math.random().toString(36).substr(2, 9)
}

// Styles
const styles = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    background: '#ffffff',
    color: '#1d1c1d',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative'
  },
  
  // Header
  header: {
    background: '#ffffff',
    borderBottom: '1px solid #e1e5e9',
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minHeight: '60px'
  },
  channelIcon: {
    width: '20px',
    height: '20px',
    background: '#4a154b',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: 'bold',
    fontSize: '12px'
  },
  channelName: {
    fontSize: '18px',
    fontWeight: '900',
    color: '#1d1c1d',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
    transition: 'background-color 0.2s ease'
  },
  channelNameInput: {
    fontSize: '18px',
    fontWeight: '900',
    color: '#1d1c1d',
    background: 'transparent',
    border: '1px solid #1264a3',
    borderRadius: '4px',
    padding: '4px 8px',
    outline: 'none',
    minWidth: '120px'
  },
  channelDescription: {
    fontSize: '13px',
    color: '#616061',
    marginLeft: 'auto'
  },
  
  // Messages
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  message: {
    display: 'flex',
    gap: '12px',
    padding: '8px 0'
  },
  messageAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: '600',
    fontSize: '14px',
    flexShrink: 0
  },
  messageContent: {
    flex: 1,
    minWidth: 0
  },
  messageHeader: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
    marginBottom: '4px'
  },
  messageAuthor: {
    fontWeight: '900',
    color: '#1d1c1d',
    fontSize: '15px'
  },
  messageTime: {
    fontSize: '12px',
    color: '#616061'
  },
  messageText: {
    color: '#1d1c1d',
    fontSize: '15px',
    lineHeight: '1.46667',
    wordWrap: 'break-word',
    whiteSpace: 'pre-wrap'
  },
  
  // System messages
  systemMessage: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 0',
    color: '#616061',
    fontSize: '13px',
    fontStyle: 'italic'
  },
  systemMessageAvatar: {
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px'
  },
  
  // Input
  inputContainer: {
    padding: '20px',
    borderTop: '1px solid #e1e5e9',
    background: '#ffffff'
  },
  inputWrapper: {
    border: '1px solid #e1e5e9',
    borderRadius: '8px',
    background: '#ffffff',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center'
  },
  messageInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    padding: '12px 16px',
    fontSize: '15px',
    fontFamily: 'inherit',
    background: 'transparent',
    resize: 'none',
    minHeight: '20px',
    maxHeight: '120px',
    lineHeight: '1.46667'
  },
  sendButton: {
    background: '#007a5a',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    padding: '8px 12px',
    margin: '6px 8px 6px 0',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    transition: 'background-color 0.2s ease'
  },
  sendButtonDisabled: {
    background: '#e1e5e9',
    color: '#616061',
    cursor: 'not-allowed'
  },
  
  // Join screen
  joinScreen: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '40px',
    textAlign: 'center',
    background: '#ffffff'
  },
  joinTitle: {
    fontSize: '28px',
    fontWeight: '900',
    color: '#1d1c1d',
    marginBottom: '8px'
  },
  joinSubtitle: {
    fontSize: '16px',
    color: '#616061',
    marginBottom: '32px'
  },
  joinForm: {
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  inputField: {
    padding: '12px 16px',
    border: '1px solid #e1e5e9',
    borderRadius: '8px',
    fontSize: '16px',
    fontFamily: 'inherit',
    background: '#ffffff',
    transition: 'border-color 0.2s ease',
    outline: 'none'
  },
  joinButton: {
    background: '#007a5a',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease'
  },
  joinButtonDisabled: {
    background: '#e1e5e9',
    color: '#616061',
    cursor: 'not-allowed'
  }
}

export default ChatRoomWidget

