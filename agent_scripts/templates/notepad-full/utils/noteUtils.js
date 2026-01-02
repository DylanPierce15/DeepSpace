// Utility functions for note operations

export function generateNoteId() {
  return `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Strip HTML tags and get clean text
function stripHtml(html) {
  if (!html) return '';
  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, ' ');
  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

// Extract title from note content (first line, like Apple Notes)
export function extractNoteTitle(content) {
  if (!content || content.trim() === '') return 'New Note';
  
  const cleanText = stripHtml(content);
  if (!cleanText) return 'New Note';
  
  // Get first line (up to 60 chars for title)
  const firstLine = cleanText.split('\n')[0].trim();
  if (!firstLine) return 'New Note';
  
  if (firstLine.length <= 60) return firstLine;
  return firstLine.substring(0, 60) + '...';
}

// Get preview text (first line for title, rest for preview)
export function getNotePreview(content) {
  if (!content || content.trim() === '') return { title: 'New Note', preview: '' };
  
  const cleanText = stripHtml(content);
  if (!cleanText) return { title: 'New Note', preview: '' };
  
  const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l);
  
  if (lines.length === 0) return { title: 'New Note', preview: '' };
  
  // First line is the title
  const title = lines[0].length > 60 ? lines[0].substring(0, 60) + '...' : lines[0];
  
  // Rest is preview
  const previewLines = lines.slice(1);
  const preview = previewLines.join(' ');
  const truncatedPreview = preview.length > 100 ? preview.substring(0, 100) + '...' : preview;
  
  return { title, preview: truncatedPreview };
}

export function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    // Today - show time
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  } else {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }
}

export function filterNotes(notes, searchQuery) {
  if (!searchQuery || searchQuery.trim() === '') return notes;
  const query = searchQuery.toLowerCase();
  return notes.filter(note => 
    note.content.toLowerCase().includes(query) ||
    note.title?.toLowerCase().includes(query)
  );
}

export function sortNotesByUpdated(notes) {
  return [...notes].sort((a, b) => {
    const timeA = a.updatedAt || a.createdAt || 0;
    const timeB = b.updatedAt || b.createdAt || 0;
    return timeB - timeA; // Most recent first
  });
}
