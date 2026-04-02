/**
 * Presentation layer that maps scalar buffers onto `<img>` elements and HUD text.
 *
 * Responsible for converting raster buffers into BMP blobs, swapping the image
 * sources, and updating the descriptive readouts beside the stage.
 *
 * @author Ilya Tsivilskiy
 * @see ImagePresenter
 */

(function () {
  const app = window.Procerender;
  const { BmpEncoder } = app;

  /**
   * Presenter for the frame, depth, and stencil image tags.
   */
  class ImagePresenter {
    /**
     * @param {{
     *   images: { frame: HTMLImageElement, depth: HTMLImageElement, stencil: HTMLImageElement },
     *   readouts: {
     *     meshStats: HTMLElement,
     *     cameraAngles: HTMLElement,
     *     cameraDistance: HTMLElement,
     *     clipPlanes: HTMLElement,
     *     renderStats: HTMLElement,
     *     fpsMeter: HTMLElement,
     *     shadingMode: HTMLElement,
     *     outputStats: HTMLElement
     *   }
     * }} elements
     */
    constructor(elements) {
      this.images = elements.images;
      this.readouts = elements.readouts;
      this.urls = {
        frame: "",
        depth: "",
        stencil: "",
      };
    }

    /**
     * Updates all image outputs and textual readouts for the current frame.
     *
     * @param {app.FrameBuffer} frameBuffer
     * @param {{
     *   renderMs: number,
     *   fps: number,
     *   visibleTriangles: number,
     *   totalTriangles: number,
     *   shadingMode: string
     * }} renderStats
     * @param {app.OrbitCamera} camera
     * @param {ReturnType<typeof app.buildMesh>} mesh
     */
    present(frameBuffer, renderStats, camera, mesh) {
      this.updateImage(
        "frame",
        BmpEncoder.createGrayscaleBlob(
          frameBuffer.frameResolved,
          frameBuffer.width,
          frameBuffer.height
        )
      );
      this.updateImage(
        "depth",
        BmpEncoder.createGrayscaleBlob(
          frameBuffer.depthDisplay,
          frameBuffer.width,
          frameBuffer.height
        )
      );
      this.updateImage(
        "stencil",
        BmpEncoder.createBinaryBlob(
          frameBuffer.stencil,
          frameBuffer.width,
          frameBuffer.height
        )
      );
      this.updateReadouts(frameBuffer, renderStats, camera, mesh);
    }

    /**
     * Swaps one output image with a freshly generated blob URL.
     *
     * @param {"frame" | "depth" | "stencil"} key
     * @param {Blob} blob
     */
    updateImage(key, blob) {
      const image = this.images[key];
      const previousUrl = this.urls[key];
      const nextUrl = URL.createObjectURL(blob);

      // Keep the previous blob alive until the browser finishes decoding the
      // replacement. Rapid zoom updates can otherwise revoke an in-flight image
      // and momentarily show a blank stencil buffer.
      const finalizeSwap = () => {
        image.removeEventListener("load", finalizeSwap);
        image.removeEventListener("error", finalizeSwap);
        if (previousUrl) {
          URL.revokeObjectURL(previousUrl);
        }
      };

      image.addEventListener("load", finalizeSwap);
      image.addEventListener("error", finalizeSwap);

      this.urls[key] = nextUrl;
      image.src = nextUrl;
    }

    /**
     * Refreshes the descriptive HUD content beside the stage.
     *
     * @param {app.FrameBuffer} frameBuffer
     * @param {{
     *   renderMs: number,
     *   fps: number,
     *   visibleTriangles: number,
     *   totalTriangles: number,
     *   shadingMode: string
     * }} renderStats
     * @param {app.OrbitCamera} camera
     * @param {ReturnType<typeof app.buildMesh>} mesh
     */
    updateReadouts(frameBuffer, renderStats, camera, mesh) {
      const cameraState = camera.getState();

      this.readouts.meshStats.textContent =
        `${mesh.vertexCount} vertices | ${mesh.triangleCount} triangles`;
      this.readouts.cameraAngles.textContent =
        `Azimuth ${cameraState.azimuthDeg.toFixed(1)}° | Elevation ${cameraState.elevationDeg.toFixed(1)}°`;
      this.readouts.cameraDistance.textContent =
        `Distance ${cameraState.distance.toFixed(3)} | FOV ${cameraState.fieldOfViewDeg.toFixed(1)}°`;
      this.readouts.clipPlanes.textContent =
        `Near ${cameraState.nearPlane.toFixed(3)} | Far ${cameraState.farPlane.toFixed(3)}`;
      this.readouts.renderStats.textContent =
        `Render ${renderStats.renderMs.toFixed(2)} ms | Visible ${renderStats.visibleTriangles}/${renderStats.totalTriangles} triangles`;
      this.readouts.fpsMeter.textContent = `FPS ${renderStats.fps.toFixed(1)}`;
      this.readouts.shadingMode.textContent =
        `${renderStats.shadingMode} | camera-locked light`;
      this.readouts.outputStats.textContent =
        `${frameBuffer.width}x${frameBuffer.height} BMP-backed img buffers | no canvas, no WebGL`;
    }

    /**
     * Revokes all active blob URLs managed by the presenter.
     */
    dispose() {
      Object.keys(this.urls).forEach((key) => {
        if (this.urls[key]) {
          URL.revokeObjectURL(this.urls[key]);
          this.urls[key] = "";
        }
      });
    }
  }

  Object.assign(app, { ImagePresenter });
})();
