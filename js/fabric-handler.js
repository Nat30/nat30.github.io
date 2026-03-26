/**
 * fabric-handler.js - Interactive canvas for document corner point adjustment
 * Uses Fabric.js for draggable points and lines
 */

const FabricHandler = (function() {
    // Fabric canvas instance
    let fabricCanvas = null;
    // Points and lines
    let points = [];
    let lines = [];
    // Outer wrapper for scrolling
    let outerWrapper = null;
    // Configuration
    const POINT_RADIUS = 10;
    const POINT_COLOR = '#3b82f6';
    const LINE_COLOR = '#3b82f6';
    const LINE_WIDTH = 2;
    // Callback for point updates
    let onPointsChanged = null;

    /**
     * Initialize Fabric canvas on the given element
     * @param {string|HTMLCanvasElement} canvasEl - Canvas element or its ID
     * @param {Function} pointsCallback - Callback when points change
     */
    function init(canvasEl, pointsCallback) {
        if (!canvasEl) {
            console.error('Canvas element not found');
            return;
        }
        if (typeof fabric === 'undefined') {
            console.error('Fabric.js not loaded');
            return;
        }

        fabricCanvas = new fabric.Canvas(canvasEl, {
            selection: false,
            backgroundColor: 'transparent',
            preserveObjectStacking: true,
            perPixelTargetFind: true // Better object picking
        });

        console.log('Fabric canvas created:', fabricCanvas.width, 'x', fabricCanvas.height);
        
        // Set initial wrapper styles
        const wrapper = fabricCanvas.wrapperEl;
        if (wrapper) {
            wrapper.style.width = '100%';
            wrapper.style.height = '100%';
            wrapper.style.position = 'relative';
            console.log('Wrapper element initialized');
        }
        
        // Get the outer wrapper (.canvas-wrapper) for scrolling
        const canvasElement = fabricCanvas.lowerCanvasEl || canvasEl;
        outerWrapper = null;
        if (canvasElement && canvasElement.parentNode && canvasElement.parentNode.parentNode) {
            outerWrapper = canvasElement.parentNode.parentNode;
            if (outerWrapper.classList.contains('canvas-wrapper')) {
                console.log('Found outer canvas-wrapper for scrolling');
            } else {
                // Try to find .canvas-wrapper by traversing up
                outerWrapper = canvasElement.closest('.canvas-wrapper');
                console.log('Found outer wrapper via closest:', outerWrapper);
            }
        }
        
        onPointsChanged = pointsCallback;

        // Create initial points (hidden until image is loaded)
        createPoints();
        updateLines();

        // Bind events
        fabricCanvas.on('object:modified', handlePointDrag);
        fabricCanvas.on('object:moving', handlePointDrag);

        console.log('FabricHandler initialized');
    }

    /**
     * Create four draggable circle points at default positions
     */
    function createPoints() {
        points = [];
        // Different colors for debugging
        const pointColors = ['#ff0000', '#00ff00', '#0000ff', '#ff00ff']; // red, green, blue, magenta
        for (let i = 0; i < 4; i++) {
            const point = new fabric.Circle({
                left: 100 + i * 50,
                top: 100 + i * 30,
                radius: POINT_RADIUS,
                fill: pointColors[i],
                stroke: '#ffffff',
                strokeWidth: 2,
                hasControls: false,
                hasBorders: false,
                lockRotation: true,
                lockScalingX: true,
                lockScalingY: true,
                originX: 'center',
                originY: 'center',
                hoverCursor: 'move',
                selectable: true,
                evented: true,
                data: { index: i, label: ['TL', 'TR', 'BR', 'BL'][i] }
            });
            points.push(point);
            fabricCanvas.add(point);
            point.bringToFront();
            console.log(`Point ${i} (${point.data.label}) created at ${point.left},${point.top}`);
        }
        setPointsVisibility(false);
    }

    /**
     * Create lines connecting the points
     */
    function createLines() {
        lines = [];
        for (let i = 0; i < 4; i++) {
            const line = new fabric.Line([0, 0, 0, 0], {
                stroke: LINE_COLOR,
                strokeWidth: LINE_WIDTH,
                selectable: false,
                evented: false,
                strokeDashArray: i % 2 === 0 ? [5, 5] : [] // dashed for top/bottom, solid for sides
            });
            lines.push(line);
            fabricCanvas.add(line);
            line.sendToBack();
        }
    }

    /**
     * Update line positions based on current point positions
     */
    function updateLines() {
        if (lines.length === 0) createLines();

        const pointCoords = points.map(p => ({ x: p.left, y: p.top }));

        // Connect points in order: 0-1, 1-2, 2-3, 3-0
        const connections = [[0,1], [1,2], [2,3], [3,0]];
        connections.forEach(([i, j], idx) => {
            lines[idx].set({
                x1: pointCoords[i].x,
                y1: pointCoords[i].y,
                x2: pointCoords[j].x,
                y2: pointCoords[j].y
            });
        });

        fabricCanvas.renderAll();
    }

    /**
     * Handle point drag events
     */
    function handlePointDrag(e) {
        const point = e.target;
        if (!point || !point.data) return;
        
        console.log(`Handle point drag START: index=${point.data.index}, type=${e.type}, left=${point.left}, top=${point.top}`);

        // Constrain point within canvas bounds
        const canvasWidth = fabricCanvas.width;
        const canvasHeight = fabricCanvas.height;
        
        console.log(`Point drag: index=${point.data.index}, left=${point.left}, top=${point.top}, canvas=${canvasWidth}x${canvasHeight}`);
        
        // Constrain point within canvas bounds
        const newLeft = Math.max(POINT_RADIUS, Math.min(canvasWidth - POINT_RADIUS, point.left));
        const newTop = Math.max(POINT_RADIUS, Math.min(canvasHeight - POINT_RADIUS, point.top));
        
        console.log(`New position: left=${newLeft}, top=${newTop}`);
        
        point.set({
            left: newLeft,
            top: newTop
        });

        updateLines();
        if (onPointsChanged) {
            onPointsChanged(getPoints());
        }
        console.log(`Handle point drag END: index=${point.data.index}`);
    }

    /**
     * Set points to specific coordinates (normalized 0–1 or absolute pixels)
     * @param {Array<{x:number, y:number}>} coords - Four points
     * @param {boolean} normalized - Whether coordinates are normalized (0–1)
     */
    function setPoints(coords, normalized = false) {
        if (!coords || coords.length !== 4) return;

        const canvasWidth = fabricCanvas.width;
        const canvasHeight = fabricCanvas.height;

        coords.forEach((coord, i) => {
            const x = normalized ? coord.x * canvasWidth : coord.x;
            const y = normalized ? coord.y * canvasHeight : coord.y;
            points[i].set({
                left: Math.max(POINT_RADIUS, Math.min(canvasWidth - POINT_RADIUS, x)),
                top: Math.max(POINT_RADIUS, Math.min(canvasHeight - POINT_RADIUS, y))
            });
        });

        updateLines();
        if (onPointsChanged) onPointsChanged(getPoints());
        
        // Scroll to make points visible
        setTimeout(scrollViewToPoints, 100); // Delay to ensure rendering is complete
    }

    /**
     * Get current point coordinates
     * @param {boolean} normalized - Return normalized (0–1) coordinates
     * @returns {Array<{x:number, y:number}>}
     */
    function getPoints(normalized = false) {
        const canvasWidth = fabricCanvas.width;
        const canvasHeight = fabricCanvas.height;
        return points.map(p => ({
            x: normalized ? p.left / canvasWidth : p.left,
            y: normalized ? p.top / canvasHeight : p.top
        }));
    }

    /**
     * Automatically detect document corners using OpenCV (if available)
     * @param {HTMLCanvasElement|HTMLImageElement} imageElement - Source image
     * @returns {Promise<Array<{x:number, y:number}>>} Detected corner points (normalized)
     */
    async function autoDetectCorners(imageElement) {
        if (typeof cv === 'undefined') {
            throw new Error('OpenCV.js not loaded');
        }

        // Convert image to OpenCV Mat
        const src = cv.imread(imageElement);
        const gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

        // Apply Gaussian blur to reduce noise
        const blurred = new cv.Mat();
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

        // Edge detection
        const edges = new cv.Mat();
        cv.Canny(blurred, edges, 50, 150);

        // Find contours
        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        // Find the contour with the largest area that is roughly quadrilateral
        let maxArea = 0;
        let bestContour = null;
        for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i);
            const area = cv.contourArea(contour);
            if (area > maxArea) {
                // Approximate polygon
                const epsilon = 0.02 * cv.arcLength(contour, true);
                const approx = new cv.Mat();
                cv.approxPolyDP(contour, approx, epsilon, true);
                if (approx.rows === 4) {
                    maxArea = area;
                    bestContour = approx;
                } else {
                    approx.delete();
                }
            }
            contour.delete();
        }

        let points = [];
        if (bestContour && bestContour.rows === 4) {
            // Extract four points
            const data = bestContour.data32S;
            for (let i = 0; i < 4; i++) {
                points.push({ x: data[i * 2], y: data[i * 2 + 1] });
            }
            // Order points: TL, TR, BR, BL (based on centroid)
            const centroid = { x: 0, y: 0 };
            points.forEach(p => { centroid.x += p.x; centroid.y += p.y; });
            centroid.x /= 4; centroid.y /= 4;
            points.sort((a, b) => {
                const aAngle = Math.atan2(a.y - centroid.y, a.x - centroid.x);
                const bAngle = Math.atan2(b.y - centroid.y, b.x - centroid.x);
                return aAngle - bAngle;
            });
            // Ensure consistent order (rotate if needed)
        } else {
            // Fallback: use image corners
            const width = src.cols;
            const height = src.rows;
            points = [
                { x: width * 0.1, y: height * 0.1 },
                { x: width * 0.9, y: height * 0.1 },
                { x: width * 0.9, y: height * 0.9 },
                { x: width * 0.1, y: height * 0.9 }
            ];
        }

        // Normalize to 0–1 range
        const width = src.cols;
        const height = src.rows;
        const normalized = points.map(p => ({
            x: p.x / width,
            y: p.y / height
        }));

        // Cleanup
        src.delete();
        gray.delete();
        blurred.delete();
        edges.delete();
        contours.delete();
        hierarchy.delete();
        if (bestContour) bestContour.delete();

        return normalized;
    }

    /**
     * Reset points to default positions (image corners)
     * @param {number} width - Image width
     * @param {number} height - Image height
     */
    function resetPoints(width, height) {
        if (!width || !height) {
            // Use canvas bounds
            width = fabricCanvas.width;
            height = fabricCanvas.height;
        }
        console.log(`resetPoints: canvas=${width}x${height}`);
        const margin = 0.3; // Increased from 0.1 to make points more visible
        const coords = [
            { x: width * margin, y: height * margin },
            { x: width * (1 - margin), y: height * margin },
            { x: width * (1 - margin), y: height * (1 - margin) },
            { x: width * margin, y: height * (1 - margin) }
        ];
        console.log('Reset points to:', coords);
        setPoints(coords);
    }

    /**
     * Set canvas size to match image dimensions
     * @param {number} width
     * @param {number} height
     */
    function setCanvasSize(width, height) {
        if (!fabricCanvas) return;
        console.log('FabricHandler.setCanvasSize:', width, 'x', height);
        // Set canvas dimensions
        fabricCanvas.setDimensions({ width, height });
        console.log('Canvas dimensions set to:', fabricCanvas.width, 'x', fabricCanvas.height);
        
        // Also set wrapper container dimensions
        const wrapper = fabricCanvas.wrapperEl;
        if (wrapper) {
            wrapper.style.width = '100%';
            wrapper.style.height = '100%';
            wrapper.style.position = 'relative';
            console.log('Wrapper element found and styled');
        } else {
            console.warn('No wrapper element found');
        }
        
        fabricCanvas.renderAll();
    }

    /**
     * Scroll the outer wrapper to make points visible
     */
    function scrollViewToPoints() {
        if (!outerWrapper || !points.length) return;
        
        // Calculate bounding box of all points
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        points.forEach(point => {
            const left = point.left || 0;
            const top = point.top || 0;
            minX = Math.min(minX, left - POINT_RADIUS);
            minY = Math.min(minY, top - POINT_RADIUS);
            maxX = Math.max(maxX, left + POINT_RADIUS);
            maxY = Math.max(maxY, top + POINT_RADIUS);
        });
        
        // Calculate center of points
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        // Calculate scroll position to center the points
        const wrapperWidth = outerWrapper.clientWidth;
        const wrapperHeight = outerWrapper.clientHeight;
        
        const scrollLeft = Math.max(0, centerX - wrapperWidth / 2);
        const scrollTop = Math.max(0, centerY - wrapperHeight / 2);
        
        console.log(`Scrolling to points: center(${centerX},${centerY}), wrapper(${wrapperWidth}x${wrapperHeight}), scroll(${scrollLeft},${scrollTop})`);
        
        outerWrapper.scrollLeft = scrollLeft;
        outerWrapper.scrollTop = scrollTop;
    }

    /**
     * Show/hide points and lines
     * @param {boolean} visible
     */
    function setPointsVisibility(visible) {
        points.forEach(p => p.set({ visible }));
        lines.forEach(l => l.set({ visible }));
        fabricCanvas.renderAll();
    }

    /**
     * Get the Fabric canvas instance
     */
    function getCanvas() {
        return fabricCanvas;
    }

    /**
     * Clear canvas and remove all objects
     */
    function clear() {
        if (!fabricCanvas) return;
        fabricCanvas.clear();
        points = [];
        lines = [];
        createPoints();
    }

    // Public API
    return {
        init,
        setPoints,
        getPoints,
        autoDetectCorners,
        resetPoints,
        setCanvasSize,
        setPointsVisibility,
        getCanvas,
        clear,
        updateLines
    };
})();