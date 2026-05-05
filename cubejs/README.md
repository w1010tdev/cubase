# Rubik's Cube Engine - Developer & Agent Integration API

This document is intended for **Developers and AI Agents** performing secondary development, refactoring, or integrating this engine into larger applications.

## 🏗 System Architecture

This engine strictly adheres to a **Zero-Dependency** rule. It uses pure Vanilla JS (ES6 Modules) and CSS3D. The architecture is decoupled into three layers:

1.  **Core Math (`math.js`)**: Provides `Vector3` and 3D rotation matrices.
2.  **State Machine (`cube.js`)**: A scalable `Cube` model that uses 3D coordinates instead of hardcoded 54-element face arrays.
3.  **Renderers (`ui-3d.js`, `ui-2d.js`)**: Stateless UI layers that project the `Cube`'s internal coordinates into CSS DOM matrices and SVG shapes.

---

## 🧠 State Machine (`cube.js`)

Unlike traditional implementations that use arrays of face stickers, this engine treats the cube as a collection of 3D objects (`Cubies`).

### Coordinate System
*   **Origin (0,0,0)**: The core center of the cube.
*   **Axes**: `+x` is Right, `+y` is Up, `+z` is Front.
*   **Default Color Scheme**: Red Front (`+z`), Yellow Up (`+y`), Blue Right (`+x`), White Down (`-y`), Orange Back (`-z`), Green Left (`-x`).

### The `Cubie` Object
Each cubie tracks its spatial position and the direction its colored faces are pointing using **normal vectors**.
```javascript
{
    id: 0,
    pos: Vector3 {x: -1, y: 1, z: 1}, // Example: Top-Front-Left corner
    normals: {
        U: Vector3 {x: 0, y: 1, z: 0}, // The original U face (yellow) is pointing Up
        F: Vector3 {x: 0, y: 0, z: 1}, // The original F face (red) is pointing Front
        // ...
    },
    colors: { U: 'yellow', F: 'red', L: 'green' } // Fixed original colors
}
```
**Agent Note**: To read the current color of a specific physical face (e.g., "What color is currently on the top face of this cubie?"), check which normal vector currently equals `(0, 1, 0)`.

---

## 🛠 API Usage & Code Examples

### 1. Headless Cube Engine (No UI)
You can use the state machine purely for solving, scrambling, or state generation.
```javascript
import { Cube } from './cube.js';

// Initialize an NxN cube (e.g., 3x3)
const cube = new Cube(3);

// Apply moves (Modifies internal state immediately)
cube.applyMove("R");
cube.applyMove("U'");
cube.applyMove("M2");

// Reset to solved state
cube.reset();
```

### 2. Attaching Renderers
Renderers take a DOM ID and bind to the logic engine.
```javascript
import { Cube3DUI } from './ui-3d.js';
import { Cube2DUI } from './ui-2d.js';

// 3D UI creates its own Cube instance internally.
const ui3d = new Cube3DUI('cube-container-3d', 3);

// 2D UI takes an existing Cube instance for state mapping.
const ui2d = new Cube2DUI('cube-container-2d', ui3d.cube);
ui2d.render(); // Call manually to paint the SVG

// Animation Playback (Async)
await ui3d.playSequence("R U R' U'");
ui2d.render(); // Update 2D view after 3D animation finishes
```

### 3. Playback Controls (`Cube3DUI`)
*   `ui3d.playSequence(movesStr)`: Parses and animates a string of WCA moves. Returns a Promise.
*   `ui3d.pause()` / `ui3d.resume()` / `ui3d.stop()`: Controls playback loop.
*   `ui3d.animationDuration = 300`: Set transition speed in milliseconds.
*   `ui3d.onProgress = (index, queue) => {}`: Callback hook fired at every step, useful for UI progress bars.
*   `ui3d.onMoveFinished = () => {}`: Callback hook fired after a single move animation completes.

---

## 🚀 Recent Architecture Updates (As of 2026-05)

*   **Auto-Scaling Container**: `Cube3DUI` now dynamically calculates a `baseScale` to ensure higher-order matrices (e.g., 7x7) remain fully visible within the viewport without clipping.
*   **Smart PLL Arrows Engine (`ui-2d.js`)**: 
    *   Added a toggle (`showArrows`) for drawing SVG permutation arrows.
    *   Features a virtual AUF (Adjust U Face) evaluator that checks all 4 possible rotations of the U-layer and selects the optimal angle with the fewest displacement arrows, breaking ties by preferring horizontal lines.
    *   Strictly uses straight lines and distinct color-coding (**Red** for corners, **Blue** for edges).
*   **Enhanced Playback State (`ui-3d.js`)**: Introduced robust interruption control state (`isPlaying`, `isPaused`) allowing real-time Pause/Resume logic, preventing double-play ghosting.
*   **WCA Notation Parity**: Explicit implementation of `E` (follows D), `M` (follows L), `S` (follows F) slices, and entire cube rotations `x, y, z`.
*   **Progress Callbacks**: Expanded `onProgress(index, queue)` callback hooks, natively supported in `index.html` via DOM span toggling (`played`, `current` tags).

---

## 🎯 Extension Points for Secondary Development

If you are an agent tasked with extending this project, here are the targeted injection points:

1.  **Move Cancellation & Scrambler**:
    *   *File*: `cube.js`
    *   *Function*: `optimizeScramble(movesArr)`
    *   *Task*: Currently a mockup. Implement WCA-compliant scramble generation and redundant move cancellation (e.g., `U U'` -> `null`, `R2 R` -> `R'`).
2.  **Solver Integration**:
    *   Create a new `solver.js`.
    *   Map the `Cubie` normal vectors to a Kociemba string or Thistlethwaite algorithm input.
3.  **2D SVG Arrows (PLL/OLL Guides)**:
    *   *File*: `ui-2d.js`
    *   *Current Implementation*: Features a smart virtual AUF optimizer that detects pure PLL states and calculates minimal rotation offsets. It renders straight lines with specific colors (**Red** for corners, **Blue** for edges) pointing from `initialPos` to `pos`.
    *   *Task*: Enhance OLL detection logic, add custom arrow styles or integrate user-defined drawing for setup moves.
4.  **Auto-Scaling & UI Layout**:
    *   *File*: `ui-3d.js`, `index.html`
    *   *Current Implementation*: Higher-order cubes dynamically adjust their `scale` property based on `baseScale` to prevent rendering overflow. Contains integrated playback progress bar and toggle states.
    *   *Task*: Fine-tune scale breakpoints for extremely large matrices (NxN > 15).
5.  **Virtual WebGL Render**:
    *   If the "Zero-Dependency" rule is lifted, `cube.js` state can be directly synced to a `Three.js` scene by translating `cubie.pos` and reconstructing Quaternions from `cubie.normals`.
