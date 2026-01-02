import React, { useMemo, useState } from 'react';
import SearchBar from './SearchBar';
import NoteItem from './NoteItem';
import { filterNotes, sortNotesByUpdated } from '../utils/noteUtils';
import { getNotesInFolder, getRootNotes } from '../utils/folderUtils';

export default function NotesList({ 
  notes, 
  selectedFolderId,
  selectedNoteId, 
  searchQuery, 
  onSelectNote, 
  onDeleteNote, 
  onCreateNote, 
  onSearchChange,
  onDropNote
}) {
  const [dragOverRoot, setDragOverRoot] = useState(false);

  // Filter and sort notes
  const filteredNotes = useMemo(() => {
    if (searchQuery) {
      return sortNotesByUpdated(filterNotes(notes, searchQuery));
    }
    
    if (selectedFolderId === null) {
      return sortNotesByUpdated(getRootNotes(notes));
    }
    
    return sortNotesByUpdated(getNotesInFolder(notes, selectedFolderId));
  }, [notes, selectedFolderId, searchQuery]);

  const handleCreateNote = () => {
    const newNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content: '',
      folderId: selectedFolderId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    onCreateNote(newNote);
    onSelectNote(newNote.id);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverRoot(false);
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.type === 'note' && onDropNote) {
        onDropNote(data.id, selectedFolderId);
      }
    } catch (err) {
      // Ignore parse errors
    }
  };

  return (
    <div style={{
      width: '280px',
      borderRight: '1px solid #e5e7eb',
      backgroundColor: '#fafafa',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'white',
        height: '48px',
        boxSizing: 'border-box'
      }}>
        <div style={{ fontSize: '18px', fontWeight: 600, color: '#111827' }}>
          Notes
        </div>
        <button
          onClick={handleCreateNote}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: '#3b82f6',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            lineHeight: 1,
            fontWeight: 300,
            transition: 'background-color 0.15s'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#2563eb'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#3b82f6'}
          title="New Note"
        >
          +
        </button>
      </div>

      <SearchBar searchQuery={searchQuery} onSearchChange={onSearchChange} />

      {/* Notes list */}
      <div 
        style={{
          flex: 1,
          overflowY: 'auto',
          backgroundColor: 'white',
          borderTop: dragOverRoot ? '2px solid #3b82f6' : 'none'
        }}
        onDragOver={(e) => { e.preventDefault(); setDragOverRoot(true); }}
        onDragLeave={() => setDragOverRoot(false)}
        onDrop={handleDrop}
      >
        {filteredNotes.length === 0 ? (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: '#9ca3af',
            fontSize: '14px'
          }}>
            {searchQuery ? 'No notes found' : 'No notes yet\nClick + to create one'}
          </div>
        ) : (
          filteredNotes.map(note => (
            <NoteItem
              key={note.id}
              note={note}
              isSelected={note.id === selectedNoteId}
              onSelect={onSelectNote}
              onDelete={onDeleteNote}
              onDropNote={onDropNote}
            />
          ))
        )}
      </div>
    </div>
  );
}
