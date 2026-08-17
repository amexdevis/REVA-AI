/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Utility to process character images and remove the dark background
 * using an edge-connected flood-fill algorithm so character clothing (even black items)
 * and dark purple hair remain 100% opaque, while the outside dark background is completely transparent.
 */
const processedCache = new Map<string, string>();

export async function removeDarkBackground(imageSrc: string): Promise<string> {
  if (processedCache.has(imageSrc)) {
    return processedCache.get(imageSrc)!;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';

    img.onload = () => {
      try {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (!ctx) {
          resolve(imageSrc);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // Visited array for flood-fill
        const visited = new Uint8Array(width * height);
        const queue: number[] = [];

        // Threshold for considering a pixel "dark background" near outer edges
        // Dark background has low luminance and low saturation
        const isDarkBackgroundPixel = (idx: number) => {
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
          // Background in dark anime renders is typically near pitch black (brightness < 38)
          return brightness < 40;
        };

        // Seed queue from all 4 borders
        // Top and Bottom edges
        for (let x = 0; x < width; x++) {
          const topIdx = (0 * width + x) * 4;
          if (isDarkBackgroundPixel(topIdx)) {
            queue.push(x, 0);
            visited[0 * width + x] = 1;
          }
          const botIdx = ((height - 1) * width + x) * 4;
          if (isDarkBackgroundPixel(botIdx)) {
            queue.push(x, height - 1);
            visited[(height - 1) * width + x] = 1;
          }
        }

        // Left and Right edges
        for (let y = 0; y < height; y++) {
          const leftIdx = (y * width + 0) * 4;
          if (!visited[y * width + 0] && isDarkBackgroundPixel(leftIdx)) {
            queue.push(0, y);
            visited[y * width + 0] = 1;
          }
          const rightIdx = (y * width + (width - 1)) * 4;
          if (!visited[y * width + (width - 1)] && isDarkBackgroundPixel(rightIdx)) {
            queue.push(width - 1, y);
            visited[y * width + (width - 1)] = 1;
          }
        }

        // BFS flood-fill to find all connected background pixels
        let head = 0;
        const dx = [1, -1, 0, 0];
        const dy = [0, 0, 1, -1];

        while (head < queue.length) {
          const cx = queue[head++];
          const cy = queue[head++];
          const currentPixelIdx = cy * width + cx;
          const dataIdx = currentPixelIdx * 4;

          // Set background pixel alpha to 0
          const r = data[dataIdx];
          const g = data[dataIdx + 1];
          const b = data[dataIdx + 2];
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

          // Soft edge blending near character contours
          if (brightness > 22) {
            data[dataIdx + 3] = Math.max(0, Math.min(255, Math.round((brightness - 22) * 14)));
          } else {
            data[dataIdx + 3] = 0;
          }

          // Check neighbors
          for (let i = 0; i < 4; i++) {
            const nx = cx + dx[i];
            const ny = cy + dy[i];

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nPixelIdx = ny * width + nx;
              if (!visited[nPixelIdx]) {
                const nDataIdx = nPixelIdx * 4;
                if (isDarkBackgroundPixel(nDataIdx)) {
                  visited[nPixelIdx] = 1;
                  queue.push(nx, ny);
                }
              }
            }
          }
        }

        // Also clean up any isolated nearly pure black border artifacts
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const pIdx = y * width + x;
            const dIdx = pIdx * 4;
            const r = data[dIdx];
            const g = data[dIdx + 1];
            const b = data[dIdx + 2];
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

            if (visited[pIdx]) {
              // already handled
              continue;
            }

            // If an unvisited pixel is extremely dark (< 10) on outer third regions, soften it
            if (brightness < 12 && (x < width * 0.25 || x > width * 0.75 || y < height * 0.15 || y > height * 0.88)) {
              data[dIdx + 3] = 0;
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        const transparentDataUrl = canvas.toDataURL('image/png');
        processedCache.set(imageSrc, transparentDataUrl);
        resolve(transparentDataUrl);
      } catch (err) {
        console.error('Error processing background transparency:', err);
        resolve(imageSrc);
      }
    };

    img.onerror = () => {
      resolve(imageSrc);
    };

    img.src = imageSrc;
  });
}
