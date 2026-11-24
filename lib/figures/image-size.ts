import type { PixelSize } from "./rules";

/**
 * The size in pixels of a JPEG or a PNG, read from its header, or null when it can't be read.
 * The figure pick needs it on the server: the AI gives its box in pixels of the image it was sent,
 * and the size is not taken on trust from the browser (decision 0025). Pure, no browser or
 * server APIs.
 */
export function imageSize(data: Uint8Array): PixelSize | null {
  const ok = (width: number, height: number): PixelSize | null => (width > 0 && height > 0 && width <= 20_000 && height <= 20_000 ? { width, height } : null);
  // PNG: the signature, then the IHDR chunk, which starts with the width and the height.
  if (data.length >= 24 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
    const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
    return ok(v.getUint32(16), v.getUint32(20));
  }
  // JPEG: segments of FF, a marker and a length. The frame header (SOF0 to SOF15, but not the
  // Huffman table C4, the reserved C8 or the arithmetic table CC) holds the height, then the width.
  if (data.length >= 4 && data[0] === 0xff && data[1] === 0xd8) {
    let i = 2;
    while (i + 8 < data.length) {
      if (data[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = data[i + 1]!;
      // Fill bytes, and markers that stand alone with no length after them.
      if (marker === 0xff) {
        i++;
        continue;
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      // The picture's data starts, or the file ends, with no frame header seen.
      if (marker === 0xda || marker === 0xd9) return null;
      const length = (data[i + 2]! << 8) | data[i + 3]!;
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return ok((data[i + 7]! << 8) | data[i + 8]!, (data[i + 5]! << 8) | data[i + 6]!);
      }
      if (length < 2) return null;
      i += 2 + length;
    }
  }
  return null;
}
