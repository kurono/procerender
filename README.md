# Procerender

**Author:** Ilya Tsivilskiy

**License:** All rights reserved

![Bunny animation](assets/bunny_anim.gif)

Procerender stands for processor-side rendering. It is a serverless browser study of the 3D rasterization pipeline written in plain HTML, CSS, and vanilla JavaScript. The page uses no `<canvas>`, no WebGL, and no browser graphics API draw calls for the render itself; instead, it computes pixels on the CPU and shows the results as generated BMP files inside ordinary `<img>` elements. The purpose of the app is educational: it exists to explain the principles of 3D rendering in a direct, inspectable way.

The app lets you:

- orbit and zoom around the Stanford Bunny with a mouse-driven camera,
- compare the frame, depth, and stencil buffers side by side,
- switch between Lambert and Phong shading with a checkbox,
- inspect a modular JavaScript implementation that mirrors the major stages of a classical software rasterizer.

## Running It

No build step and no backend are required.

1. Open [index.html](index.html) directly in a browser.
2. Drag the large framebuffer image to orbit the camera around the mesh.
3. Use the mouse wheel or the `Zoom In` and `Zoom Out` buttons to change camera distance.
4. Double-click the stage or press `Reset View` to restore the default view.
5. Toggle `Enable Phong shading` to compare Lambert and Phong illumination on the same geometry.

Because the mesh is embedded as JavaScript data, the app does not use `fetch()` and does not require a local HTTP server.

## What Makes Procerender Different

Procerender deliberately avoids the normal browser graphics stack for the final draw:

- no `<canvas>`,
- no WebGL,
- no GPU rasterizer,
- no shader programs,
- no image downloaded from a server.

Instead, the app:

1. computes projection, culling, depth testing, and shading on the CPU,
2. stores the intermediate images in typed arrays,
3. encodes those arrays into BMP byte streams,
4. assigns the resulting object URLs to ordinary `<img>` tags.

That design makes the renderer useful as a teaching artifact. Every important stage is visible in JavaScript rather than hidden inside a graphics API.

## Source File Structure

The browser code is loaded through classic `<script>` tags in [index.html](index.html). Each file extends the shared `window.Procerender` namespace.

```text
src/
  app/
    main.js                  app wiring and demand-driven rendering
  camera/
    orbit-camera.js          orbit camera, basis construction, and projection
  core/
    bootstrap.js             DOM lookup and shared mutable state
  data/
    stanford-bunny.js        embedded vertex and triangle data
  math/
    linear-algebra.js        scalar and 3D vector helpers
  mesh/
    mesh.js                  mesh preprocessing and normal generation
  render/
    bmp-encoder.js           BMP export for plain <img> presentation
    framebuffer.js           frame, depth, and stencil storage
    software-rasterizer.js   triangle rasterization and shading
  ui/
    interaction.js           orbit, zoom, reset, and shading toggle events
    presenter.js             image swapping and HUD text updates
```

The main entry points worth reading first are:

- [src/app/main.js](src/app/main.js): `RasterizerApp.initialize()` and `RasterizerApp.render()`
- [src/render/software-rasterizer.js](src/render/software-rasterizer.js): `SoftwareRasterizer.render()` and `SoftwareRasterizer.rasterizeTriangle()`
- [src/camera/orbit-camera.js](src/camera/orbit-camera.js): `OrbitCamera.getBasis()` and `OrbitCamera.projectPointFromBasis()`
- [src/render/framebuffer.js](src/render/framebuffer.js): `FrameBuffer.deriveDepthAndStencil()`
- [src/render/bmp-encoder.js](src/render/bmp-encoder.js): `BmpEncoder.createRgbBlob()`
- [src/ui/presenter.js](src/ui/presenter.js): `ImagePresenter.updateImage()`

## Rendering Pipeline

### 1. Mesh Preparation

The original geometry comes from the source STL asset bundled with the repository. For direct browser use, the vertex pool and triangle index list are embedded in [src/data/stanford-bunny.js](src/data/stanford-bunny.js), then processed by `buildMesh()` and `createStanfordBunnyMesh()` in [src/mesh/mesh.js](src/mesh/mesh.js).

