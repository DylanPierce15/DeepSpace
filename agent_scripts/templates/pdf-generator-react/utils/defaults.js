/**
 * Default files for PDF Generator widget initialization
 */

export const DEFAULT_CONFIG = {
  currentDoc: 'welcome-doc',
  docOrder: ['welcome-doc']
};

export const DEFAULT_DOC_META = {
  title: 'Welcome Document',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  pageOrder: ['page-1']
};

export const DEFAULT_PAGE = `<div class="page" style="width: 816px; height: 1056px; padding: 72px; box-sizing: border-box; font-family: 'Georgia', serif; background: white; overflow: hidden; position: relative;">
  <div style="height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
    <h1 style="font-size: 42px; font-weight: bold; color: #1a1a1a; margin: 0 0 16px 0;">Welcome to PDF Generator</h1>
    <p style="font-size: 18px; color: #666; margin: 0;">Create beautiful 8.5" × 11" documents</p>
    <div style="width: 60px; height: 3px; background: #2563eb; margin: 32px 0;"></div>
    <p style="font-size: 14px; color: #888;">Click Edit to customize this page</p>
  </div>
</div>`;

export const AGENTS_MD = `# PDF Document Generation Instructions

## Overview
This folder contains HTML documents formatted for 8.5" x 11" (US Letter) PDF export. Each document is a folder containing page HTML files.

## Page Dimensions
- **Width**: 816px (8.5 inches at 96 DPI)
- **Height**: 1056px (11 inches at 96 DPI)

## Document Structure
\`\`\`
documents/
├── config.json              # { currentDoc, docOrder }
├── samples/                 # Reference samples - READ THESE FOR EXAMPLES
│   ├── itinerary.html      # Itinerary template with card grid layout
│   └── ...                 # Other sample templates
├── my-document/
│   ├── meta.json           # { title, createdAt, updatedAt, pageOrder }
│   ├── page-1.html         # First page
│   ├── page-2.html         # Second page
│   └── ...
└── another-document/
    └── ...
\`\`\`

## How to Generate Documents

**IMPORTANT**: Before generating any new documents, read the sample files in \`files/documents/samples/\` to understand the HTML structure and styling patterns.

### Base Page Template
Every page MUST wrap content in this structure:

\`\`\`html
<div class="page" style="width: 816px; height: 1056px; padding: 72px; box-sizing: border-box; font-family: 'Georgia', serif; background: white; overflow: hidden; position: relative;">
  <!-- Content goes here -->
</div>
\`\`\`

### Images
Images should be linked via URL, NOT stored locally. Use stock image services:
- Unsplash: \`https://images.unsplash.com/photo-ID?w=600\`
- Picsum: \`https://picsum.photos/600/400\`

Example:
\`\`\`html
<img src="https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=600" 
     style="width: 100%; max-height: 400px; object-fit: cover; border-radius: 4px;" 
     alt="Description" />
\`\`\`

## Important Rules

1. **Never exceed page bounds** - Content must fit within the page dimensions
2. **Use overflow: hidden** - Prevents content bleeding
3. **No JavaScript** - Pages are static HTML only
4. **Link images** - Use URLs, never embed base64 or local files
5. **Read samples first** - Check \`samples/\` folder for layout patterns
`;

