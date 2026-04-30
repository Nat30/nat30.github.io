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
    const POINT_RADIUS = 15; // Increased from 10 for better touch target
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
            perPixelTargetFind: true
        });
        
        const wrapper = fabricCanvas.wrapperEl;
        if (wrapper) {
            wrapper.style.width = '100%';
            wrapper.style.height = '100%';
            wrapper.style.position = 'relative';
        }
        
        const canvasElement = fabricCanvas.lowerCanvasEl || canvasEl;
        outerWrapper = null;
        if (canvasElement && canvasElement.parentNode && canvasElement.parentNode.parentNode) {
            outerWrapper = canvasElement.parentNode.parentNode;
            if (!outerWrapper.classList.contains('canvas-wrapper')) {
                outerWrapper = canvasElement.closest('.canvas-wrapper');
            }
        }
        
        onPointsChanged = pointsCallback;

        // Create initial points (hidden until image is loaded)
        createPoints();
        updateLines();

        // Bind events
        fabricCanvas.on('object:modified', handlePointDrag);
        fabricCanvas.on('object:moving', handlePointDrag);
        
        fabricCanvas.on('mouse:wheel', function(opt) {
            const delta = opt.e.deltaY;
            let zoom = fabricCanvas.getZoom();
            zoom *= 0.999 ** delta;
            zoom = Math.min(Math.max(0.1, zoom), 5);
            fabricCanvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
            opt.e.preventDefault();
            opt.e.stopPropagation();
        });

        fabricCanvas.on('mouse:down', function(e) {
            if (!e.target) {
                fabricCanvas.discardActiveObject();
                fabricCanvas.renderAll();
                updatePointsVisualState();
            }
        });
    }

    /**
     * Create four draggable circle points at default positions
     */
    function createPoints() {
        points = [];
        const pointLabels = ['TL', 'TR', 'BR', 'BL'];
        for (let i = 0; i < 4; i++) {
            const point = new fabric.Circle({
                left: 100 + i * 50,
                top: 100 + i * 30,
                radius: POINT_RADIUS,
                fill: POINT_COLOR,
                stroke: '#ffffff',
                strokeWidth: 3,
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
                transparentCorners: false,
                data: { 
                    index: i, 
                    label: pointLabels[i],
                    originalFill: POINT_COLOR
                }
            });

            const label = new fabric.Text(pointLabels[i], {
                left: point.left,
                top: point.top - POINT_RADIUS - 14,
                fontSize: 11,
                fill: '#ffffff',
                fontWeight: 'bold',
                originX: 'center',
                originY: 'center',
                selectable: false,
                evented: false,
                data: { pointIndex: i }
            });
            point.data.labelObj = label;

            points.push(point);
            fabricCanvas.add(label);
            fabricCanvas.add(point);
            point.bringToFront();
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

        const canvasWidth = fabricCanvas.width;
        const canvasHeight = fabricCanvas.height;
        
        const margin = POINT_RADIUS * 1.5;
        const newLeft = Math.max(margin, Math.min(canvasWidth - margin, point.left));
        const newTop = Math.max(margin, Math.min(canvasHeight - margin, point.top));
        
        if (Math.abs(point.left - newLeft) > 0.1 || Math.abs(point.top - newTop) > 0.1) {
            point.set({ left: newLeft, top: newTop });
            
            if (point.data.labelObj) {
                point.data.labelObj.set({ left: newLeft, top: newTop - POINT_RADIUS - 14 });
            }
            
            updateLines();
            if (onPointsChanged) {
                onPointsChanged(getPoints());
            }
        }
        
        updatePointsVisualState();
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
        const margin = POINT_RADIUS * 1.5;

        coords.forEach((coord, i) => {
            const x = normalized ? coord.x * canvasWidth : coord.x;
            const y = normalized ? coord.y * canvasHeight : coord.y;
            const clampedX = Math.max(margin, Math.min(canvasWidth - margin, x));
            const clampedY = Math.max(margin, Math.min(canvasHeight - margin, y));
            points[i].set({ left: clampedX, top: clampedY });
            if (points[i].data.labelObj) {
                points[i].data.labelObj.set({ left: clampedX, top: clampedY - POINT_RADIUS - 14 });
            }
        });

        updateLines();
        if (onPointsChanged) onPointsChanged(getPoints());
        updatePointsVisualState();
        setTimeout(scrollViewToPoints, 100);
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
        if (typeof CVEngine === 'undefined' || !CVEngine.isReady()) {
            throw new Error('Scan engine not ready');
        }

        const corners = CVEngine.detectCorners(imageElement);
        if (!corners) {
            throw new Error('No document detected in image');
        }

        const img = imageElement;
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;

        const normalized = corners.map(p => ({
            x: p.x / width,
            y: p.y / height
        }));

        return normalized;
    }

    /**
     * Reset points to default positions (image corners)
     * @param {number} width - Image width
     * @param {number} height - Image height
     */
    function resetPoints(width, height) {
        if (!width || !height) {
            width = fabricCanvas.width;
            height = fabricCanvas.height;
        }
        const margin = 0.2;
        const coords = [
            { x: width * margin, y: height * margin },
            { x: width * (1 - margin), y: height * margin },
            { x: width * (1 - margin), y: height * (1 - margin) },
            { x: width * margin, y: height * (1 - margin) }
        ];
        setPoints(coords);
    }

    /**
     * Update visual state of points (e.g., change color when near edge)
     */
    function updatePointsVisualState() {
        if (!fabricCanvas || !points.length) return;
        
        const canvasWidth = fabricCanvas.width;
        const canvasHeight = fabricCanvas.height;
        const edgeThreshold = POINT_RADIUS * 3;
        
        points.forEach(point => {
            if (!point.data) return;
            
            const isNearEdge = point.left < edgeThreshold ||
                point.left > canvasWidth - edgeThreshold ||
                point.top < edgeThreshold ||
                point.top > canvasHeight - edgeThreshold;
            
            const newFill = isNearEdge ? '#f59e0b' : point.data.originalFill;
            
            if (point.fill !== newFill) {
                point.set({ fill: newFill });
            }
        });
        
        fabricCanvas.renderAll();
    }

    /**
     * Set canvas size to match image dimensions
     * @param {number} width
     * @param {number} height
     */
    function setCanvasSize(width, height) {
        if (!fabricCanvas) return;
        fabricCanvas.setDimensions({ width, height });
        
        const wrapper = fabricCanvas.wrapperEl;
        if (wrapper) {
            wrapper.style.width = '100%';
            wrapper.style.height = '100%';
            wrapper.style.position = 'relative';
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