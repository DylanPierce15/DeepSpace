import React, { useState, useCallback, useMemo } from 'react';
import FolderSidebar from './components/FolderSidebar';
import NotesList from './components/NotesList';
import RichTextEditor from './components/RichTextEditor';
import AIChatModal from './components/AIChatModal';
import { ToastContainer } from './components/Toast';
import { sortNotesByUpdated } from './utils/noteUtils';

function AppleNotesWidget() {
  // Store notes array, folders, and selected IDs
  const [notes, setNotes] = useStorage('notes', []);
  const [folders, setFolders] = useStorage('folders', []);
  const [selectedNoteId, setSelectedNoteId] = useStorage('selectedNoteId', null);
  const [selectedFolderId, setSelectedFolderId] = useStorage('selectedFolderId', null);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiChatOpen, setAiChatOpen] = useState(false);

  // Get currently selected note
  const selectedNote = useMemo(() => {
    if (!selectedNoteId || !notes || notes.length === 0) return null;
    return notes.find(n => n.id === selectedNoteId) || null;
  }, [notes, selectedNoteId]);

  // Create a new note
  const handleCreateNote = useCallback((newNote) => {
    setNotes(prev => [...(prev || []), newNote]);
    setSelectedNoteId(newNote.id); // Auto-select new note
  }, [setNotes, setSelectedNoteId]);

  // Create a new folder
  const handleCreateFolder = useCallback((newFolder) => {
    setFolders(prev => [...(prev || []), newFolder]);
  }, [setFolders]);

  // Select a folder
  const handleSelectFolder = useCallback((folderId) => {
    setSelectedFolderId(folderId);
    setSelectedNoteId(null); // Clear note selection when changing folders
    setSearchQuery(''); // Clear search
  }, [setSelectedFolderId, setSelectedNoteId]);

  // Select a note
  const handleSelectNote = useCallback((noteId) => {
    setSelectedNoteId(noteId);
    setSearchQuery(''); // Clear search when selecting a note
  }, [setSelectedNoteId]);

  // Update a note
  const handleUpdateNote = useCallback((updatedNote) => {
    console.log('handleUpdateNote called with:', updatedNote);
    setNotes(prev => {
      if (!prev) return [updatedNote];
      const existingNote = prev.find(n => n.id === updatedNote.id);
      
      console.log('Existing note content length:', existingNote?.content?.length);
      console.log('Updated note content length:', updatedNote?.content?.length);
      
      if (existingNote && existingNote.content === updatedNote.content) {
        console.log('Content unchanged, skipping update');
        return prev; // No change
      }
      
      console.log('Updating note in storage');
      const newNotes = prev.map(note => 
        note.id === updatedNote.id ? updatedNote : note
      );
      return newNotes;
    });
  }, [setNotes]);

  // Delete a note
  const handleDeleteNote = useCallback((noteId) => {
    setNotes(prev => {
      if (!prev) return [];
      const filtered = prev.filter(note => note.id !== noteId);
      
      if (noteId === selectedNoteId) {
        if (filtered.length > 0) {
          const sorted = sortNotesByUpdated(filtered);
          setSelectedNoteId(sorted[0].id);
        } else {
          setSelectedNoteId(null);
        }
      }
      
      return filtered;
    });
  }, [setNotes, selectedNoteId, setSelectedNoteId]);

  // Delete a folder
  const handleDeleteFolder = useCallback((folderId) => {
    setFolders(prev => {
      if (!prev) return [];
      return prev.filter(f => f.id !== folderId);
    });
    
    // Delete all notes in this folder
    setNotes(prev => {
      if (!prev) return [];
      const filtered = prev.filter(note => note.folderId !== folderId);
      
      // If selected folder was deleted, switch to "All Notes"
      if (folderId === selectedFolderId) {
        setSelectedFolderId(null);
      }
      
      // If a note in this folder was selected, deselect it
      const selectedNote = prev.find(n => n.id === selectedNoteId);
      if (selectedNote && selectedNote.folderId === folderId) {
        if (filtered.length > 0) {
          const sorted = sortNotesByUpdated(filtered);
          setSelectedNoteId(sorted[0].id);
        } else {
          setSelectedNoteId(null);
        }
      }
      
      return filtered;
    });
  }, [setFolders, setNotes, selectedFolderId, setSelectedFolderId, selectedNoteId, setSelectedNoteId]);

  // Rename a folder
  const handleRenameFolder = useCallback((folderId, newName) => {
    setFolders(prev => {
      if (!prev) return [];
      return prev.map(folder => 
        folder.id === folderId ? { ...folder, name: newName } : folder
      );
    });
  }, [setFolders]);

  // Drop note into folder (or null for root)
  const handleDropNote = useCallback((noteId, targetFolderId) => {
    setNotes(prev => {
      if (!prev) return prev;
      return prev.map(note => 
        note.id === noteId ? { ...note, folderId: targetFolderId, updatedAt: Date.now() } : note
      );
    });
  }, [setNotes]);

  // Drop folder into another folder (create subfolder/nesting)
  const handleDropFolder = useCallback((folderId, targetFolderId) => {
    setFolders(prev => {
      if (!prev) return prev;
      return prev.map(folder => {
        if (folder.id === folderId) {
          // Move folder into target folder (set parentId)
          return { ...folder, parentId: targetFolderId };
        }
        return folder;
      });
    });
  }, [setFolders]);

  // Auto-select first note if none selected but notes exist in current folder
  React.useEffect(() => {
    if (!selectedNoteId && notes && notes.length > 0) {
      // Only auto-select if we're in a specific folder view
      if (selectedFolderId !== null) {
        const folderNotes = notes.filter(n => n.folderId === selectedFolderId);
        if (folderNotes.length > 0) {
          const sorted = sortNotesByUpdated(folderNotes);
          setSelectedNoteId(sorted[0].id);
        }
      }
    }
  }, [notes, selectedNoteId, selectedFolderId, setSelectedNoteId]);

  return (
    <>
      <div style={{
        margin: 0,
        padding: 0,
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif',
        background: '#ffffff',
        display: 'flex',
        height: '100%',
        width: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}>
        <FolderSidebar
          folders={folders || []}
          notes={notes || []}
          selectedFolderId={selectedFolderId}
          onSelectFolder={handleSelectFolder}
          onCreateFolder={handleCreateFolder}
          onDeleteFolder={handleDeleteFolder}
          onRenameFolder={handleRenameFolder}
          onDropFolder={handleDropFolder}
          onDropNote={handleDropNote}
        />
        
        <NotesList
          notes={notes || []}
          selectedFolderId={selectedFolderId}
          selectedNoteId={selectedNoteId}
          searchQuery={searchQuery}
          onSelectNote={handleSelectNote}
          onDeleteNote={handleDeleteNote}
          onCreateNote={handleCreateNote}
          onSearchChange={setSearchQuery}
          onDropNote={handleDropNote}
        />
        
        <RichTextEditor
          note={selectedNote}
          onUpdate={handleUpdateNote}
          onOpenAIChat={() => setAiChatOpen(true)}
        />
      </div>
      
      <AIChatModal
        isOpen={aiChatOpen}
        onClose={() => setAiChatOpen(false)}
        onCreateNote={handleCreateNote}
        allNotes={notes || []}
        currentFolderId={selectedFolderId}
      />
      
      <ToastContainer />
    </>
  );
}

export default AppleNotesWidget;
