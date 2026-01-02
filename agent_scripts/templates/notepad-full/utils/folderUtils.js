// Utility functions for folder operations

export function generateFolderId() {
  return `folder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function getNotesInFolder(notes, folderId) {
  if (!notes) return [];
  return notes.filter(note => note.folderId === folderId);
}

export function getRootNotes(notes) {
  if (!notes) return [];
  return notes.filter(note => !note.folderId || note.folderId === null);
}

export function getFoldersWithNotes(notes, folders) {
  if (!folders) return [];
  return folders.map(folder => ({
    ...folder,
    noteCount: getNotesInFolder(notes, folder.id).length
  }));
}

export function sortFoldersByOrder(folders) {
  if (!folders) return [];
  return [...folders].sort((a, b) => {
    const orderA = a.order !== undefined ? a.order : Infinity;
    const orderB = b.order !== undefined ? b.order : Infinity;
    if (orderA !== orderB) return orderA - orderB;
    // If same order, sort by name
    return (a.name || '').localeCompare(b.name || '');
  });
}
