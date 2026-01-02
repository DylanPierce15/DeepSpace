// Utility functions for slide deck operations

/**
 * Generate a unique slide ID
 */
export function generateSlideId() {
  return `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new blank slide with default content
 */
export function createBlankSlide(index = 0) {
  return {
    id: generateSlideId(),
    content: `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 60px;">
      <h1 style="font-size: 48px; font-weight: 700; color: #1e293b; margin: 0 0 24px 0; text-align: center;">Slide ${index + 1}</h1>
      <p style="font-size: 24px; color: #64748b; margin: 0; text-align: center;">Click to edit this slide</p>
    </div>`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    notes: ''
  };
}

/**
 * Create a title slide
 */
export function createTitleSlide(title = 'Presentation Title', subtitle = 'Your Name | Date') {
  return {
    id: generateSlideId(),
    content: `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 60px;">
      <h1 style="font-size: 64px; font-weight: 800; color: white; margin: 0 0 32px 0; text-align: center; text-shadow: 0 4px 20px rgba(0,0,0,0.3);">${title}</h1>
      <p style="font-size: 28px; color: rgba(255,255,255,0.9); margin: 0; text-align: center; font-weight: 300;">${subtitle}</p>
    </div>`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    notes: ''
  };
}

/**
 * Extract preview text from HTML content
 */
export function extractSlidePreview(content) {
  if (!content) return 'Empty Slide';
  
  // Remove HTML tags
  let text = content.replace(/<[^>]*>/g, ' ');
  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  if (!text) return 'Empty Slide';
  return text.length > 50 ? text.substring(0, 50) + '...' : text;
}

/**
 * Parse uploaded HTML file content
 */
export function parseHTMLFile(htmlString) {
  // Basic sanitization - remove scripts
  let sanitized = htmlString
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');
  
  // Try to extract body content if full HTML document
  const bodyMatch = sanitized.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    sanitized = bodyMatch[1];
  }
  
  return sanitized.trim();
}

/**
 * Generate slide CSS for consistent styling
 */
export function getSlideBaseStyles() {
  return `
    .slide-content {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1e293b;
    }
    .slide-content h1 { font-size: 48px; font-weight: 700; margin: 0 0 24px 0; }
    .slide-content h2 { font-size: 36px; font-weight: 600; margin: 0 0 20px 0; }
    .slide-content h3 { font-size: 28px; font-weight: 600; margin: 0 0 16px 0; }
    .slide-content p { font-size: 20px; margin: 0 0 16px 0; }
    .slide-content ul, .slide-content ol { font-size: 20px; margin: 0 0 16px 0; padding-left: 32px; }
    .slide-content li { margin: 8px 0; }
    .slide-content code { background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-family: 'Monaco', monospace; }
    .slide-content pre { background: #1e293b; color: #e2e8f0; padding: 24px; border-radius: 12px; overflow-x: auto; }
    .slide-content img { max-width: 100%; height: auto; border-radius: 8px; }
    .slide-content blockquote { border-left: 4px solid #6366f1; padding-left: 24px; margin: 24px 0; color: #64748b; font-style: italic; }
  `;
}

/**
 * Format timestamp for display
 */
export function formatSlideDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

/**
 * Reorder slides array by moving an item from one index to another
 */
export function reorderSlides(slides, fromIndex, toIndex) {
  const result = [...slides];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

/**
 * Duplicate a slide
 */
export function duplicateSlide(slide) {
  return {
    ...slide,
    id: generateSlideId(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

/**
 * Export slides as HTML file
 */
export function exportSlidesToHTML(slides, title = 'Presentation') {
  const slideStyles = getSlideBaseStyles();
  const slidesHtml = slides.map((slide, index) => `
    <section class="slide" id="slide-${index + 1}">
      <div class="slide-content">
        ${slide.content}
      </div>
    </section>
  `).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
    .slide { 
      width: 100vw; 
      height: 100vh; 
      display: flex; 
      align-items: center; 
      justify-content: center;
      background: white;
      page-break-after: always;
    }
    .slide-content {
      width: 100%;
      height: 100%;
      padding: 60px;
    }
    ${slideStyles}
  </style>
</head>
<body>
  ${slidesHtml}
</body>
</html>`;
}

/**
 * Export slides as PDF using print dialog
 * Uses 1920x1080 (Full HD) as the standard slide size
 * Opens a new window with print-optimized layout and triggers print
 */
export function exportSlidesToPDF(slides, title = 'Presentation') {
  const slideStyles = getSlideBaseStyles();
  
  // Use 10x5.625 inches (16:9 at 192 DPI = 1920x1080 equivalent)
  const slidesHtml = slides.map((slide) => `
    <div class="slide">
      <div class="slide-inner">
        ${slide.content}
      </div>
    </div>
  `).join('\n');

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    @page {
      size: 10in 5.625in;
      margin: 0;
    }
    @media print {
      html, body { 
        margin: 0; 
        padding: 0; 
        width: 10in;
        height: 5.625in;
      }
      .slide { 
        page-break-after: always; 
        page-break-inside: avoid;
      }
      .slide:last-child { page-break-after: avoid; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f0f0f0;
    }
    .slide {
      width: 10in;
      height: 5.625in;
      background: white;
      overflow: hidden;
      margin: 0 auto 20px auto;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .slide-inner {
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    .slide-inner > div {
      width: 100%;
      height: 100%;
    }
    @media print {
      body { background: white; }
      .slide { 
        box-shadow: none; 
        margin: 0;
      }
    }
    ${slideStyles}
  </style>
</head>
<body>
  <div style="padding: 20px 0;">
    ${slidesHtml}
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}