export const SAMPLE_ITINERARY = `<div class="page" style="width: 816px; height: 1056px; margin: 0; padding: 40px; box-sizing: border-box; font-family: 'Roboto', sans-serif; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); overflow: hidden; position: relative;">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
  <style>
    .card { background: rgba(255, 255, 255, 0.7); border: 2px solid rgba(255, 255, 255, 0.8); overflow: hidden; border-radius: 16px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1); }
    .card-full { background: rgba(255, 255, 255, 0.7); border: 2px solid rgba(255, 255, 255, 0.8); padding: 1.25rem; text-align: center; border-radius: 16px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1); }
    .image-container { width: 100%; height: 180px; overflow: hidden; background: rgba(245, 245, 245, 0.5); }
    .image-container img { width: 100%; height: 100%; object-fit: cover; }
    .card-content { padding: 0.875rem 1rem; }
    .time { color: #888; font-size: 0.65rem; font-weight: 500; margin-bottom: 0.2rem; letter-spacing: 1px; text-transform: uppercase; }
    .activity { color: #1a1a1a; font-size: 1rem; font-weight: 500; margin-bottom: 0.4rem; }
    .description { color: #555; font-size: 0.8rem; line-height: 1.4; font-weight: 400; }
  </style>
  
  <div style="width: 100%; height: 100%; background: rgba(255, 255, 255, 0.4); padding: 32px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.5); box-sizing: border-box; display: flex; flex-direction: column;">
    
    <h1 style="text-align: center; color: #1a1a1a; font-size: 1.6rem; font-weight: 300; margin: 0 0 0.1rem 0; letter-spacing: 1px;">Weekend Itinerary</h1>
    <p style="text-align: center; color: #666; font-size: 0.8rem; font-weight: 300; margin: 0 0 1.5rem 0;">Saturday, January 15</p>
    
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; flex: 1; margin-bottom: 16px;">
      <!-- Card 1 -->
      <div class="card">
        <div class="image-container">
          <img src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=250&fit=crop" alt="Restaurant" />
        </div>
        <div class="card-content">
          <div class="time">1:00 PM</div>
          <div class="activity">Lunch at Lorem Bistro</div>
          <div class="description">Lorem ipsum dolor sit amet consectetur.</div>
        </div>
      </div>

      <!-- Card 2 -->
      <div class="card">
        <div class="image-container">
          <img src="https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=400&h=250&fit=crop" alt="Ice Skating" />
        </div>
        <div class="card-content">
          <div class="time">3:00 PM</div>
          <div class="activity">Ice Skating at Central Park</div>
          <div class="description">Sed do eiusmod tempor incididunt.</div>
        </div>
      </div>

      <!-- Card 3 -->
      <div class="card">
        <div class="image-container">
          <img src="https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=400&h=250&fit=crop" alt="City Walk" />
        </div>
        <div class="card-content">
          <div class="time">4:00 PM</div>
          <div class="activity">Explore Downtown</div>
          <div class="description">Ut enim ad minim veniam quis nostrud.</div>
        </div>
      </div>

      <!-- Card 4 -->
      <div class="card">
        <div class="image-container">
          <img src="https://images.unsplash.com/photo-1524578271613-d550eacf6090?w=400&h=250&fit=crop" alt="Bookstore" />
        </div>
        <div class="card-content">
          <div class="time">4:30 PM</div>
          <div class="activity">Visit the Bookstore</div>
          <div class="description">Duis aute irure dolor in reprehenderit.</div>
        </div>
      </div>
    </div>

    <!-- Card 5 - Full Width -->
    <div class="card-full">
      <div class="time">5:30 PM</div>
      <div class="activity">Dinner at Ipsum Kitchen</div>
      <div class="description">Excepteur sint occaecat cupidatat non proident.</div>
    </div>

    <div style="text-align: center; margin-top: 1.25rem;">
      <p style="color: #444; font-size: 0.95rem; font-weight: 400; font-style: italic; margin: 0;">See you Saturday!</p>
    </div>
  </div>
</div>`;

/**
 * Initialize default files for a new PDF generator widget
 * @param {Object} files - useFiles hook instance
 */
export function initializeDefaults(files) {
  // Core config
  files.write('config.json', JSON.stringify(DEFAULT_CONFIG, null, 2));
  
  // Welcome document
  files.write('welcome-doc/meta.json', JSON.stringify(DEFAULT_DOC_META, null, 2));
  files.write('welcome-doc/page-1.html', DEFAULT_PAGE);
  
  // AGENTS.md for AI generation
  files.write('AGENTS.md', AGENTS_MD);
  
  // Sample itinerary
  files.write('samples/itinerary.html', SAMPLE_ITINERARY);
}

