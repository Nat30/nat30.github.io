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
    function createScaledCanvas(canvas, dpi, smoothing = false) {
        const scale = dpi / 96;
        const scaledCanvas = document.createElement('canvas');
        scaledCanvas.width = canvas.width * scale;
        scaledCanvas.height = canvas.height * scale;
        const ctx = scaledCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = smoothing;
        if (smoothing) ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
        return scaledCanvas;
    }

    async function exportPNG(canvas, filename = 'document.png', dpi = 300) {
        if (!canvas) throw new Error('Canvas is required');
        const scaledCanvas = createScaledCanvas(canvas, dpi, false);
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
        const scaledCanvas = createScaledCanvas(canvas, dpi, true);
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

        const imageData = canvas.toDataURL('image/jpeg', 0.95);
        const mmWidth = (canvas.width / dpi) * 25.4;
        const mmHeight = (canvas.height / dpi) * 25.4;

        const pdf = new jsPDF({
            orientation: mmWidth > mmHeight ? 'landscape' : 'portrait',
            unit: 'mm',
            format: [mmWidth, mmHeight]
        });

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