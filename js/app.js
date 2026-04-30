/**
 * app.js - Main application controller
 * Coordinates UI, FabricHandler, CVEngine, and PDFExporter
 */

    const MAX_CANVAS_DIM = 2000;

    const App = (function() {
    // State
    let state = {
        imageLoaded: false,
        opencvReady: false,
        processing: false,
        resultReady: false,
        currentImage: null,
        currentPoints: null,
        currentMode: 'bw',
        currentDPI: 300,
        imageScale: 1,
        originalImageWidth: 0,
        originalImageHeight: 0
    };

    // DOM Elements
    let dom = {};

    /**
     * Initialize the application after OpenCV is loaded
     */
    function init() {
        gatherDOMElements();
        bindEvents();
        updateUI();

        // Initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        const engineInitResult = CVEngine.init();
        
        if (engineInitResult) {
            state.opencvReady = true;
        }

        // Initialize Fabric canvas
        FabricHandler.init('fabricCanvas', handlePointsChanged);
        FabricHandler.setPointsVisibility(false);

        // Update status
        setStatus('Ready. Upload an image to start.');
    }

    /**
     * Gather references to DOM elements
     */
    function gatherDOMElements() {
        const ids = [
            'fileInput', 'uploadArea', 'opencvLoading',
            'btnAutoDetect', 'btnResetPoints', 'btnProcess',
            'btnExportPNG', 'btnExportJPG', 'btnExportPDF',
            'modeSelect', 'dpiSelect',
            'btnZoomIn', 'btnZoomOut', 'btnZoomReset',
            'status', 'coordinates', 'resultStatus', 'resultSize',
            'fabricCanvas', 'resultCanvas'
        ];
        ids.forEach(id => {
            dom[id] = document.getElementById(id);
        });
    }

    /**
     * Bind UI events
     */
    function bindEvents() {
        // File upload
        if (dom.fileInput) {
            dom.fileInput.addEventListener('change', handleFileUpload);
            // dom.fileInput.addEventListener('input', handleFileUpload); // Removed to avoid duplicate calls
        }
        if (dom.uploadArea) {
            dom.uploadArea.addEventListener('click', (e) => {
                if (e.target.tagName === 'LABEL' || e.target.closest('label')) return;
                if (dom.fileInput) dom.fileInput.click();
            });

            dom.uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dom.uploadArea.classList.add('drag-over');
            });
            dom.uploadArea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dom.uploadArea.classList.remove('drag-over');
            });
            dom.uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dom.uploadArea.classList.remove('drag-over');
                const file = e.dataTransfer?.files?.[0];
                if (file && file.type.startsWith('image/')) {
                    loadFile(file);
                }
            });
        }

        document.addEventListener('paste', (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    if (file) loadFile(file);
                    break;
                }
            }
        });

        // Control buttons
        dom.btnAutoDetect?.addEventListener('click', handleAutoDetect);
        dom.btnResetPoints?.addEventListener('click', handleResetPoints);
        dom.btnProcess?.addEventListener('click', handleProcess);

        dom.btnExportPNG?.addEventListener('click', () => handleExport('png'));
        dom.btnExportJPG?.addEventListener('click', () => handleExport('jpg'));
        dom.btnExportPDF?.addEventListener('click', () => handleExport('pdf'));

        dom.modeSelect?.addEventListener('change', (e) => {
            state.currentMode = e.target.value;
        });
        dom.dpiSelect?.addEventListener('change', (e) => {
            state.currentDPI = parseInt(e.target.value);
        });

        dom.btnZoomIn?.addEventListener('click', () => zoomCanvas(1.2));
        dom.btnZoomOut?.addEventListener('click', () => zoomCanvas(0.8));
        dom.btnZoomReset?.addEventListener('click', () => zoomCanvas(1.0, true));
    }

    /**
     * Update UI based on state
     */
    function updateUI() {
        const { imageLoaded, opencvReady, processing, resultReady } = state;

        dom.btnAutoDetect.disabled = !imageLoaded || !opencvReady || processing;
        dom.btnResetPoints.disabled = !imageLoaded || processing;
        dom.btnProcess.disabled = !imageLoaded || !opencvReady || processing;
        dom.btnExportPNG.disabled = !resultReady || processing;
        dom.btnExportJPG.disabled = !resultReady || processing;
        dom.btnExportPDF.disabled = !resultReady || processing;

        // Show/hide OpenCV loading
        dom.opencvLoading.style.display = opencvReady ? 'none' : 'flex';
    }

    /**
     * Set status message
     */
    function setStatus(message, isError = false) {
        if (!dom.status) return;
        dom.status.textContent = message;
        dom.status.style.color = isError ? '#ef4444' : '#6b7280';
    }

    /**
     * Handle file upload
     */
    async function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        await loadFile(file);
        e.target.value = '';
    }

    async function loadFile(file) {
        setStatus('Loading image...');
        state.imageLoaded = false;
        state.resultReady = false;
        updateUI();

        try {
            const img = await loadImageFile(file);
            state.currentImage = img;

            const width = img.naturalWidth;
            const height = img.naturalHeight;
            
            if (width === 0 || height === 0) {
                throw new Error('Invalid image dimensions');
            }

            let canvasWidth = width;
            let canvasHeight = height;
            if (Math.max(width, height) > MAX_CANVAS_DIM) {
                const scale = MAX_CANVAS_DIM / Math.max(width, height);
                canvasWidth = Math.round(width * scale);
                canvasHeight = Math.round(height * scale);
            }
            state.imageScale = canvasWidth / width;

            FabricHandler.setCanvasSize(canvasWidth, canvasHeight);
            FabricHandler.setPointsVisibility(true);

            const fabricCanvas = FabricHandler.getCanvas();

            fabricCanvas.setBackgroundImage(null, fabricCanvas.renderAll.bind(fabricCanvas));

            fabricCanvas.setBackgroundImage(img.src, fabricCanvas.renderAll.bind(fabricCanvas), {
                originX: 'left',
                originY: 'top',
                scaleX: state.imageScale,
                scaleY: state.imageScale
            });

            FabricHandler.resetPoints(canvasWidth, canvasHeight);

            state.imageLoaded = true;
            state.originalImageWidth = width;
            state.originalImageHeight = height;
            state.currentPoints = FabricHandler.getPoints(true);
            const scalePercent = Math.round(state.imageScale * 100);
            setStatus(`Image loaded (${scalePercent}% scale). Adjust corner points or click Auto-detect.`);
            updateCoordinates();
            
            fabricCanvas.renderAll();
        } catch (error) {
            setStatus('Failed to load image: ' + error.message, true);
            console.error(error);
        } finally {
            updateUI();
        }
    }

    /**
     * Load image file as HTMLImageElement
     */
    function loadImageFile(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const reader = new FileReader();
            
            reader.onload = function(e) {
                img.src = e.target.result;
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('Image loading failed'));
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * Handle automatic corner detection
     */
    async function handleAutoDetect() {
        if (!state.currentImage) return;
        setStatus('Detecting document corners...');
        state.processing = true;
        updateUI();

        try {
            const normalizedPoints = await FabricHandler.autoDetectCorners(state.currentImage);
            console.log('Auto-detected points (original normalized):', normalizedPoints);
            
            // Convert normalized points from original image to scaled canvas
            const scale = state.imageScale;
            const canvasNormalizedPoints = normalizedPoints.map(p => ({
                x: p.x / scale,
                y: p.y / scale
            }));
            console.log('Auto-detected points (canvas normalized):', canvasNormalizedPoints);
            
            FabricHandler.setPoints(canvasNormalizedPoints, true);
            setStatus('Corners detected. Adjust if needed.');
        } catch (error) {
            setStatus('Auto-detection failed: ' + error.message, true);
            console.error(error);
        } finally {
            state.processing = false;
            updateUI();
        }
    }

    /**
     * Handle reset points
     */
    function handleResetPoints() {
        if (!state.currentImage) return;
        const canvasWidth = state.originalImageWidth * state.imageScale;
        const canvasHeight = state.originalImageHeight * state.imageScale;
        FabricHandler.resetPoints(canvasWidth, canvasHeight);
        setStatus('Points reset to default corners.');
    }

    /**
     * Handle points changed callback
     */
    function handlePointsChanged(points) {
        state.currentPoints = points; // absolute coordinates
        updateCoordinates();
    }

    /**
     * Update coordinates display
     */
    function updateCoordinates() {
        if (!dom.coordinates || !state.currentPoints) return;
        const pts = state.currentPoints;
        const text = `Points: (${Math.round(pts[0].x)},${Math.round(pts[0].y)}) ... (${Math.round(pts[2].x)},${Math.round(pts[2].y)})`;
        dom.coordinates.textContent = text;
    }
    
    /**
     * Convert canvas coordinates back to original image coordinates
     * @param {Array} canvasPoints - Points in canvas coordinates
     * @returns {Array} Points in original image coordinates
     */
    function canvasToOriginalImage(canvasPoints) {
        if (!state.imageScale || state.imageScale === 1) {
            return canvasPoints;
        }
        
        const scale = state.imageScale;
        return canvasPoints.map(p => ({
            x: p.x / scale,
            y: p.y / scale
        }));
    }

    /**
     * Handle image processing
     */
    async function handleProcess() {
        if (!state.imageLoaded || !state.currentPoints) return;

        setStatus('Processing image...');
        state.processing = true;
        updateUI();

        try {
            const originalImagePoints = canvasToOriginalImage(state.currentPoints);

            const resultCanvas = CVEngine.processImage(
                state.currentImage,
                originalImagePoints,
                state.currentMode
            );

            CVEngine.drawResultToCanvas(resultCanvas, dom.resultCanvas);

            dom.resultSize.textContent = `${resultCanvas.width}×${resultCanvas.height} px`;
            dom.resultStatus.textContent = 'Processing complete.';

            state.resultReady = true;
            setStatus('Processing complete.');
        } catch (error) {
            setStatus('Processing failed: ' + error.message, true);
            console.error(error);
        } finally {
            state.processing = false;
            updateUI();
        }
    }

    /**
     * Handle export
     */
    async function handleExport(format) {
        if (!state.imageLoaded || !dom.resultCanvas) return;

        const canvas = dom.resultCanvas;
        const dpi = state.currentDPI;
        const filename = PDFExporter.generateFilename('document', format);

        setStatus(`Exporting ${format.toUpperCase()}...`);
        state.processing = true;
        updateUI();

        try {
            switch (format) {
                case 'png':
                    await PDFExporter.exportPNG(canvas, filename, dpi);
                    break;
                case 'jpg':
                    await PDFExporter.exportJPEG(canvas, filename, dpi);
                    break;
                case 'pdf':
                    await PDFExporter.exportPDF(canvas, filename, dpi);
                    break;
                default:
                    throw new Error('Unsupported format');
            }
            setStatus(`Exported as ${filename}`);
        } catch (error) {
            setStatus('Export failed: ' + error.message, true);
            console.error(error);
        } finally {
            state.processing = false;
            updateUI();
        }
    }

    /**
     * Zoom Fabric canvas
     */
    function zoomCanvas(factor, reset = false) {
        const fabricCanvas = FabricHandler.getCanvas();
        if (!fabricCanvas) return;

        if (reset) {
            fabricCanvas.setZoom(1);
            fabricCanvas.viewportTransform = [1, 0, 0, 1, 0, 0];
        } else {
            const zoom = fabricCanvas.getZoom();
            fabricCanvas.setZoom(zoom * factor);
        }
        fabricCanvas.renderAll();
    }

    // Make init function globally available for OpenCV loading
    window.initApp = init;

    // Public API (if needed)
    return {
        init,
        getState: () => state,
        setStatus
    };
})();

// Auto‑initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', App.init);
} else {
    App.init();
}
