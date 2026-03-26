/**
 * app.js - Main application controller
 * Coordinates UI, FabricHandler, CVEngine, and PDFExporter
 */

const App = (function() {
    // State
    let state = {
        imageLoaded: false,
        opencvReady: false,
        processing: false,
        currentImage: null,
        currentPoints: null,
        currentMode: 'bw',
        currentDPI: 300
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

        // Initialize OpenCV engine
        console.log('App: Initializing OpenCV engine...');
        const opencvInitResult = CVEngine.init();
        console.log('App: CVEngine.init() returned:', opencvInitResult);
        
        if (opencvInitResult) {
            state.opencvReady = true;
            console.log('App initialized with OpenCV ready');
        } else {
            console.warn('OpenCV not ready yet');
            console.warn('cv object available:', typeof cv);
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
        dom.fileInput.addEventListener('change', handleFileUpload);
        dom.uploadArea.addEventListener('click', () => dom.fileInput.click());

        // Control buttons
        dom.btnAutoDetect.addEventListener('click', handleAutoDetect);
        dom.btnResetPoints.addEventListener('click', handleResetPoints);
        dom.btnProcess.addEventListener('click', handleProcess);

        // Export buttons
        dom.btnExportPNG.addEventListener('click', () => handleExport('png'));
        dom.btnExportJPG.addEventListener('click', () => handleExport('jpg'));
        dom.btnExportPDF.addEventListener('click', () => handleExport('pdf'));

        // Settings changes
        dom.modeSelect.addEventListener('change', (e) => {
            state.currentMode = e.target.value;
        });
        dom.dpiSelect.addEventListener('change', (e) => {
            state.currentDPI = parseInt(e.target.value);
        });

        // Zoom controls
        dom.btnZoomIn.addEventListener('click', () => zoomCanvas(1.2));
        dom.btnZoomOut.addEventListener('click', () => zoomCanvas(0.8));
        dom.btnZoomReset.addEventListener('click', () => zoomCanvas(1.0, true));
    }

    /**
     * Update UI based on state
     */
    function updateUI() {
        const { imageLoaded, opencvReady, processing } = state;

        // Enable/disable buttons
        dom.btnAutoDetect.disabled = !imageLoaded || !opencvReady || processing;
        dom.btnResetPoints.disabled = !imageLoaded || processing;
        dom.btnProcess.disabled = !imageLoaded || !opencvReady || processing;
        dom.btnExportPNG.disabled = !imageLoaded || processing;
        dom.btnExportJPG.disabled = !imageLoaded || processing;
        dom.btnExportPDF.disabled = !imageLoaded || processing;

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

        setStatus('Loading image...');
        state.imageLoaded = false;
        updateUI();

        try {
            // Load image into Fabric canvas
            const img = await loadImageFile(file);
            state.currentImage = img;

            // Set Fabric canvas size to image dimensions
            const width = img.naturalWidth;
            const height = img.naturalHeight;
            FabricHandler.setCanvasSize(width, height);
            FabricHandler.setPointsVisibility(true);

            // Draw image onto Fabric canvas background
            const fabricCanvas = FabricHandler.getCanvas();
            fabricCanvas.setBackgroundImage(img.src, fabricCanvas.renderAll.bind(fabricCanvas), {
                originX: 'left',
                originY: 'top',
                scaleX: 1,
                scaleY: 1
            });

            // Reset points to default corners
            FabricHandler.resetPoints(width, height);

            // Update state
            state.imageLoaded = true;
            state.currentPoints = FabricHandler.getPoints(true); // normalized
            setStatus('Image loaded. Adjust corner points or click Auto‑detect.');
            updateCoordinates();
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
            FabricHandler.setPoints(normalizedPoints, true);
            setStatus('Corners detected. Adjust if needed.');
        } catch (error) {
            setStatus('Auto‑detection failed: ' + error.message, true);
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
        const width = state.currentImage.naturalWidth;
        const height = state.currentImage.naturalHeight;
        FabricHandler.resetPoints(width, height);
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
     * Handle image processing
     */
    async function handleProcess() {
        if (!state.imageLoaded || !state.currentPoints) return;

        setStatus('Processing image...');
        state.processing = true;
        updateUI();

        try {
            // Convert image to OpenCV Mat
            const mat = await CVEngine.loadImage(state.currentImage);

            // Process with current points and mode
            const processedMat = CVEngine.processImage(
                mat,
                state.currentPoints,
                state.currentMode
            );

            // Draw result onto result canvas
            CVEngine.drawMatToCanvas(processedMat, dom.resultCanvas);

            // Update result info
            const width = processedMat.cols;
            const height = processedMat.rows;
            dom.resultSize.textContent = `${width}×${height} px`;
            dom.resultStatus.textContent = 'Processing complete.';

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
