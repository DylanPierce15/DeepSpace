/**
 * Shared styling utilities for widget generation and canvas state management.
 */

/**
 * Generate the content for a styling.md file from a style object.
 * @param {Object|null} style - The style object with id, name, and prompt properties
 * @returns {string} The markdown content for styling.md
 */
function generateStylingMd(style) {
  if (!style) {
    return `# Style ID\nnone\n\n# Style Name\nNo Style\n\n# Style Prompt\n\n`;
  }
  return `# Style ID\n${style.id}\n\n# Style Name\n${style.name}\n\n# Style Prompt\n${style.prompt || ''}\n`;
}

/**
 * Parse styling.md content to extract style object (id and name only).
 * @param {string} content - The content of a styling.md file
 * @returns {Object|null} Style object with id and name, or null if style is 'none'
 */
function parseStylingMd(content) {
  const result = { id: 'none', name: 'No Style' };
  let currentSection = null;

  for (const line of content.split('\n')) {
    if (line.startsWith('# Style ID')) {
      currentSection = 'id';
    } else if (line.startsWith('# Style Name')) {
      currentSection = 'name';
    } else if (line.startsWith('# Style Prompt')) {
      // Stop parsing - we don't need prompt in canvas state
      break;
    } else if (currentSection === 'id' && line.trim()) {
      result.id = line.trim();
      currentSection = null;
    } else if (currentSection === 'name' && line.trim()) {
      result.name = line.trim();
      currentSection = null;
    }
  }

  return result.id === 'none' ? null : result;
}

module.exports = {
  generateStylingMd,
  parseStylingMd,
};
