/**
 * Application composition, render scheduling, and startup flow.
 *
 * Instantiates the mesh, camera, rasterizer, presenter, and interaction
 * controller, then drives Procerender through demand-based
 * `requestAnimationFrame` renders whenever camera state changes.
 *
 * @author Ilya Tsivilskiy
 * @see RasterizerApp
 */

(function () {
  const app = window.Procerender;
  const {
    controls,
    images,
    readouts,
    stage,
    state,
    createStanfordBunnyMesh,
    OrbitCamera,
    FrameBuffer,
    SoftwareRasterizer,
    ImagePresenter,
    InteractionController,
  } = app;

  /**
   * End-to-end application controller for the browser rasterizer demo.
   */
  class RasterizerApp {
    /**
     * Creates the renderer pipeline and the interactive camera.
     */
    constructor() {
      this.mesh = createStanfordBunnyMesh();
      this.camera = new OrbitCamera(this.mesh.center, this.mesh.radius);
      this.frameBuffer = new FrameBuffer(state.renderWidth, state.renderHeight);
      this.rasterizer = new SoftwareRasterizer(this.mesh, this.frameBuffer);
      this.presenter = new ImagePresenter({ images, readouts });
      this.interaction = new InteractionController({
        stageElement: stage.viewport,
        camera: this.camera,
        onChange: this.scheduleRender.bind(this),
        onShadingChange: this.handleShadingChange.bind(this),
        onResolutionChange: this.handleResolutionChange.bind(this),
        zoomInButton: controls.zoomIn,
        zoomOutButton: controls.zoomOut,
        resetButton: controls.resetView,
        resolutionSelect: controls.resolutionSelect,
        shadingToggle: controls.usePhongShading,
      });
      this.boundRender = this.render.bind(this);
      this.lastRenderStartedAt = 0;
      this.smoothedFps = 0;
    }

    /**
     * Wires the remaining UI events and performs the first render.
     */
    initialize() {
      controls.usePhongShading.checked = state.usePhongShading;
      controls.resolutionSelect.value = String(state.renderWidth);
      this.interaction.attach();
      this.scheduleRender();
    }

    /**
     * Updates the selected shading model and schedules a fresh render.
     *
     * @param {boolean} usePhongShading
     */
    handleShadingChange(usePhongShading) {
      state.usePhongShading = usePhongShading;
      this.scheduleRender();
    }

    /**
     * Resizes the square output buffers and schedules a fresh render.
     *
     * @param {number} resolution
     */
    handleResolutionChange(resolution) {
      if (
        resolution === state.renderWidth &&
        resolution === state.renderHeight
      ) {
        return;
      }

      state.renderWidth = resolution;
      state.renderHeight = resolution;
      this.frameBuffer.resize(resolution, resolution);
      this.scheduleRender();
    }

    /**
     * Queues one animation-frame render if none is already pending.
     */
    scheduleRender() {
      if (state.pendingRender) {
        return;
      }

      state.pendingRender = true;
      requestAnimationFrame(this.boundRender);
    }

    /**
     * Renders the current camera view into the three raster outputs.
     */
    render() {
      const renderStartedAt = performance.now();
      state.pendingRender = false;
      state.renderCount += 1;

      const renderStats = this.rasterizer.render(this.camera, {
        usePhongShading: state.usePhongShading,
      });
      renderStats.fps = this.measureFps(renderStartedAt, renderStats.renderMs);
      this.presenter.present(this.frameBuffer, renderStats, this.camera, this.mesh);
    }

    /**
     * Estimates the recent render cadence for the on-page FPS meter.
     *
     * Because the app renders on demand rather than in a permanent loop, the
     * meter tracks recent render-to-render cadence and smooths it slightly so
     * the value remains readable while dragging or wheel zooming.
     *
     * @param {number} renderStartedAt
     * @param {number} renderMs
     * @returns {number}
     */
    measureFps(renderStartedAt, renderMs) {
      const instantaneousFps = this.lastRenderStartedAt
        ? 1000 / Math.max(renderStartedAt - this.lastRenderStartedAt, 1)
        : 1000 / Math.max(renderMs, 1);

      this.lastRenderStartedAt = renderStartedAt;
      this.smoothedFps = this.smoothedFps
        ? this.smoothedFps * 0.72 + instantaneousFps * 0.28
        : instantaneousFps;

      return this.smoothedFps;
    }
  }

  const rasterizerApp = new RasterizerApp();
  rasterizerApp.initialize();

  Object.assign(app, { rasterizerApp });
})();