For each triangle with vertices $\mathbf{v}_0$, $\mathbf{v}_1$, and $\mathbf{v}_2$, the face normal is computed as

$$
\mathbf{n}_f = \mathrm{normalize}\!\left((\mathbf{v}_1 - \mathbf{v}_0) \times (\mathbf{v}_2 - \mathbf{v}_0)\right).
$$

Each face normal contributes to its three incident vertices, and the averaged vertex normal becomes

$$
\mathbf{n}_i = \mathrm{normalize}\!\left(\frac{1}{m_i}\sum_{f \in \mathcal{N}(i)} \mathbf{n}_f\right),
$$

where $m_i$ is the number of incident faces of vertex $i$.

The same mesh preprocessing step also computes:

- the axis-aligned bounding box,
- the bounding-box center,
- a bounding radius used to place the orbit camera.

### 2. Orbit Camera

The camera is defined in [src/camera/orbit-camera.js](src/camera/orbit-camera.js). The key methods are `OrbitCamera.getPosition()`, `OrbitCamera.getBasis()`, and `OrbitCamera.projectPointFromBasis()`.

If $\mathbf{t}$ is the orbit target, $r$ is the camera distance, $\phi$ is the azimuth, and $\theta$ is the elevation, then the camera position is

$$
\mathbf{p}_{cam} =
\mathbf{t} +
\begin{bmatrix}
r \cos(\theta)\cos(\phi) \\
r \cos(\theta)\sin(\phi) \\
r \sin(\theta)
\end{bmatrix}.
$$

From there, the code builds an orthonormal camera basis:

$$
\mathbf{b} = \mathrm{normalize}(\mathbf{p}_{cam} - \mathbf{t}),
$$

$$
\mathbf{r} = \mathrm{normalize}(\mathbf{u}_{world} \times \mathbf{b}),
$$

$$
\mathbf{u} = \mathrm{normalize}(\mathbf{b} \times \mathbf{r}),
$$

where $\mathbf{b}$ is the backward direction, $\mathbf{r}$ is the right direction, and $\mathbf{u}$ is the corrected up direction.

The light source is intentionally locked to the same orbit. That makes the connection between view direction and lighting easy to see.

### 3. Perspective Projection

After subtracting the camera position, each world-space point is expressed in the camera basis:

$$
x_c = (\mathbf{p} - \mathbf{p}_{cam}) \cdot \mathbf{r},
\qquad
y_c = (\mathbf{p} - \mathbf{p}_{cam}) \cdot \mathbf{u},
\qquad
z_c = (\mathbf{p} - \mathbf{p}_{cam}) \cdot \mathbf{l},
$$

where $\mathbf{l}$ is the look direction.

The perspective scale factors are

$$
s_x = \frac{1}{\tan(\mathrm{fov}_x / 2)},
\qquad
s_y = \frac{1}{\tan(\mathrm{fov}_y / 2)}.
$$

The normalized device coordinates become

$$
x_{ndc} = \frac{s_x x_c}{z_c},
\qquad
y_{ndc} = \frac{s_y y_c}{z_c}.
$$

Finally, the code maps $[-1, 1]$ NDC into integer raster coordinates. This happens inside `OrbitCamera.projectPointFromBasis()`.

### 4. Back-Face Culling

Before a triangle is rasterized, its face normal is tested against the current look direction inside `SoftwareRasterizer.rasterizeVisibleTriangles()` in [src/render/software-rasterizer.js](src/render/software-rasterizer.js).

A triangle is kept only when

$$
\mathbf{n}_{face} \cdot \mathbf{l} > \varepsilon,
$$

with a small tolerance $\varepsilon$.

This removes triangles facing away from the viewer and reduces the amount of raster work.

### 5. Rasterization With Barycentric Coordinates

The core pixel loop lives in `SoftwareRasterizer.rasterizeTriangle()`.

