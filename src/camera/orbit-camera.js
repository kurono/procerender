/**
 * Orbit camera used to view the bunny with mouse-driven rotation and zoom.
 *
 * Keeps the camera and light orbiting the mesh together so the relationship
 * center together, the view uses a perspective projection, and the target is
 * always the center of the bunny bounding box.
 *
 * @author Ilya Tsivilskiy
 * @see OrbitCamera
 */

(function () {
  const app = window.Procerender;
  const {
    clamp,
    degToRad,
    addVec3,
    subtractVec3,
    scaleVec3,
    dotVec3,
    crossVec3,
    normalizeVec3,
  } = app;

  /**
   * Spherical orbit camera centered on the mesh bounds center.
   */
  class OrbitCamera {
    /**
     * @param {number[]} target Orbit center in world space.
     * @param {number} sceneRadius Representative scene radius.
     * @param {{
     *   azimuthDeg?: number,
     *   elevationDeg?: number,
     *   distance?: number,
     *   fieldOfViewDeg?: number
     * }} [options]
     */
    constructor(target, sceneRadius, options = {}) {
      this.target = [target[0], target[1], target[2]];
      this.sceneRadius = sceneRadius;
      this.defaultAzimuthDeg = options.azimuthDeg ?? 34;
      this.defaultElevationDeg = options.elevationDeg ?? 18;
      this.defaultDistance = options.distance ?? sceneRadius * 3.9;
      this.azimuthDeg = this.defaultAzimuthDeg;
      this.elevationDeg = this.defaultElevationDeg;
      this.distance = this.defaultDistance;
      this.fieldOfViewDeg = options.fieldOfViewDeg ?? 27;
      this.worldUp = [0, 0, 1];
      this.minDistance = sceneRadius * 1.6;
      this.maxDistance = sceneRadius * 9.5;
      this.nearPlane = 0.01;
      this.farPlane = 1;
      this.updateClipping();
    }

    /**
     * Restores the default orbit angles and zoom distance.
     */
    reset() {
      this.azimuthDeg = this.defaultAzimuthDeg;
      this.elevationDeg = this.defaultElevationDeg;
      this.distance = this.defaultDistance;
      this.updateClipping();
    }

    /**
     * Rotates the camera around the orbit center.
     *
     * @param {number} deltaAzimuthDeg
     * @param {number} deltaElevationDeg
     */
    orbit(deltaAzimuthDeg, deltaElevationDeg) {
      this.azimuthDeg = (this.azimuthDeg + deltaAzimuthDeg + 360) % 360;
      this.elevationDeg = clamp(this.elevationDeg + deltaElevationDeg, -84, 84);
      this.updateClipping();
    }

    /**
     * Scales the camera distance exponentially for smooth wheel zooming.
     *
     * @param {number} delta Positive values zoom out, negative values zoom in.
     */
    zoomBy(delta) {
      const scaledDistance = this.distance * Math.exp(delta);
      this.distance = clamp(scaledDistance, this.minDistance, this.maxDistance);
      this.updateClipping();
    }

    /**
     * Updates the near and far clipping planes from the current zoom state.
     */
    updateClipping() {
      this.nearPlane = Math.max(0.01, this.distance - this.sceneRadius * 2.6);
      this.farPlane = this.distance + this.sceneRadius * 3.8;
    }

    /**
     * Returns the current camera position in world space.
     *
     * @returns {number[]}
     */
    getPosition() {
      const azimuth = degToRad(this.azimuthDeg);
      const elevation = degToRad(this.elevationDeg);

      // Rebuild the camera offset from spherical coordinates around the mesh
      // center. This keeps the view in a simple inspectable orbit instead of
      // storing a free-flying camera transform directly.
      const offset = [
        this.distance * Math.cos(elevation) * Math.cos(azimuth),
        this.distance * Math.cos(elevation) * Math.sin(azimuth),
        this.distance * Math.sin(elevation),
      ];
      return addVec3(this.target, offset);
    }

    /**
     * Returns the current orthonormal view basis and related vectors.
     *
     * @returns {{
     *   position: number[],
     *   backward: number[],
     *   lookDirection: number[],
     *   right: number[],
     *   up: number[]
     * }}
     */
    getBasis() {
      const position = this.getPosition();
      const backward = normalizeVec3(subtractVec3(position, this.target));
      let right = normalizeVec3(crossVec3(this.worldUp, backward));

      if (right[0] === 0 && right[1] === 0 && right[2] === 0) {
        right = [1, 0, 0];
      }

      const up = normalizeVec3(crossVec3(backward, right));
      const lookDirection = scaleVec3(backward, -1);

      return {
        position,
        backward,
        lookDirection,
        right,
        up,
      };
    }

    /**
     * Projects a world-space point into raster coordinates using a cached basis.
     *
     * @param {number[]} point World-space XYZ point.
     * @param {{
     *   position: number[],
     *   backward: number[],
     *   lookDirection: number[],
     *   right: number[],
     *   up: number[]
     * }} basis
     * @param {number} width Raster width in pixels.
     * @param {number} height Raster height in pixels.
     * @returns {{
     *   visible: boolean,
     *   x: number,
     *   y: number,
     *   depth: number,
     *   ndcX: number,
     *   ndcY: number
     * }}
     */
    projectPointFromBasis(point, basis, width, height) {
      const relative = subtractVec3(point, basis.position);
      const camX = dotVec3(relative, basis.right);
      const camY = dotVec3(relative, basis.up);
      const camZ = dotVec3(relative, basis.lookDirection);

      if (camZ <= this.nearPlane || camZ >= this.farPlane) {
        return {
          visible: false,
          x: 0,
          y: 0,
          depth: camZ,
          ndcX: 0,
          ndcY: 0,
        };
      }

      const fieldOfViewX = degToRad(this.fieldOfViewDeg);
      const fieldOfViewY = degToRad(this.fieldOfViewDeg * (height / width));
      const scaleX = 1 / Math.tan(fieldOfViewX * 0.5);
      const scaleY = 1 / Math.tan(fieldOfViewY * 0.5);

      // The point is already expressed in the camera basis, so the projection
      // step is the classic divide-by-z perspective transform followed by a map
      // from normalized device coordinates [-1, 1] into integer raster space.
      const ndcX = (camX * scaleX) / camZ;
      const ndcY = (camY * scaleY) / camZ;
      const rasterX = Math.round((ndcX * 0.5 + 0.5) * (width - 1));
      const rasterY = Math.round((1 - (ndcY * 0.5 + 0.5)) * (height - 1));

      return {
        visible: true,
        x: rasterX,
        y: rasterY,
        depth: camZ,
        ndcX,
        ndcY,
      };
    }

    /**
     * Projects a world-space point into raster coordinates.
     *
     * @param {number[]} point World-space XYZ point.
     * @param {number} width Raster width in pixels.
     * @param {number} height Raster height in pixels.
     * @returns {{
     *   visible: boolean,
     *   x: number,
     *   y: number,
     *   depth: number,
     *   ndcX: number,
     *   ndcY: number
     * }}
     */
    projectPoint(point, width, height) {
      return this.projectPointFromBasis(point, this.getBasis(), width, height);
    }

    /**
     * Returns a plain snapshot of the current camera parameters.
     *
     * @returns {{
     *   azimuthDeg: number,
     *   elevationDeg: number,
     *   distance: number,
     *   fieldOfViewDeg: number,
     *   nearPlane: number,
     *   farPlane: number
     * }}
     */
    getState() {
      return {
        azimuthDeg: this.azimuthDeg,
        elevationDeg: this.elevationDeg,
        distance: this.distance,
        fieldOfViewDeg: this.fieldOfViewDeg,
        nearPlane: this.nearPlane,
        farPlane: this.farPlane,
      };
    }
  }

  Object.assign(app, { OrbitCamera });
})();
