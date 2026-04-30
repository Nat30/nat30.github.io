/**
 * cv-engine.js - Document scanning engine
 * Uses jscanify for edge detection, pure JS for perspective warp & image enhancement
 */

const CVEngine = (function() {
    let isReady = false;
    let scanner = null;

    function init() {
        if (typeof jscanify === 'undefined') {
            return false;
        }
        if (typeof cv === 'undefined') {
            return false;
        }
        scanner = new jscanify();
        isReady = true;
        return true;
    }

    function loadImage(source) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            if (typeof source === 'string') {
                img.src = source;
            } else if (source instanceof File) {
                const reader = new FileReader();
                reader.onload = (e) => { img.src = e.target.result; };
                reader.onerror = () => reject(new Error('Failed to read file'));
                reader.readAsDataURL(source);
            } else if (source instanceof HTMLImageElement) {
                img.src = source.src;
            } else {
                reject(new Error('Unsupported image source'));
                return;
            }

            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image'));
        });
    }

    function detectCorners(imageElement) {
        if (!scanner || typeof cv === 'undefined') return null;
        const img = cv.imread(imageElement);
        const contour = scanner.findPaperContour(img);
        if (!contour) {
            img.delete();
            return null;
        }
        const corners = scanner.getCornerPoints(contour);
        img.delete();
        if (!corners.topLeftCorner || !corners.topRightCorner ||
            !corners.bottomLeftCorner || !corners.bottomRightCorner) {
            return null;
        }
        return [
            corners.topLeftCorner,
            corners.topRightCorner,
            corners.bottomRightCorner,
            corners.bottomLeftCorner
        ];
    }

    function _distance(p1, p2) {
        return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    }

    function computeDestinationSize(pts) {
        if (pts.length !== 4) throw new Error('Exactly four points required');
        const widthTop = _distance(pts[0], pts[1]);
        const widthBottom = _distance(pts[3], pts[2]);
        const heightLeft = _distance(pts[0], pts[3]);
        const heightRight = _distance(pts[1], pts[2]);
        return {
            width: Math.round(Math.max(widthTop, widthBottom)),
            height: Math.round(Math.max(heightLeft, heightRight))
        };
    }

    function _getPerspectiveTransform(src, dst) {
        const x0 = src[0].x, y0 = src[0].y;
        const x1 = src[1].x, y1 = src[1].y;
        const x2 = src[2].x, y2 = src[2].y;
        const x3 = src[3].x, y3 = src[3].y;
        const u0 = dst[0].x, v0 = dst[0].y;
        const u1 = dst[1].x, v1 = dst[1].y;
        const u2 = dst[2].x, v2 = dst[2].y;
        const u3 = dst[3].x, v3 = dst[3].y;

        const A = [
            [x0, y0, 1, 0, 0, 0, -u0*x0, -u0*y0],
            [0, 0, 0, x0, y0, 1, -v0*x0, -v0*y0],
            [x1, y1, 1, 0, 0, 0, -u1*x1, -u1*y1],
            [0, 0, 0, x1, y1, 1, -v1*x1, -v1*y1],
            [x2, y2, 1, 0, 0, 0, -u2*x2, -u2*y2],
            [0, 0, 0, x2, y2, 1, -v2*x2, -v2*y2],
            [x3, y3, 1, 0, 0, 0, -u3*x3, -u3*y3],
            [0, 0, 0, x3, y3, 1, -v3*x3, -v3*y3]
        ];
        const b = [u0, v0, u1, v1, u2, v2, u3, v3];
        const h = _solveLinearSystem(A, b);
        if (!h) return null;
        return [
            h[0], h[1], h[2],
            h[3], h[4], h[5],
            h[6], h[7], 1
        ];
    }

    function _solveLinearSystem(A, b) {
        const n = A.length;
        const M = A.map((row, i) => [...row, b[i]]);

        for (let col = 0; col < n; col++) {
            let maxRow = col;
            for (let row = col + 1; row < n; row++) {
                if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
            }
            [M[col], M[maxRow]] = [M[maxRow], M[col]];

            if (Math.abs(M[col][col]) < 1e-12) return null;

            for (let row = col + 1; row < n; row++) {
                const factor = M[row][col] / M[col][col];
                for (let j = col; j <= n; j++) {
                    M[row][j] -= factor * M[col][j];
                }
            }
        }

        const x = new Array(n);
        for (let i = n - 1; i >= 0; i--) {
            x[i] = M[i][n];
            for (let j = i + 1; j < n; j++) {
                x[i] -= M[i][j] * x[j];
            }
            x[i] /= M[i][i];
        }
        return x;
    }

    function perspectiveCorrection(sourceCanvas, srcPoints) {
        if (!sourceCanvas || srcPoints.length !== 4) {
            throw new Error('Invalid input');
        }

        const dstSize = computeDestinationSize(srcPoints);
        const dstPoints = [
            { x: 0, y: 0 },
            { x: dstSize.width - 1, y: 0 },
            { x: dstSize.width - 1, y: dstSize.height - 1 },
            { x: 0, y: dstSize.height - 1 }
        ];

        const H = _getPerspectiveTransform(dstPoints, srcPoints);
        if (!H) throw new Error('Failed to compute perspective transform');

        const srcCtx = sourceCanvas.getContext('2d');
        const srcImageData = srcCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
        const srcData = srcImageData.data;
        const srcW = sourceCanvas.width;

        const dstCanvas = document.createElement('canvas');
        dstCanvas.width = dstSize.width;
        dstCanvas.height = dstSize.height;
        const dstCtx = dstCanvas.getContext('2d');
        const dstImageData = dstCtx.createImageData(dstSize.width, dstSize.height);
        const dstData = dstImageData.data;

        for (let v = 0; v < dstSize.height; v++) {
            for (let u = 0; u < dstSize.width; u++) {
                const w = H[6] * u + H[7] * v + H[8];
                const srcX = (H[0] * u + H[1] * v + H[2]) / w;
                const srcY = (H[3] * u + H[4] * v + H[5]) / w;

                const px = Math.round(srcX);
                const py = Math.round(srcY);

                if (px >= 0 && px < srcW && py >= 0 && py < sourceCanvas.height) {
                    const srcIdx = (py * srcW + px) * 4;
                    const dstIdx = (v * dstSize.width + u) * 4;
                    dstData[dstIdx] = srcData[srcIdx];
                    dstData[dstIdx + 1] = srcData[srcIdx + 1];
                    dstData[dstIdx + 2] = srcData[srcIdx + 2];
                    dstData[dstIdx + 3] = srcData[srcIdx + 3];
                }
            }
        }

        dstCtx.putImageData(dstImageData, 0, 0);
        return dstCanvas;
    }

    function _bilinearSample(imageData, x, y, width, height) {
        const x0 = Math.floor(x);
        const y0 = Math.floor(y);
        const x1 = Math.min(x0 + 1, width - 1);
        const y1 = Math.min(y0 + 1, height - 1);

        if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) return [255, 255, 255, 255];

        const fx = x - x0;
        const fy = y - y0;
        const data = imageData.data;

        const i00 = (y0 * width + x0) * 4;
        const i10 = (y0 * width + x1) * 4;
        const i01 = (y1 * width + x0) * 4;
        const i11 = (y1 * width + x1) * 4;

        const result = [];
        for (let c = 0; c < 4; c++) {
            const v = data[i00 + c] * (1 - fx) * (1 - fy) +
                      data[i10 + c] * fx * (1 - fy) +
                      data[i01 + c] * (1 - fx) * fy +
                      data[i11 + c] * fx * fy;
            result.push(Math.round(v));
        }
        return result;
    }

    function perspectiveCorrectionHQ(sourceCanvas, srcPoints) {
        if (!sourceCanvas || srcPoints.length !== 4) {
            throw new Error('Invalid input');
        }

        const dstSize = computeDestinationSize(srcPoints);
        const dstPoints = [
            { x: 0, y: 0 },
            { x: dstSize.width - 1, y: 0 },
            { x: dstSize.width - 1, y: dstSize.height - 1 },
            { x: 0, y: dstSize.height - 1 }
        ];

        const H = _getPerspectiveTransform(dstPoints, srcPoints);
        if (!H) throw new Error('Failed to compute perspective transform');

        const srcCtx = sourceCanvas.getContext('2d');
        const srcImageData = srcCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
        const srcW = sourceCanvas.width;
        const srcH = sourceCanvas.height;

        const dstCanvas = document.createElement('canvas');
        dstCanvas.width = dstSize.width;
        dstCanvas.height = dstSize.height;
        const dstCtx = dstCanvas.getContext('2d');
        const dstImageData = dstCtx.createImageData(dstSize.width, dstSize.height);
        const dstData = dstImageData.data;

        for (let v = 0; v < dstSize.height; v++) {
            for (let u = 0; u < dstSize.width; u++) {
                const w = H[6] * u + H[7] * v + H[8];
                const srcX = (H[0] * u + H[1] * v + H[2]) / w;
                const srcY = (H[3] * u + H[4] * v + H[5]) / w;

                const dstIdx = (v * dstSize.width + u) * 4;
                if (srcX >= 0 && srcX < srcW && srcY >= 0 && srcY < srcH) {
                    const [r, g, b, a] = _bilinearSample(srcImageData, srcX, srcY, srcW, srcH);
                    dstData[dstIdx] = r;
                    dstData[dstIdx + 1] = g;
                    dstData[dstIdx + 2] = b;
                    dstData[dstIdx + 3] = a;
                }
            }
        }

        dstCtx.putImageData(dstImageData, 0, 0);
        return dstCanvas;
    }

    function _drawImageToCanvas(img) {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return canvas;
    }

    function _applyGrayscale(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            data[i] = data[i + 1] = data[i + 2] = gray;
        }
        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    function _applyAdaptiveThreshold(canvas, blockSize, C) {
        blockSize = blockSize || 15;
        C = C || 10;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const w = canvas.width;
        const h = canvas.height;
        const half = Math.floor(blockSize / 2);

        const gray = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) {
            gray[i] = data[i * 4];
        }

        const integral = new Float64Array(w * h);
        for (let y = 0; y < h; y++) {
            let rowSum = 0;
            for (let x = 0; x < w; x++) {
                rowSum += gray[y * w + x];
                integral[y * w + x] = rowSum + (y > 0 ? integral[(y - 1) * w + x] : 0);
            }
        }

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const x1 = Math.max(0, x - half);
                const y1 = Math.max(0, y - half);
                const x2 = Math.min(w - 1, x + half);
                const y2 = Math.min(h - 1, y + half);

                const count = (x2 - x1 + 1) * (y2 - y1 + 1);
                let sum = integral[y2 * w + x2];
                if (x1 > 0) sum -= integral[y2 * w + (x1 - 1)];
                if (y1 > 0) sum -= integral[(y1 - 1) * w + x2];
                if (x1 > 0 && y1 > 0) sum += integral[(y1 - 1) * w + (x1 - 1)];

                const mean = sum / count;
                const idx = (y * w + x) * 4;
                const val = gray[y * w + x] > mean - C ? 255 : 0;
                data[idx] = data[idx + 1] = data[idx + 2] = val;
            }
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    function processImage(sourceImage, points, mode) {
        if (!sourceImage || !points || points.length !== 4) {
            throw new Error('Invalid input for processing');
        }

        const srcCanvas = _drawImageToCanvas(sourceImage);

        let processed = perspectiveCorrectionHQ(srcCanvas, points);

        if (mode === 'grayscale') {
            processed = _applyGrayscale(processed);
        } else if (mode === 'bw') {
            processed = _applyGrayscale(processed);
            processed = _applyAdaptiveThreshold(processed);
        }

        return processed;
    }

    function drawResultToCanvas(resultCanvas, targetCanvas) {
        if (!resultCanvas || !targetCanvas) return;
        targetCanvas.width = resultCanvas.width;
        targetCanvas.height = resultCanvas.height;
        const ctx = targetCanvas.getContext('2d');
        ctx.drawImage(resultCanvas, 0, 0);
    }

    return {
        init,
        loadImage,
        processImage,
        detectCorners,
        computeDestinationSize,
        perspectiveCorrection,
        perspectiveCorrectionHQ,
        drawResultToCanvas,
        isReady: () => isReady
    };
})();