For a sample point $\mathbf{p}$ inside the projected triangle $(\mathbf{v}_0, \mathbf{v}_1, \mathbf{v}_2)$, the barycentric coordinates are

$$
\lambda_0 = \frac{A(\mathbf{p}, \mathbf{v}_1, \mathbf{v}_2)}{A(\mathbf{v}_0, \mathbf{v}_1, \mathbf{v}_2)},
\qquad
\lambda_1 = \frac{A(\mathbf{v}_0, \mathbf{p}, \mathbf{v}_2)}{A(\mathbf{v}_0, \mathbf{v}_1, \mathbf{v}_2)},
\qquad
\lambda_2 = \frac{A(\mathbf{v}_0, \mathbf{v}_1, \mathbf{p})}{A(\mathbf{v}_0, \mathbf{v}_1, \mathbf{v}_2)}.
$$

In the implementation, these areas are evaluated with oriented edge functions rather than explicit triangle-area square roots. The geometric meaning is the same.

Because the triangle has already been perspective-projected, attributes must be interpolated with reciprocal depth. The interpolated depth is

$$
z = \frac{1}{\lambda_0 / z_0 + \lambda_1 / z_1 + \lambda_2 / z_2}.
$$

The perspective-correct attribute weights are

$$
\hat{\lambda}_i =
\frac{\lambda_i / z_i}{\lambda_0 / z_0 + \lambda_1 / z_1 + \lambda_2 / z_2}.
$$

These corrected weights are used to interpolate the vertex normals before shading each sample.

### 6. Lambert and Phong Shading

The shading switch is handled in `RasterizerApp.handleShadingChange()` in [src/app/main.js](src/app/main.js), while the actual lighting equations are implemented by `SoftwareRasterizer.shadeLambert()` and `SoftwareRasterizer.shadePhong()` in [src/render/software-rasterizer.js](src/render/software-rasterizer.js).

When the checkbox is unchecked, the app uses Lambert shading:

$$
I_{Lambert} = \mathrm{clamp}\!\left(k_a + k_d \max(0, \mathbf{n} \cdot \mathbf{l}), 0, 1\right).
$$

Here:

- $\mathbf{n}$ is the perspective-correct interpolated unit normal,
- $\mathbf{l}$ is the camera-locked light direction,
- $k_a$ is the ambient term,
- $k_d$ is the diffuse coefficient.

When the checkbox is checked, the app uses a Phong model:

$$
\mathbf{r} = 2(\mathbf{n} \cdot \mathbf{l})\mathbf{n} - \mathbf{l},
$$

$$
I_{Phong} =
\mathrm{clamp}\!\left(
k_a +
k_d \max(0, \mathbf{n} \cdot \mathbf{l}) +
k_s \max(0, \mathbf{r} \cdot \mathbf{v})^s,
0,
1
\right).
$$

Because the light follows the camera in this app, the view direction $\mathbf{v}$ is intentionally close to the light direction $\mathbf{l}$. This makes the specular behavior easy to interpret: when the surface normal reflects the light back toward the camera, a highlight appears.

The renderer is grayscale on purpose. It isolates the geometry, interpolation, and illumination mathematics instead of mixing them with texture mapping or RGB material systems.

### 7. Depth Buffer and Stencil Buffer

The buffer storage is defined by `FrameBuffer` in [src/render/framebuffer.js](src/render/framebuffer.js).

For each raster sample, the renderer performs a z-test. A new sample is accepted only if its depth is smaller than the current stored depth.

The display depth image is a normalized inversion of camera-space depth:

$$
D_{display} = \frac{z_{far} - z}{z_{far}}.
$$

Pixels that were never written keep the clear value $z_{far}$ and therefore map to zero.

The stencil image is derived from depth occupancy rather than from a separate stencil-test pipeline:

$$
S(x, y) =
\begin{cases}
1, & z(x, y) < z_{far}, \\
0, & z(x, y) = z_{far}.
\end{cases}
$$

This logic lives in `FrameBuffer.deriveDepthAndStencil()`.

### 8. Exporting the Buffers Without Canvas

