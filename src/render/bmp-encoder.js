/**
 * BMP encoding helpers for `<img>`-based presentation of software buffers.
 *
 * Converts scalar CPU raster data into 24-bit bitmap blobs so the app can
 * present the frame, depth, and stencil buffers with plain HTML image tags.
 *
 * @author Ilya Tsivilskiy
 * @see BmpEncoder
 */

(function () {
  const app = window.Procerender;

  /**
   * Tiny BMP encoder that targets browser-friendly 24-bit RGB bitmaps.
   */
  class BmpEncoder {
    /**
     * Converts a normalized scalar field into a grayscale BMP blob.
     *
     * @param {Float32Array} values
     * @param {number} width
     * @param {number} height
     * @returns {Blob}
     */
    static createGrayscaleBlob(values, width, height) {
      const rgb = new Uint8Array(width * height * 3);

      for (let index = 0; index < values.length; index += 1) {
        const byteValue = BmpEncoder.toByte(values[index] * 255);
        const rgbOffset = index * 3;
        rgb[rgbOffset] = byteValue;
        rgb[rgbOffset + 1] = byteValue;
        rgb[rgbOffset + 2] = byteValue;
      }

      return BmpEncoder.createRgbBlob(rgb, width, height);
    }

    /**
     * Converts a binary mask into a black-and-white BMP blob.
     *
     * @param {Uint8Array} values
     * @param {number} width
     * @param {number} height
     * @returns {Blob}
     */
    static createBinaryBlob(values, width, height) {
      const rgb = new Uint8Array(width * height * 3);

      for (let index = 0; index < values.length; index += 1) {
        const byteValue = values[index] ? 255 : 0;
        const rgbOffset = index * 3;
        rgb[rgbOffset] = byteValue;
        rgb[rgbOffset + 1] = byteValue;
        rgb[rgbOffset + 2] = byteValue;
      }

      return BmpEncoder.createRgbBlob(rgb, width, height);
    }

    /**
     * Encodes an RGB byte buffer into a bottom-up 24-bit BMP blob.
     *
     * @param {Uint8Array} rgbBytes Flat RGB bytes in top-down row order.
     * @param {number} width
     * @param {number} height
     * @returns {Blob}
     */
    static createRgbBlob(rgbBytes, width, height) {
      const rowStride = width * 3;
      const paddedStride = (rowStride + 3) & ~3;
      const pixelDataSize = paddedStride * height;
      const fileSize = 54 + pixelDataSize;
      const bytes = new Uint8Array(fileSize);
      const view = new DataView(bytes.buffer);

      bytes[0] = 0x42;
      bytes[1] = 0x4d;
      view.setUint32(2, fileSize, true);
      view.setUint32(10, 54, true);
      view.setUint32(14, 40, true);
      view.setInt32(18, width, true);
      view.setInt32(22, height, true);
      view.setUint16(26, 1, true);
      view.setUint16(28, 24, true);
      view.setUint32(34, pixelDataSize, true);

      for (let destRow = 0; destRow < height; destRow += 1) {
        // BMP stores rows bottom-up, while the rasterizer stores them top-down,
        // so every exported row is mirrored vertically during the copy.
        const sourceRow = height - 1 - destRow;
        const sourceOffset = sourceRow * rowStride;
        const destOffset = 54 + destRow * paddedStride;

        for (let x = 0; x < width; x += 1) {
          const sourcePixel = sourceOffset + x * 3;
          const destPixel = destOffset + x * 3;
          const red = rgbBytes[sourcePixel];
          const green = rgbBytes[sourcePixel + 1];
          const blue = rgbBytes[sourcePixel + 2];
          bytes[destPixel] = blue;
          bytes[destPixel + 1] = green;
          bytes[destPixel + 2] = red;
        }
      }

      return new Blob([bytes], { type: "image/bmp" });
    }

    /**
     * Clamps and rounds a scalar channel to the byte range.
     *
     * @param {number} value
     * @returns {number}
     */
    static toByte(value) {
      return Math.max(0, Math.min(255, Math.round(value)));
    }
  }

  Object.assign(app, { BmpEncoder });
})();
