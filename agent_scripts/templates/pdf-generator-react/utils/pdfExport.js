/**
 * PDF Export Utility
 * 
 * Uses html2canvas to capture pages and jsPDF to create PDF
 */

// Load libraries dynamically
async function loadHtml2Canvas() {
  if (window.html2canvas) return window.html2canvas;
  
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = () => resolve(window.html2canvas);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function loadJsPDF() {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
  
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = () => resolve(window.jspdf.jsPDF);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Export pages to PDF
 */
export async function exportToPDF(pages, title) {
  if (!pages.length) throw new Error('No pages to export');
  
  // Load libraries
  const [html2canvas, jsPDF] = await Promise.all([
    loadHtml2Canvas(),
    loadJsPDF()
  ]);
  
  // Create PDF (8.5 x 11 inches)
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'in',
    format: 'letter' // 8.5 x 11
  });
  
  // Create temporary container for rendering
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: -9999px;
    width: 816px;
    background: white;
    z-index: -1;
  `;
  document.body.appendChild(container);
  
  try {
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      
      // Add new page after first
      if (i > 0) {
        pdf.addPage();
      }
      
      // Render page HTML
      container.innerHTML = page.content;
      
      // Wait for images to load
      const images = container.querySelectorAll('img');
      await Promise.all(
        Array.from(images).map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        })
      );
      
      // Small delay for rendering
      await new Promise(r => setTimeout(r, 100));
      
      // Capture as canvas
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 816,
        height: 1056,
        logging: false
      });
      
      // Add to PDF
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(imgData, 'JPEG', 0, 0, 8.5, 11);
    }
    
    // Save PDF
    const filename = `${title.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
    pdf.save(filename);
    
  } finally {
    // Cleanup
    document.body.removeChild(container);
  }
}

/**
 * Alternative: Open print dialog for browser PDF export
 */
export function printPages(pages, title) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print');
    return;
  }
  
  const pagesHtml = pages.map((page, i) => `
    <div class="page" style="page-break-after: always;">
      ${page.content}
    </div>
  `).join('\n');
  
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        @page {
          size: 8.5in 11in;
          margin: 0;
        }
        body {
          margin: 0;
          padding: 0;
        }
        .page {
          width: 8.5in;
          min-height: 11in;
          background: white;
          overflow: hidden;
        }
        @media print {
          .page {
            page-break-after: always;
          }
        }
      </style>
    </head>
    <body>
      ${pagesHtml}
    </body>
    </html>
  `);
  
  printWindow.document.close();
  
  // Wait for images then print
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 500);
}