The exported images are created in [src/render/bmp-encoder.js](src/render/bmp-encoder.js) by `BmpEncoder.createGrayscaleBlob()`, `BmpEncoder.createBinaryBlob()`, and `BmpEncoder.createRgbBlob()`.

The app uses BMP because it is simple to encode manually:

- a fixed file header,
- a fixed info header,
- uncompressed 24-bit rows,
- predictable row padding to 4-byte alignment.

The presenter in [src/ui/presenter.js](src/ui/presenter.js) then calls `ImagePresenter.updateImage()` to swap the `<img>` sources. The presenter keeps the previous blob URL alive until the browser finishes decoding the replacement, which prevents rapid zoom interactions from blanking the stencil image mid-swap.

### 9. Interaction and Demand-Driven Rendering

The event handlers live in [src/ui/interaction.js](src/ui/interaction.js):

- `handlePointerMove()` updates azimuth and elevation,
- `handleWheel()` changes camera distance,
- `handleReset()` restores the default orbit,
- `handleShadingChange()` switches between Lambert and Phong shading.

The app does not run a continuous animation loop. Instead, `RasterizerApp.scheduleRender()` in [src/app/main.js](src/app/main.js) requests a new frame only when the camera or shading mode changes. That keeps the demo lightweight while preserving immediate feedback.

### 10. Why This App Is Useful for Learning 3D Rendering

Procerender is intentionally narrow in scope:

- it renders a single mesh,
- it uses grayscale lighting,
- it shows the key buffers explicitly,
- it avoids the abstraction layers of `canvas` and WebGL,
- it keeps the implementation in small source files with readable methods.

That makes it a good reference for studying:

- camera transforms,
- perspective projection,
- back-face culling,
- barycentric interpolation,
- z-buffer visibility,
- Lambert and Phong illumination,
- image export from raw memory.

## Method Guide

If you want to trace the full pipeline in code, this is the shortest path:

1. `RasterizerApp.render()` in [src/app/main.js](src/app/main.js)
2. `SoftwareRasterizer.render()` in [src/render/software-rasterizer.js](src/render/software-rasterizer.js)
3. `OrbitCamera.projectPointFromBasis()` in [src/camera/orbit-camera.js](src/camera/orbit-camera.js)
4. `SoftwareRasterizer.rasterizeTriangle()` in [src/render/software-rasterizer.js](src/render/software-rasterizer.js)
5. `FrameBuffer.deriveDepthAndStencil()` in [src/render/framebuffer.js](src/render/framebuffer.js)
6. `BmpEncoder.createRgbBlob()` in [src/render/bmp-encoder.js](src/render/bmp-encoder.js)
7. `ImagePresenter.updateImage()` in [src/ui/presenter.js](src/ui/presenter.js)

## STL File Format Specification

The original geometry source is STL, the stereolithography triangle-mesh format. STL stores only triangle geometry and an optional normal per triangle. It does not define materials, textures, joints, scene graphs, or physical units.

`This repository` includes JavaScript mesh arrays extracted from the original STL source geometry. Procerender does not parse STL at runtime; instead, it uses the already-extracted mesh arrays in [src/data/stanford-bunny.js](src/data/stanford-bunny.js) so the page can open directly from the filesystem with no network access.

An ASCII STL file is organized as repeated triangle records:

```text
solid name
  facet normal nx ny nz
    outer loop
      vertex x1 y1 z1
      vertex x2 y2 z2
      vertex x3 y3 z3
    endloop
  endfacet
endsolid name
```

Where:

- each `facet` describes exactly one triangle,
- each `vertex` line stores one 3D point,
- triangle connectivity is usually implicit, so shared vertices are commonly duplicated in the file,
- the stored facet normal may be ignored and recomputed from the vertex coordinates.

## License

Copyright (c) 2026 Ilya Tsivilskiy

This repository is provided under an **all rights reserved** notice. No permission is granted to use, copy, modify, distribute, or exploit this software, including for commercial purposes, without prior written permission from the author. No patent license is granted.

See [LICENSE](LICENSE) for the full terms.
