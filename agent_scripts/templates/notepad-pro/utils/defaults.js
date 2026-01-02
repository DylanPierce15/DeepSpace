/**
 * Default files for Notepad Pro widget initialization
 * Note: Content is stored as HTML for the TipTap editor
 */

export const DEFAULT_CONFIG = {
  currentNote: 'welcome.md',
  currentFolder: '',
  expandedFolders: ['projects/']
};

export const DEFAULT_NOTES = {
  'welcome.md': `<h1>Welcome to Notepad Pro</h1>
<p>Your professional note-taking companion with file-based storage.</p>
<h2>Features</h2>
<ul>
  <li><strong>Rich Text Editing</strong> — Format your notes with headings, lists, code blocks, and more</li>
  <li><strong>Folder Organization</strong> — Create nested folders to organize your notes</li>
  <li><strong>Real-time Sync</strong> — Changes are saved instantly and synced across devices</li>
  <li><strong>Drag & Drop</strong> — Move notes between folders with ease</li>
  <li><strong>Search</strong> — Quickly find any note by content or title</li>
</ul>
<h2>Getting Started</h2>
<ol>
  <li>Create a new note using the <strong>New Note</strong> button</li>
  <li>Organize with folders using the sidebar</li>
  <li>Double-click any note or folder to rename it</li>
  <li>Right-click for more options</li>
</ol>
<p>Happy writing!</p>`,

  'quick-notes.md': `<h1>Quick Notes</h1>
<p>A place for quick thoughts and ideas.</p>
<ul>
  <li>Remember to review project timeline</li>
  <li>Schedule team sync for next week</li>
  <li>Ideas for new features:
    <ul>
      <li>Dark mode support</li>
      <li>Export to PDF</li>
      <li>Tags and labels</li>
    </ul>
  </li>
</ul>`,

  'projects/.folder': '',
  
  'projects/project-alpha.md': `<h1>Project Alpha</h1>
<h2>Overview</h2>
<p>This is a sample project note demonstrating folder organization.</p>
<h2>Tasks</h2>
<ul>
  <li>Define requirements</li>
  <li>Create wireframes</li>
  <li>Build prototype</li>
  <li>User testing</li>
</ul>
<h2>Notes</h2>
<p>Add your project notes here...</p>`,

  'projects/meeting-notes.md': `<h1>Meeting Notes</h1>
<h2>Weekly Standup — Week 1</h2>
<p><strong>Attendees:</strong> Team</p>
<h3>Updates</h3>
<ul>
  <li>Completed initial setup</li>
  <li>Started documentation</li>
</ul>
<h3>Action Items</h3>
<ol>
  <li>Review design specs</li>
  <li>Prepare demo for stakeholders</li>
</ol>
<p><em>Next meeting: TBD</em></p>`
};

/**
 * Initialize default files for a new notepad widget
 * @param {Object} files - useFiles hook instance
 */
export function initializeDefaults(files) {
  // Write config
  files.write('config.json', JSON.stringify(DEFAULT_CONFIG, null, 2));
  
  // Write all default notes
  Object.entries(DEFAULT_NOTES).forEach(([path, content]) => {
    files.write(path, content);
  });
}
