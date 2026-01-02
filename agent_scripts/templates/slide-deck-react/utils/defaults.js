/**
 * Default files for Slide Deck widget initialization
 */

export const DEFAULT_CONFIG = {
  currentDeckId: 'welcome-deck',
  deckOrder: ['welcome-deck']
};

export const DEFAULT_DECK_META = {
  title: 'Welcome Presentation',
  themeId: 'modern',
  currentSlideIndex: 0,
  slideOrder: ['slide-1', 'slide-2'],
  createdAt: Date.now(),
  updatedAt: Date.now()
};

export const DEFAULT_SLIDES = {
  'slide-1': `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 60px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
  <h1 style="font-size: 56px; font-weight: 700; color: white; margin: 0 0 24px 0; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">Welcome to Slide Deck</h1>
  <p style="font-size: 24px; color: rgba(255,255,255,0.9); max-width: 600px; line-height: 1.6;">Create beautiful presentations with HTML slides</p>
</div>`,

  'slide-2': `<div style="padding: 60px; height: 100%; background: #1e293b;">
  <h2 style="font-size: 42px; font-weight: 700; color: white; margin: 0 0 32px 0;">Getting Started</h2>
  <ul style="font-size: 24px; color: #94a3b8; line-height: 2; list-style: none; padding: 0; margin: 0;">
    <li style="margin-bottom: 16px;">✨ Edit slides using the HTML editor</li>
    <li style="margin-bottom: 16px;">🎨 Create multiple presentations</li>
    <li style="margin-bottom: 16px;">📺 Present in fullscreen mode</li>
    <li style="margin-bottom: 16px;">📄 Export to PDF</li>
  </ul>
</div>`
};

/**
 * Initialize default files for a new slide deck widget
 * @param {Object} files - useFiles hook instance
 */
export function initializeDefaults(files) {
  files.write('config.json', JSON.stringify(DEFAULT_CONFIG, null, 2));
  files.write('welcome-deck/deck.json', JSON.stringify(DEFAULT_DECK_META, null, 2));
  files.write('welcome-deck/slide-1.html', DEFAULT_SLIDES['slide-1']);
  files.write('welcome-deck/slide-2.html', DEFAULT_SLIDES['slide-2']);
}

