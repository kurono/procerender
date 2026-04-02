/**
 * Lightweight scalar and 3D vector helpers used across the rasterizer.
 *
 * Provides the small math toolkit needed by the mesh preprocessing, orbit
 * camera, and software rasterization stages without any external dependency.
 *
 * @author Ilya Tsivilskiy
 * @see clamp
 * @see crossVec3
 * @see normalizeVec3
 */

(function () {
  const app = window.Procerender;

  /**
   * Clamps a scalar to the inclusive range `[min, max]`.
   *
   * @param {number} value
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Linearly interpolates between two scalars.
   *
   * @param {number} start
   * @param {number} end
   * @param {number} t
   * @returns {number}
   */
  function lerp(start, end, t) {
    return start + (end - start) * t;
  }

  /**
   * Converts degrees to radians.
   *
   * @param {number} degrees
   * @returns {number}
   */
  function degToRad(degrees) {
    return (degrees * Math.PI) / 180;
  }

  /**
   * Converts radians to degrees.
   *
   * @param {number} radians
   * @returns {number}
   */
  function radToDeg(radians) {
    return (radians * 180) / Math.PI;
  }

  /**
   * Adds two 3D vectors.
   *
   * @param {number[]} a
   * @param {number[]} b
   * @returns {number[]}
   */
  function addVec3(a, b) {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  }

  /**
   * Subtracts vector `b` from vector `a`.
   *
   * @param {number[]} a
   * @param {number[]} b
   * @returns {number[]}
   */
  function subtractVec3(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  }

  /**
   * Scales a 3D vector by a scalar.
   *
   * @param {number[]} vector
   * @param {number} scalar
   * @returns {number[]}
   */
  function scaleVec3(vector, scalar) {
    return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
  }

  /**
   * Computes the dot product of two 3D vectors.
   *
   * @param {number[]} a
   * @param {number[]} b
   * @returns {number}
   */
  function dotVec3(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  /**
   * Computes the cross product of two 3D vectors.
   *
   * @param {number[]} a
   * @param {number[]} b
   * @returns {number[]}
   */
  function crossVec3(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  }

  /**
   * Computes the Euclidean length of a 3D vector.
   *
   * @param {number[]} vector
   * @returns {number}
   */
  function lengthVec3(vector) {
    return Math.hypot(vector[0], vector[1], vector[2]);
  }

  /**
   * Normalizes a 3D vector and returns a copy.
   *
   * Returns `[0, 0, 0]` for a zero-length vector.
   *
   * @param {number[]} vector
   * @returns {number[]}
   */
  function normalizeVec3(vector) {
    const length = lengthVec3(vector);
    if (!length) {
      return [0, 0, 0];
    }

    return [vector[0] / length, vector[1] / length, vector[2] / length];
  }

  Object.assign(app, {
    clamp,
    lerp,
    degToRad,
    radToDeg,
    addVec3,
    subtractVec3,
    scaleVec3,
    dotVec3,
    crossVec3,
    lengthVec3,
    normalizeVec3,
  });
})();
