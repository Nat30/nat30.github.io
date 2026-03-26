/**
 * pdf-exporter.js - Export processed images as PNG, JPG, or PDF
 * Uses jsPDF for PDF generation
 */

const PDFExporter = (function() {
    // jsPDF instance (lazy-loaded)
    let jsPDF = null;

    /**
     * Ensure jsPDF is available
     */
    function ensureJsPDF() {
        if (typeof window.jspdf !== 'undefined') {
            jsPDF = window.jspdf.jsPDF;
            return true;
        }
        console.error('jsPDF not loaded');
        return false;
    }

    /**
     * Convert canvas to Blob
     * @param {HTMLCanvasElement} canvas
     * @param {string} type - MIME type ('image/png', 'image/jpeg')
     * @param {number} quality - Quality for JPEG (0–1)
     * @returns {Promise<Blob>}
     */
    function canvasToBlob(canvas, type = 'image/png', quality = 1.0) {
        return new Promise((resolve) => {
            canvas.toBlob(resolve, type, quality);
        });
    }

    /**
     * Trigger download of a Blob
     * @param {Blob} blob
     * @param {string} filename
     */
    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Export canvas as PNG
     * @param {HTMLCanvasElement} canvas
     * @param {string} filename - Optional filename
     * @param {number} dpi - DPI scaling (affects canvas size)
     */
    async function exportPNG(canvas, filename = 'document.png', dpi = 300) {
        if (!canvas) throw new Error('Canvas is required');

        // Scale canvas for DPI
        const originalWidth = canvas.width;
        const originalHeight = canvas.height;
        const scale = dpi / 96; // assuming 96 DPI screen
        const scaledCanvas = document.createElement('canvas');
        scaledCanvas.width = originalWidth * scale;
        scaledCanvas.height = originalHeight * scale;
        const ctx = scaledCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);

        const blob = await canvasToBlob(scaledCanvas, 'image/png');
        downloadBlob(blob, filename);
    }

    /**
     * Export canvas as JPEG
     * @param {HTMLCanvasElement} canvas
     * @param {string} filename - Optional filename
     * @param {number} dpi - DPI scaling
     * @param {number} quality - JPEG quality (0–1)
     */
    async function exportJPEG(canvas, filename = 'document.jpg', dpi = 300, quality = 0.95) {
        if (!canvas) throw new Error('Canvas is required');

        // Scale canvas for DPI
        const originalWidth = canvas.width;
        const originalHeight = canvas.height;
        const scale = dpi / 96;
        const scaledCanvas = document.createElement('canvas');
        scaledCanvas.width = originalWidth * scale;
        scaledCanvas.height = originalHeight * scale;
        const ctx = scaledCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);

        const blob = await canvasToBlob(scaledCanvas, 'image/jpeg', quality);
        downloadBlob(blob, filename);
    }

    /**
     * Export canvas as PDF
     * @param {HTMLCanvasElement} canvas
     * @param {string} filename - Optional filename
     * @param {number} dpi - DPI for PDF
     */
    async function exportPDF(canvas, filename = 'document.pdf', dpi = 300) {
        if (!canvas) throw new Error('Canvas is required');
        if (!ensureJsPDF()) throw new Error('jsPDF not available');

        // Convert canvas to image data URL
        const imageData = canvas.toDataURL('image/jpeg', 0.95);
        const pdf = new jsPDF({
            orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
            unit: 'mm',
            format: [canvas.width * 0.2646, canvas.height * 0.2646] // px to mm (96 DPI)
        });

        // Calculate dimensions in mm (considering DPI)
        const mmWidth = (canvas.width / dpi) * 25.4;
        const mmHeight = (canvas.height / dpi) * 25.4;

        // Add page with image
        pdf.addImage(imageData, 'JPEG', 0, 0, mmWidth, mmHeight);
        pdf.save(filename);
    }

    /**
     * Export multiple canvases as a multi‑page PDF
     * @param {Array<HTMLCanvasElement>} canvases
     * @param {string} filename
     * @param {number} dpi
     */
    async function exportMultiPagePDF(canvases, filename = 'documents.pdf', dpi = 300) {
        if (!canvases.length) throw new Error('No canvases provided');
        if (!ensureJsPDF()) throw new Error('jsPDF not available');

        const pdf = new jsPDF();
        for (let i = 0; i < canvases.length; i++) {
            const canvas = canvases[i];
            if (i > 0) pdf.addPage();
            const imageData = canvas.toDataURL('image/jpeg', 0.95);
            const mmWidth = (canvas.width / dpi) * 25.4;
            const mmHeight = (canvas.height / dpi) * 25.4;
            pdf.addImage(imageData, 'JPEG', 0, 0, mmWidth, mmHeight);
        }
        pdf.save(filename);
    }

    /**
     * Generate a filename with timestamp
     * @param {string} base - Base name
     * @param {string} ext - Extension (without dot)
     */
    function generateFilename(base = 'document', ext = 'png') {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
        return `${base}_${dateStr}_${timeStr}.${ext}`;
    }

    // Public API
    return {
        exportPNG,
        exportJPEG,
        exportPDF,
        exportMultiPagePDF,
        generateFilename
    };
})();