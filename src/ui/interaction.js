/**
 * Pointer and wheel interaction for orbiting, zooming, and render controls.
 *
 * Keeps the renderer event-driven by scheduling redraws only when the user
 * drags, wheels, presses one of the explicit camera control buttons, or
 * switches the shading model.
 *
 * @author Ilya Tsivilskiy
 * @see InteractionController
 */

(function () {
  const app = window.Procerender;

  /**
   * Event controller for stage drag-orbit and wheel zoom gestures.
   */
  class InteractionController {
    /**
     * @param {{
     *   stageElement: HTMLElement,
     *   camera: app.OrbitCamera,
     *   onChange: () => void,
     *   onShadingChange: (usePhongShading: boolean) => void,
     *   onResolutionChange: (resolution: number) => void,
     *   zoomInButton: HTMLButtonElement | null,
     *   zoomOutButton: HTMLButtonElement | null,
     *   resetButton: HTMLButtonElement | null,
     *   resolutionSelect: HTMLSelectElement,
     *   shadingToggle: HTMLInputElement
     * }} options
     */
    constructor(options) {
      this.stageElement = options.stageElement;
      this.camera = options.camera;
      this.onChange = options.onChange;
      this.onShadingChange = options.onShadingChange;
      this.onResolutionChange = options.onResolutionChange;
      this.zoomInButton = options.zoomInButton;
      this.zoomOutButton = options.zoomOutButton;
      this.resetButton = options.resetButton;
      this.resolutionSelect = options.resolutionSelect;
      this.shadingToggle = options.shadingToggle;
      this.pointerId = null;
      this.lastX = 0;
      this.lastY = 0;
      this.boundPointerDown = this.handlePointerDown.bind(this);
      this.boundPointerMove = this.handlePointerMove.bind(this);
      this.boundPointerUp = this.handlePointerUp.bind(this);
      this.boundLostPointerCapture = this.handleLostPointerCapture.bind(this);
      this.boundWheel = this.handleWheel.bind(this);
      this.boundReset = this.handleReset.bind(this);
      this.boundZoomIn = this.handleZoomIn.bind(this);
      this.boundZoomOut = this.handleZoomOut.bind(this);
      this.boundResolutionChange = this.handleResolutionChange.bind(this);
      this.boundShadingChange = this.handleShadingChange.bind(this);
      this.boundWindowBlur = this.handleWindowBlur.bind(this);
    }

    /**
     * Registers all DOM event listeners.
     */
    attach() {
      this.stageElement.addEventListener("pointerdown", this.boundPointerDown);
      this.stageElement.addEventListener("lostpointercapture", this.boundLostPointerCapture);
      this.stageElement.addEventListener("wheel", this.boundWheel, { passive: false });
      this.stageElement.addEventListener("dblclick", this.boundReset);
      if (this.zoomInButton) {
        this.zoomInButton.addEventListener("click", this.boundZoomIn);
      }
      if (this.zoomOutButton) {
        this.zoomOutButton.addEventListener("click", this.boundZoomOut);
      }
      if (this.resetButton) {
        this.resetButton.addEventListener("click", this.boundReset);
      }
      this.resolutionSelect.addEventListener("change", this.boundResolutionChange);
      this.shadingToggle.addEventListener("change", this.boundShadingChange);
      window.addEventListener("blur", this.boundWindowBlur);
    }

    /**
     * Resizes the raster images to the newly selected square resolution.
     *
     * @param {Event} event
     */
    handleResolutionChange(event) {
      const resolution = Number.parseInt(event.currentTarget.value, 10);
      if (Number.isFinite(resolution) && resolution > 0) {
        this.onResolutionChange(resolution);
      }
    }

    /**
     * Switches between Lambert and Phong shading modes.
     *
     * @param {Event} event
     */
    handleShadingChange(event) {
      this.onShadingChange(Boolean(event.currentTarget.checked));
    }

    /**
     * Begins a drag-orbit gesture.
     *
     * @param {PointerEvent} event
     */
    handlePointerDown(event) {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      this.pointerId = event.pointerId;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.stageElement.classList.add("is-dragging");
      document.body.classList.add("is-orbiting");
      window.addEventListener("pointermove", this.boundPointerMove);
      window.addEventListener("pointerup", this.boundPointerUp);
      window.addEventListener("pointercancel", this.boundPointerUp);

      try {
        this.stageElement.setPointerCapture(event.pointerId);
      } catch (_error) {
        // Window-level listeners keep the drag alive even if capture fails.
      }
    }

    /**
     * Updates the orbit angles during a drag gesture.
     *
     * @param {PointerEvent} event
     */
    handlePointerMove(event) {
      if (this.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();
      const deltaX = event.clientX - this.lastX;
      const deltaY = event.clientY - this.lastY;
      this.lastX = event.clientX;
      this.lastY = event.clientY;

      if (!deltaX && !deltaY) {
        return;
      }

      this.camera.orbit(-deltaX * 0.35, deltaY * 0.35);
      this.onChange();
    }

    /**
     * Ends the current drag gesture.
     *
     * @param {PointerEvent} event
     */
    handlePointerUp(event) {
      if (this.pointerId !== event.pointerId) {
        return;
      }

      this.stopDragging(event.pointerId);
    }

    /**
     * Clears drag state if the browser drops pointer capture unexpectedly.
     *
     * @param {PointerEvent} event
     */
    handleLostPointerCapture(event) {
      if (this.pointerId !== event.pointerId) {
        return;
      }

      this.stopDragging(event.pointerId);
    }

    /**
     * Zooms the orbit camera with the mouse wheel or trackpad gesture.
     *
     * @param {WheelEvent} event
     */
    handleWheel(event) {
      event.preventDefault();
      this.camera.zoomBy(event.deltaY * 0.0012);
      this.onChange();
    }

    /**
     * Cancels the active orbit gesture when the browser window loses focus.
     */
    handleWindowBlur() {
      if (this.pointerId === null) {
        return;
      }

      this.stopDragging(this.pointerId);
    }

    /**
     * Resets the camera to the default view.
     */
    handleReset() {
      this.camera.reset();
      this.onChange();
    }

    /**
     * Applies a discrete zoom-in step.
     */
    handleZoomIn() {
      this.camera.zoomBy(-0.18);
      this.onChange();
    }

    /**
     * Applies a discrete zoom-out step.
     */
    handleZoomOut() {
      this.camera.zoomBy(0.18);
      this.onChange();
    }

    /**
     * Removes active drag listeners and clears the current orbit gesture state.
     *
     * @param {number | null} pointerId
     */
    stopDragging(pointerId) {
      this.pointerId = null;
      this.stageElement.classList.remove("is-dragging");
      document.body.classList.remove("is-orbiting");
      window.removeEventListener("pointermove", this.boundPointerMove);
      window.removeEventListener("pointerup", this.boundPointerUp);
      window.removeEventListener("pointercancel", this.boundPointerUp);

      if (
        pointerId !== null &&
        typeof pointerId !== "undefined" &&
        this.stageElement.hasPointerCapture(pointerId)
      ) {
        this.stageElement.releasePointerCapture(pointerId);
      }
    }
  }

  Object.assign(app, { InteractionController });
})();
