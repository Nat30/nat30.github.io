# DocScanner – Web Document Scanning & Perspective Correction

A pure front‑end web application for document scanning, perspective correction, and image enhancement using OpenCV.js and Fabric.js.

## Features

- **Interactive corner adjustment**: Drag four corner points to match document edges (Fabric.js)
- **Automatic corner detection**: Uses OpenCV contour detection to find document boundaries
- **Perspective correction**: Warps the image to a straight rectangle (OpenCV perspective transform)
- **Image enhancement modes**:
  - Color original
  - Grayscale
  - Black & white with adaptive thresholding
- **Export options**: PNG, JPEG, PDF (single or multi‑page)
- **Responsive UI**: Sidebar controls + canvas area, works on desktop and mobile

## Technology Stack

- **OpenCV.js** (4.9.0) – Computer vision for perspective transform and image processing
- **Fabric.js** (5.3.0) – Interactive canvas with draggable points
- **jsPDF** (2.5.1) – PDF generation
- **Lucide Icons** – UI icons
- **Vanilla JavaScript** – No framework dependencies
- **GitHub Pages** – Deployment ready

## Project Structure

```
DocScanner/
├── index.html          # Main entry point
├── css/
│   └── main.css       # Responsive styles
├── js/
│   ├── app.js         # Application controller & UI events
│   ├── cv-engine.js   # OpenCV image processing (core)
│   ├── fabric-handler.js # Interactive canvas points
│   └── pdf-exporter.js # PNG/JPG/PDF export
├── lib/
│   └── opencv.js      # OpenCV library (placeholder, CDN used)
├── assets/            # (Optional) icons, sample images
└── README.md          # This file
```

## Getting Started

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/docscanner.git
   cd docscanner
   ```

2. Serve the files with a local HTTP server (required for canvas image loading):
   ```bash
   # Using Python
   python3 -m http.server 8000
   ```
   Then open `http://localhost:8000` in a modern browser.

3. **OpenCV.js** is loaded from a CDN. If you prefer a local copy, download the full `opencv.js` (≈9 MB) from [OpenCV releases](https://github.com/opencv/opencv/releases) and place it in `lib/opencv.js`. Update the script URL in `index.html` if needed.

### Usage

1. **Upload** a document image (photo of a paper, whiteboard, etc.).
2. **Adjust corners** – drag the four blue circles to match the document edges, or click “Auto‑detect”.
3. **Select processing mode** – choose between color, grayscale, or black‑white enhanced.
4. **Click “Process & Preview”** to see the straightened result.
5. **Export** as PNG, JPEG, or PDF with selectable DPI (150, 300, 600).

## Implementation Notes

### Core Algorithms (`cv-engine.js`)

- **Perspective transform**: `cv.getPerspectiveTransform` + `cv.warpPerspective`
- **Destination size**: Computed as max of opposite side lengths
- **Black‑white enhancement**: `cv.adaptiveThreshold` with blockSize=11, C=2
- **Grayscale**: `cv.cvtColor` with `COLOR_RGBA2GRAY`

### Interactive Canvas (`fabric-handler.js`)

- Four draggable Fabric.js circles with connecting lines
- Coordinate normalization (0–1) for OpenCV
- Automatic corner detection using `cv.findContours` and polygon approximation

### Export (`pdf-exporter.js`)

- PNG/JPEG: Canvas scaling based on selected DPI
- PDF: Uses jsPDF with correct millimeter dimensions
- Multi‑page PDF support (API ready)

## Deployment to GitHub Pages

1. Push the repository to GitHub.
2. Go to **Settings → Pages**.
3. Select **Source**: `main` branch, `/ (root)` folder.
4. Save – your site will be live at `https://<username>.github.io/docscanner/`

## Browser Support

- Chrome, Firefox, Edge, Safari (desktop)
- iOS Safari, Chrome for mobile (limited testing)
- Requires ES6 support and `Canvas`/`Blob` APIs.

## Known Limitations

- OpenCV.js is large (≈9 MB) – CDN loading may be slow on weak connections.
- Auto‑detection works best on high‑contrast documents with clear edges.
- Very large images (>10 MP) may cause slow processing (consider client‑side resizing).

## Future Enhancements

- Batch processing of multiple images
- Undo/redo for point adjustments
- More advanced image filters (denoising, brightness/contrast sliders)
- Drag‑and‑drop upload
- PWA support for offline use

## License

MIT – see [LICENSE](LICENSE) file.

## Credits

- [OpenCV](https://opencv.org/) – Computer vision library
- [Fabric.js](http://fabricjs.com/) – Canvas library
- [jsPDF](https://parall.ax/products/jspdf) – PDF generation
- [Lucide Icons](https://lucide.dev/) – Beautiful icons
- Design and implementation by [Your Name].

---

*Built with pure browser technologies – no server required.*