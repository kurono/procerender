/**
 * CPU software rasterizer for the Procerender bunny renderer.
 *
 * Performs perspective projection, back-face culling, depth-tested triangle
 * rasterization, Lambert or Phong shading, and the derived stencil and
 * depth-buffer outputs used by Procerender.
 *
 * @author Ilya Tsivilskiy
 * @see SoftwareRasterizer
 * @see edgeFunction
 */

(function () {
  const app = window.Procerender;
  const { clamp } = app;

  /**
   * Returns the oriented edge function value for a 2D triangle edge.
   *
   * @param {number} ax
   * @param {number} ay
   * @param {number} bx
   * @param {number} by
   * @param {number} px
   * @param {number} py
   * @returns {number}
   */
  function edgeFunction(ax, ay, bx, by, px, py) {
    return (px - ax) * (by - ay) - (py - ay) * (bx - ax);
  }

  /**
   * Software triangle rasterizer for the Stanford Bunny scene.
   */
  class SoftwareRasterizer {
    /**
     * @param {ReturnType<typeof app.buildMesh>} mesh
     * @param {app.FrameBuffer} frameBuffer
     * @param {{
     *   lambertAmbient?: number,
     *   lambertDiffuse?: number,
     *   phongAmbient?: number,
     *   phongDiffuse?: number,
     *   phongSpecular?: number,
     *   phongShininess?: number
     * }} [options]
     */
    constructor(mesh, frameBuffer, options = {}) {
      this.mesh = mesh;
      this.frameBuffer = frameBuffer;
      this.lambertAmbient = options.lambertAmbient ?? 0.14;
      this.lambertDiffuse = options.lambertDiffuse ?? 0.74;
      this.phongAmbient = options.phongAmbient ?? 0.12;
      this.phongDiffuse = options.phongDiffuse ?? 0.56;
      this.phongSpecular = options.phongSpecular ?? 0.28;
      this.phongShininess = options.phongShininess ?? 18;
      this.projectedVertices = new Float32Array(mesh.vertexCount * 3);
      this.projectedVisible = new Uint8Array(mesh.vertexCount);
    }

    /**
     * Renders the complete frame, depth, and stencil buffers for the camera.
     *
     * @param {app.OrbitCamera} camera
     * @param {{ usePhongShading?: boolean }} [options]
     * @returns {{
     *   renderMs: number,
     *   visibleTriangles: number,
     *   totalTriangles: number,
     *   shadingMode: string
     * }}
     */
    render(camera, options = {}) {
      const startedAt = performance.now();
      const basis = camera.getBasis();
      const usePhongShading = Boolean(options.usePhongShading);

      this.frameBuffer.clear(camera.farPlane);
      this.projectVertices(camera, basis);
      const visibleTriangles = this.rasterizeVisibleTriangles(
        basis.lookDirection,
        usePhongShading
      );
      this.frameBuffer.deriveDepthAndStencil(camera.farPlane);
      this.frameBuffer.copyFrameToResolved();

      return {
        renderMs: performance.now() - startedAt,
        visibleTriangles,
        totalTriangles: this.mesh.triangleCount,
        shadingMode: usePhongShading ? "Phong" : "Lambert",
      };
    }

    /**
     * Evaluates the Lambert diffuse model in grayscale.
     *
     * @param {number} diffuse
     * @returns {number}
     */
    shadeLambert(diffuse) {
      return clamp(this.lambertAmbient + this.lambertDiffuse * diffuse, 0, 1);
    }

    /**
     * Evaluates a grayscale Phong model with camera-locked light and view.
     *
     * @param {number[]} normal
     * @param {number[]} lightDirection
     * @param {number} diffuse
     * @returns {number}
     */
    shadePhong(normal, lightDirection, diffuse) {
      if (diffuse <= 0) {
        return clamp(this.phongAmbient, 0, 1);
      }

      const twiceDiffuse = 2 * diffuse;
      const reflectionX = twiceDiffuse * normal[0] - lightDirection[0];
      const reflectionY = twiceDiffuse * normal[1] - lightDirection[1];
      const reflectionZ = twiceDiffuse * normal[2] - lightDirection[2];
      const reflectionDotView = Math.max(
        0,
        reflectionX * lightDirection[0] +
          reflectionY * lightDirection[1] +
          reflectionZ * lightDirection[2]
      );
      const specular = reflectionDotView ** this.phongShininess;

      return clamp(
        this.phongAmbient +
          this.phongDiffuse * diffuse +
          this.phongSpecular * specular,
        0,
        1
      );
    }

    /**
     * Projects every mesh vertex into raster coordinates for the current frame.
     *
     * @param {app.OrbitCamera} camera
     * @param {{
     *   position: number[],
     *   backward: number[],
     *   lookDirection: number[],
     *   right: number[],
     *   up: number[]
     * }} basis
     */
    projectVertices(camera, basis) {
      const width = this.frameBuffer.width;
      const height = this.frameBuffer.height;
      const vertices = this.mesh.vertices;

      for (let vertexIndex = 0; vertexIndex < this.mesh.vertexCount; vertexIndex += 1) {
        const vertexOffset = vertexIndex * 3;
        const projectedOffset = vertexIndex * 3;
        const point = [
          vertices[vertexOffset],
          vertices[vertexOffset + 1],
          vertices[vertexOffset + 2],
        ];
        const projection = camera.projectPointFromBasis(point, basis, width, height);

        this.projectedVisible[vertexIndex] = projection.visible ? 1 : 0;
        this.projectedVertices[projectedOffset] = projection.x;
        this.projectedVertices[projectedOffset + 1] = projection.y;
        this.projectedVertices[projectedOffset + 2] = projection.depth;
      }
    }

    /**
     * Rasterizes all back-face-culled triangles of the mesh.
     *
     * @param {number[]} lookDirection
     * @param {boolean} usePhongShading
     * @returns {number}
     */
    rasterizeVisibleTriangles(lookDirection, usePhongShading) {
      const triangles = this.mesh.triangles;
      const faceNormals = this.mesh.faceNormals;
      let visibleTriangles = 0;

      for (let triangleIndex = 0; triangleIndex < this.mesh.triangleCount; triangleIndex += 1) {
        const triOffset = triangleIndex * 3;
        const dot =
          faceNormals[triOffset] * lookDirection[0] +
          faceNormals[triOffset + 1] * lookDirection[1] +
          faceNormals[triOffset + 2] * lookDirection[2];

        if (dot <= 1e-4) {
          continue;
        }

        const i0 = triangles[triOffset];
        const i1 = triangles[triOffset + 1];
        const i2 = triangles[triOffset + 2];

        if (!this.projectedVisible[i0] || !this.projectedVisible[i1] || !this.projectedVisible[i2]) {
          continue;
        }

        if (this.rasterizeTriangle(i0, i1, i2, lookDirection, usePhongShading)) {
          visibleTriangles += 1;
        }
      }

      return visibleTriangles;
    }

    /**
     * Rasterizes one projected triangle into the frame and depth buffers.
     *
     * @param {number} i0
     * @param {number} i1
     * @param {number} i2
     * @param {number[]} lightDirection
     * @param {boolean} usePhongShading
     * @returns {boolean}
     */
    rasterizeTriangle(i0, i1, i2, lightDirection, usePhongShading) {
      const width = this.frameBuffer.width;
      const height = this.frameBuffer.height;
      const projected = this.projectedVertices;
      const normals = this.mesh.vertexNormals;

      const offset0 = i0 * 3;
      const offset1 = i1 * 3;
      const offset2 = i2 * 3;

      const x0 = projected[offset0];
      const y0 = projected[offset0 + 1];
      const z0 = projected[offset0 + 2];
      const x1 = projected[offset1];
      const y1 = projected[offset1 + 1];
      const z1 = projected[offset1 + 2];
      const x2 = projected[offset2];
      const y2 = projected[offset2 + 1];
      const z2 = projected[offset2 + 2];

      const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2) - 1));
      const maxX = Math.min(width - 1, Math.ceil(Math.max(x0, x1, x2) + 1));
      const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2) - 1));
      const maxY = Math.min(height - 1, Math.ceil(Math.max(y0, y1, y2) + 1));
      const area = edgeFunction(x0, y0, x1, y1, x2, y2);

      if (!Number.isFinite(area) || Math.abs(area) <= 1e-8) {
        return false;
      }

      const inverseZ0 = 1 / z0;
      const inverseZ1 = 1 / z1;
      const inverseZ2 = 1 / z2;
      let touched = false;

      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const sampleX = x + 0.5;
          const sampleY = y + 0.5;

          // Barycentric coordinates tell us how much of the full triangle area
          // belongs to each sub-triangle that contains the sample point p:
          //
          // w0 = A(p, v1, v2) / A(v0, v1, v2)
          // w1 = A(v0, p, v2) / A(v0, v1, v2)
          // w2 = A(v0, v1, p) / A(v0, v1, v2)
          //
          //        v1
          //       /\
          //      /  \
          //     / p  \
          //    /      \
          //   v0------v2
          const w0 = edgeFunction(x1, y1, x2, y2, sampleX, sampleY);
          const w1 = edgeFunction(x2, y2, x0, y0, sampleX, sampleY);
          const w2 = edgeFunction(x0, y0, x1, y1, sampleX, sampleY);
          const hasNegative = w0 < 0 || w1 < 0 || w2 < 0;
          const hasPositive = w0 > 0 || w1 > 0 || w2 > 0;

          if (hasNegative && hasPositive) {
            continue;
          }

          const bary0 = w0 / area;
          const bary1 = w1 / area;
          const bary2 = w2 / area;

          // Perspective projection preserves straight lines but not linear
          // distances, so depth and any interpolated vertex attribute must use
          // reciprocal-depth weighting before being renormalized.
          const inverseDepth =
            bary0 * inverseZ0 + bary1 * inverseZ1 + bary2 * inverseZ2;

          if (inverseDepth <= 0) {
            continue;
          }

          const depth = 1 / inverseDepth;
          const index = this.frameBuffer.index(x, y);

          if (depth >= this.frameBuffer.depth[index]) {
            continue;
          }

          const depthWeight0 = bary0 * inverseZ0 * depth;
          const depthWeight1 = bary1 * inverseZ1 * depth;
          const depthWeight2 = bary2 * inverseZ2 * depth;

          const normal = [
            depthWeight0 * normals[offset0] +
              depthWeight1 * normals[offset1] +
              depthWeight2 * normals[offset2],
            depthWeight0 * normals[offset0 + 1] +
              depthWeight1 * normals[offset1 + 1] +
              depthWeight2 * normals[offset2 + 1],
            depthWeight0 * normals[offset0 + 2] +
              depthWeight1 * normals[offset1 + 2] +
              depthWeight2 * normals[offset2 + 2],
          ];
          const normalLength = Math.hypot(normal[0], normal[1], normal[2]);
          if (normalLength <= 1e-8) {
            continue;
          }

          normal[0] /= normalLength;
          normal[1] /= normalLength;
          normal[2] /= normalLength;

          const diffuse = Math.max(
            0,
            normal[0] * lightDirection[0] +
              normal[1] * lightDirection[1] +
              normal[2] * lightDirection[2]
          );
          const intensity = usePhongShading
            ? this.shadePhong(normal, lightDirection, diffuse)
            : this.shadeLambert(diffuse);

          this.frameBuffer.depth[index] = depth;
          this.frameBuffer.frame[index] = intensity;
          touched = true;
        }
      }

      return touched;
    }
  }

  Object.assign(app, {
    edgeFunction,
    SoftwareRasterizer,
  });
})();
