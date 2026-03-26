/**
 * cv-engine.js - OpenCV.js image processing engine for document scanning
 * Core functions: perspective correction, image enhancement, mode conversion
 */

const CVEngine = (function() {
    // Module state
    let isOpenCVReady = false;
    let originalMat = null;
    let processedMat = null;

    /**
     * Initialize OpenCV.js - called when OpenCV script loads
     */
    function init() {
        console.log('CVEngine.init() called, checking for OpenCV...');
        if (typeof cv === 'undefined') {
            console.error('OpenCV.js not loaded - cv object is undefined');
            return false;
        }
        console.log('OpenCV.js is available, cv object:', typeof cv, cv.getBuildInformation ? 'has getBuildInformation' : 'no getBuildInformation');
        isOpenCVReady = true;
        console.log('CVEngine initialized');
        return true;
    }

    /**
     * Load an image file or URL into an OpenCV Mat
     * @param {HTMLImageElement|File|string} source - Image element, File object, or URL
     * @returns {Promise<cv.Mat>} Resolves with the loaded Mat
     */
    function loadImage(source) {
        return new Promise((resolve, reject) => {
            if (!isOpenCVReady) {
                reject(new Error('OpenCV.js not ready'));
                return;
            }

            const img = new Image();
            img.crossOrigin = 'anonymous';

            if (typeof source === 'string') {
                img.src = source;
                img.onload = handleImageLoad;
                img.onerror = () => reject(new Error('Failed to load image from URL'));
            } else if (source instanceof File) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    img.src = e.target.result;
                    img.onload = handleImageLoad;
                    img.onerror = () => reject(new Error('Failed to load image from FileReader'));
                };
                reader.onerror = () => reject(new Error('Failed to read file'));
                reader.readAsDataURL(source);
            } else if (source instanceof HTMLImageElement) {
                img.src = source.src;
                img.onload = handleImageLoad;
                img.onerror = () => reject(new Error('Failed to load image from HTMLImageElement'));
            } else {
                reject(new Error('Unsupported image source'));
                return;
            }

            function handleImageLoad() {
                try {
                    // Create Mat from image
                    const mat = cv.imread(img);
                    // Store as original
                    if (originalMat) originalMat.delete();
                    originalMat = mat;
                    resolve(mat);
                } catch (error) {
                    reject(error);
                }
            }
        });
    }

    /**
     * Calculate Euclidean distance between two points
     */
    function _distance(p1, p2) {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }

    /**
     * Compute width and height of destination rectangle from four points.
     * Uses max of opposite side lengths.
     * @param {Array<{x:number, y:number}>} pts - Four corner points [top-left, top-right, bottom-right, bottom-left]
     * @returns {{width: number, height: number}}
     */
    function computeDestinationSize(pts) {
        if (pts.length !== 4) throw new Error('Exactly four points required');

        // Compute width as max of top and bottom edge lengths
        const widthTop = _distance(pts[0], pts[1]);
        const widthBottom = _distance(pts[3], pts[2]);
        const width = Math.max(widthTop, widthBottom);

        // Compute height as max of left and right edge lengths
        const heightLeft = _distance(pts[0], pts[3]);
        const heightRight = _distance(pts[1], pts[2]);
        const height = Math.max(heightLeft, heightRight);

        return { width: Math.round(width), height: Math.round(height) };
    }

    /**
     * Apply perspective transformation to straighten document.
     * @param {cv.Mat} srcMat - Input image matrix
     * @param {Array<{x:number, y:number}>} srcPoints - Four corner points in source image (order: TL, TR, BR, BL)
     * @returns {cv.Mat} Transformed matrix
     */
    function perspectiveCorrection(srcMat, srcPoints) {
        if (!srcMat || srcPoints.length !== 4) {
            throw new Error('Invalid input');
        }

        const dstSize = computeDestinationSize(srcPoints);
        const dstPoints = [
            { x: 0, y: 0 }, // TL
            { x: dstSize.width - 1, y: 0 }, // TR
            { x: dstSize.width - 1, y: dstSize.height - 1 }, // BR
            { x: 0, y: dstSize.height - 1 }  // BL
        ];

        // Convert points to OpenCV Point2f arrays
        const srcVec = new cv.MatVector();
        const dstVec = new cv.MatVector();
        const srcData = cv.matFromArray(4, 1, cv.CV_32FC2, [
            srcPoints[0].x, srcPoints[0].y,
            srcPoints[1].x, srcPoints[1].y,
            srcPoints[2].x, srcPoints[2].y,
            srcPoints[3].x, srcPoints[3].y
        ]);
        const dstData = cv.matFromArray(4, 1, cv.CV_32FC2, [
            dstPoints[0].x, dstPoints[0].y,
            dstPoints[1].x, dstPoints[1].y,
            dstPoints[2].x, dstPoints[2].y,
            dstPoints[3].x, dstPoints[3].y
        ]);
        srcVec.push_back(srcData);
        dstVec.push_back(dstData);

        // Compute perspective transform matrix
        const transformMat = cv.getPerspectiveTransform(srcData, dstData);

        // Apply warp
        const dstMat = new cv.Mat();
        cv.warpPerspective(srcMat, dstMat, transformMat, new cv.Size(dstSize.width, dstSize.height));

        // Cleanup
        srcVec.delete();
        dstVec.delete();
        srcData.delete();
        dstData.delete();
        transformMat.delete();

        return dstMat;
    }

    /**
     * Convert image to grayscale
     * @param {cv.Mat} srcMat - Input matrix
     * @returns {cv.Mat} Grayscale matrix
     */
    function toGrayscale(srcMat) {
        const grayMat = new cv.Mat();
        cv.cvtColor(srcMat, grayMat, cv.COLOR_RGBA2GRAY);
        return grayMat;
    }

    /**
     * Apply adaptive threshold for black & white enhancement
     * @param {cv.Mat} srcMat - Input matrix (grayscale)
     * @param {number} blockSize - Block size for adaptive threshold (odd)
     * @param {number} C - Constant subtracted from mean
     * @returns {cv.Mat} Binary matrix
     */
    function adaptiveThreshold(srcMat, blockSize = 11, C = 2) {
        const dstMat = new cv.Mat();
        cv.adaptiveThreshold(
            srcMat,
            dstMat,
            255, // max value
            cv.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv.THRESH_BINARY,
            blockSize,
            C
        );
        return dstMat;
    }

    /**
     * Convert image to black & white enhanced mode
     * @param {cv.Mat} srcMat - Input matrix (color)
     * @returns {cv.Mat} B/W enhanced matrix
     */
    function toBlackWhiteEnhanced(srcMat) {
        const gray = toGrayscale(srcMat);
        const bw = adaptiveThreshold(gray, 11, 2);
        gray.delete();

        // Convert back to 4-channel for consistent output
        const result = new cv.Mat();
        cv.cvtColor(bw, result, cv.COLOR_GRAY2RGBA);
        bw.delete();
        return result;
    }

    /**
     * Process image with given points and mode
     * @param {cv.Mat} srcMat - Source image matrix
     * @param {Array<{x:number, y:number}>} points - Four corner points
     * @param {string} mode - 'color', 'grayscale', or 'bw'
     * @returns {cv.Mat} Processed matrix
     */
    function processImage(srcMat, points, mode = 'bw') {
        if (!srcMat || !points || points.length !== 4) {
            throw new Error('Invalid input for processing');
        }

        // Step 1: Perspective correction
        let processed = perspectiveCorrection(srcMat, points);

        // Step 2: Apply mode-specific processing
        if (mode === 'grayscale') {
            const gray = toGrayscale(processed);
            processed.delete();
            // Convert back to 4-channel for consistency
            const gray4ch = new cv.Mat();
            cv.cvtColor(gray, gray4ch, cv.COLOR_GRAY2RGBA);
            gray.delete();
            processed = gray4ch;
        } else if (mode === 'bw') {
            const bw = toBlackWhiteEnhanced(processed);
            processed.delete();
            processed = bw;
        }
        // If mode === 'color', keep as is (already corrected)

        // Store processed matrix
        if (processedMat) processedMat.delete();
        processedMat = processed;

        return processed;
    }

    /**
     * Convert OpenCV Mat to ImageData for canvas rendering
     * @param {cv.Mat} mat - Matrix to convert
     * @returns {ImageData} ImageData object
     */
    function matToImageData(mat) {
        const imgData = new ImageData(mat.cols, mat.rows);
        cv.imshow('cvCanvas', mat); // Use hidden canvas
        const ctx = document.getElementById('cvCanvas').getContext('2d');
        return ctx.getImageData(0, 0, mat.cols, mat.rows);
    }

    /**
     * Draw OpenCV Mat onto a canvas element
     * @param {cv.Mat} mat - Matrix to draw
     * @param {HTMLCanvasElement} canvas - Target canvas
     */
    function drawMatToCanvas(mat, canvas) {
        if (!mat || !canvas) return;
        cv.imshow(canvas, mat);
    }

    /**
     * Cleanup memory
     */
    function cleanup() {
        if (originalMat) {
            originalMat.delete();
            originalMat = null;
        }
        if (processedMat) {
            processedMat.delete();
            processedMat = null;
        }
    }

    /**
     * Get current processed Mat (if any)
     */
    function getProcessedMat() {
        return processedMat;
    }

    /**
     * Get OpenCV readiness status
     */
    function isReady() {
        return isOpenCVReady;
    }

    // Public API
    return {
        init,
        loadImage,
        processImage,
        computeDestinationSize,
        perspectiveCorrection,
        toGrayscale,
        adaptiveThreshold,
        toBlackWhiteEnhanced,
        matToImageData,
        drawMatToCanvas,
        cleanup,
        getProcessedMat,
        isReady
    };
})();

// No auto‑initialization; init() must be called explicitly after OpenCV loads
