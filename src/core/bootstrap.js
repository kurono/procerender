/**
 * Browser bootstrap, DOM lookup, and shared application state.
 *
 * Initializes the Procerender namespace, captures the relevant DOM nodes,
 * and seeds the mutable state shared across the pure-browser rasterizer.
 *
 * @author Ilya Tsivilskiy
 * @see window.Procerender
 * @see controls
 * @see state
 */

(function () {
  const app = (window.Procerender = window.Procerender || {});
  window.BunnyRasterizer = app;

  /** Cached action controls. */
  const controls = {
    zoomIn: document.getElementById("zoomIn"),
    zoomOut: document.getElementById("zoomOut"),
    resetView: document.getElementById("resetView"),
    resolutionSelect: document.getElementById("resolutionSelect"),
    usePhongShading: document.getElementById("usePhongShading"),
  };

  /** Raster output `<img>` elements. */
  const images = {
    frame: document.getElementById("frameImage"),
    depth: document.getElementById("depthImage"),
    stencil: document.getElementById("stencilImage"),
  };

  /** Readouts shown in the information panel. */
  const readouts = {
    meshStats: document.getElementById("meshStats"),
    cameraAngles: document.getElementById("cameraAngles"),
    cameraDistance: document.getElementById("cameraDistance"),
    clipPlanes: document.getElementById("clipPlanes"),
    renderStats: document.getElementById("renderStats"),
    fpsMeter: document.getElementById("fpsMeter"),
    shadingMode: document.getElementById("shadingMode"),
    outputStats: document.getElementById("outputStats"),
  };

  /** Stage elements used for pointer interaction and hover state. */
  const stage = {
    viewport: document.getElementById("stageViewport"),
  };

  /** Shared mutable state for render scheduling and presentation bookkeeping. */
  const state = {
    renderWidth: 320,
    renderHeight: 320,
    pendingRender: false,
    renderCount: 0,
    usePhongShading: true,
  };

  Object.assign(app, {
    controls,
    images,
    readouts,
    stage,
    state,
  });
})();
