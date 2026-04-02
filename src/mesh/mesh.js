/**
 * Mesh preprocessing utilities for the embedded Stanford Bunny.
 *
 * Converts the flattened source arrays into a render-ready mesh, computes the
 * triangle and vertex normals, and caches the bounding volume used by the
 * orbit camera and clipping setup.
 *
 * @author Ilya Tsivilskiy
 * @see buildMesh
 * @see createStanfordBunnyMesh
 */

(function () {
  const app = window.Procerender;
  const { crossVec3, normalizeVec3, scaleVec3 } = app;

  /**
   * Builds a render-ready mesh object from flat vertex and triangle buffers.
   *
   * @param {Float32Array} vertexPool
   * @param {Uint16Array} triangleIndices
   * @returns {{
   *   vertices: Float32Array,
   *   triangles: Uint16Array,
   *   faceNormals: Float32Array,
   *   vertexNormals: Float32Array,
   *   center: number[],
   *   min: number[],
   *   max: number[],
   *   radius: number,
   *   vertexCount: number,
   *   triangleCount: number
   * }}
   */
  function buildMesh(vertexPool, triangleIndices) {
    const vertices = new Float32Array(vertexPool);
    const triangles = new Uint16Array(triangleIndices);
    const vertexCount = vertices.length / 3;
    const triangleCount = triangles.length / 3;
    const faceNormals = new Float32Array(triangleCount * 3);
    const vertexNormals = new Float32Array(vertexCount * 3);
    const vertexNormalCounts = new Uint16Array(vertexCount);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];

    for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
      const offset = vertexIndex * 3;
      const x = vertices[offset];
      const y = vertices[offset + 1];
      const z = vertices[offset + 2];
      min[0] = Math.min(min[0], x);
      min[1] = Math.min(min[1], y);
      min[2] = Math.min(min[2], z);
      max[0] = Math.max(max[0], x);
      max[1] = Math.max(max[1], y);
      max[2] = Math.max(max[2], z);
    }

    for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
      const triOffset = triangleIndex * 3;
      const i0 = triangles[triOffset];
      const i1 = triangles[triOffset + 1];
      const i2 = triangles[triOffset + 2];
      const v0 = [
        vertices[i0 * 3],
        vertices[i0 * 3 + 1],
        vertices[i0 * 3 + 2],
      ];
      const v1 = [
        vertices[i1 * 3],
        vertices[i1 * 3 + 1],
        vertices[i1 * 3 + 2],
      ];
      const v2 = [
        vertices[i2 * 3],
        vertices[i2 * 3 + 1],
        vertices[i2 * 3 + 2],
      ];
      const edgeA = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
      const edgeB = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];
      const normal = normalizeVec3(scaleVec3(crossVec3(edgeA, edgeB), -1));

      // Each face normal contributes to all three incident vertices. Averaging
      // those contributions produces a smooth per-vertex normal field used by
      // the Lambert and Phong lighting models during rasterization.

      faceNormals[triOffset] = normal[0];
      faceNormals[triOffset + 1] = normal[1];
      faceNormals[triOffset + 2] = normal[2];

      vertexNormals[i0 * 3] += normal[0];
      vertexNormals[i0 * 3 + 1] += normal[1];
      vertexNormals[i0 * 3 + 2] += normal[2];
      vertexNormals[i1 * 3] += normal[0];
      vertexNormals[i1 * 3 + 1] += normal[1];
      vertexNormals[i1 * 3 + 2] += normal[2];
      vertexNormals[i2 * 3] += normal[0];
      vertexNormals[i2 * 3 + 1] += normal[1];
      vertexNormals[i2 * 3 + 2] += normal[2];

      vertexNormalCounts[i0] += 1;
      vertexNormalCounts[i1] += 1;
      vertexNormalCounts[i2] += 1;
    }

    for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
      const count = vertexNormalCounts[vertexIndex] || 1;
      const offset = vertexIndex * 3;
      vertexNormals[offset] /= count;
      vertexNormals[offset + 1] /= count;
      vertexNormals[offset + 2] /= count;
    }

    const center = [
      (min[0] + max[0]) * 0.5,
      (min[1] + max[1]) * 0.5,
      (min[2] + max[2]) * 0.5,
    ];

    let radius = 0;
    for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
      const offset = vertexIndex * 3;
      const dx = vertices[offset] - center[0];
      const dy = vertices[offset + 1] - center[1];
      const dz = vertices[offset + 2] - center[2];
      radius = Math.max(radius, Math.hypot(dx, dy, dz));
    }

    return {
      vertices,
      triangles,
      faceNormals,
      vertexNormals,
      center,
      min,
      max,
      radius,
      vertexCount,
      triangleCount,
    };
  }

  /**
   * Creates the render mesh for the bundled Stanford Bunny data set.
   *
   * @returns {ReturnType<typeof buildMesh>}
   */
  function createStanfordBunnyMesh() {
    return buildMesh(app.bunnyVertices, app.bunnyTriangles);
  }

  Object.assign(app, {
    buildMesh,
    createStanfordBunnyMesh,
  });
})();
