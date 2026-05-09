// ui-3d.js
import { Cube, expandAlg } from './cube.js';

export class Cube3DUI {
    constructor(containerId, size = 3) {
        this.container = document.getElementById(containerId);
        this.size = size;
        this.cube = new Cube(size);
        this.domElements = new Map(); // map cubie id to DOM element
        this.animationDuration = 300; // default duration in ms
        
        this.initDOM();
        this.setupInteractions();
    }

    initDOM() {
        this.container.innerHTML = '';
        this.scene = document.createElement('div');
        this.scene.className = 'cube-scene';
        
        this.cubeWrapper = document.createElement('div');
        this.cubeWrapper.className = 'cube-wrapper';
        this.scene.appendChild(this.cubeWrapper);
        this.container.appendChild(this.scene);

        // Calculate auto-scale based on cube size
        this.baseScale = 3.5 / Math.max(3.5, this.size);

        // Pre-create styles for sizes
        const cubieSize = 50; // px
        this.cube.cubies.forEach(cubie => {
            const el = document.createElement('div');
            el.className = 'cubie';
            el.style.width = `${cubieSize}px`;
            el.style.height = `${cubieSize}px`;
            
            // Create 6 faces
            const faces = ['U', 'D', 'F', 'B', 'R', 'L'];
            faces.forEach(f => {
                const faceEl = document.createElement('div');
                faceEl.className = `face face-${f}`;
                if (cubie.colors[f]) {
                    faceEl.style.backgroundColor = cubie.colors[f];
                } else {
                    faceEl.style.backgroundColor = '#222'; // inner color
                }
                el.appendChild(faceEl);
            });

            this.domElements.set(cubie.id, el);
            this.cubeWrapper.appendChild(el);
        });

        this.updateDOMTransforms();
    }

    updateDOMTransforms() {
        const cubieSize = 50;
        this.cube.cubies.forEach(cubie => {
            const el = this.domElements.get(cubie.id);
            if (!el) return;
            
            // Translate based on pos
            const tx = cubie.pos.x * cubieSize;
            const ty = -cubie.pos.y * cubieSize; // SVG/DOM y is down, 3d y is up
            const tz = cubie.pos.z * cubieSize;
            
            // We also need to apply rotations. Since our state machine only keeps track of normal vectors,
            // mapping it to CSS transform matrices can be complex, OR we can keep track of absolute rotation.
            // Wait, an easier way is to manage the transformation matrix directly, or just let CSS do the animation 
            // and we read the transform.
            // Let's use a rotation accumulator for each cubie instead, or reconstruct from normals!
            
            // Reconstructing rotation from U and F normals:
            // U = y-axis, F = z-axis, R = x-axis
            const u = cubie.normals.U;
            const f = cubie.normals.F;
            const r = cubie.normals.R;
            
            // DOM coordinate system: +x is right, +y is DOWN, +z is out of screen (towards viewer)
            // Math system: +x right, +y UP, +z out of screen
            const matrix = [
                r.x, -r.y, r.z, 0,
                -u.x, u.y, -u.z, 0,
                f.x, -f.y, f.z, 0,
                tx, ty, tz, 1
            ];
            
            el.style.transform = `matrix3d(${matrix.join(',')})`;
        });
    }

    async playSequence(movesStr) {
        if (!movesStr.trim()) return;
        
        // Expand algorithms before playback (handles commutators, repeats)
        const expandedStr = expandAlg(movesStr);
        this.movesQueue = expandedStr.trim().split(/\s+/).filter(m => {
            if (!m) return false;
            if (m === '(' || m === ')') return true;
            return this.cube.parseMove(m) !== null;
        });
        
        this.currentMoveIndex = 0;
        this.isPlaying = true;
        this.isPaused = false;

        while (this.currentMoveIndex < this.movesQueue.length) {
            if (!this.isPlaying) break;
            while (this.isPaused && this.isPlaying) {
                await new Promise(r => setTimeout(r, 50));
            }
            if (!this.isPlaying) break;

            if (this.onProgress) this.onProgress(this.currentMoveIndex, this.movesQueue);
            
            const m = this.movesQueue[this.currentMoveIndex];
            
            if (m === '(' || m === ')') {
                // If it's a consecutive pause sequence like )( or () or )), we can optionally merge them
                // Here we merge )(
                if (m === ')' && this.currentMoveIndex + 1 < this.movesQueue.length && this.movesQueue[this.currentMoveIndex + 1] === '(') {
                    this.currentMoveIndex++;
                }
                // Pause for parentheses boundaries
                await new Promise(r => setTimeout(r, this.animationDuration));
            } else {
                await this.animateMove(m);
                if (this.onMoveFinished) this.onMoveFinished();
            }
            
            this.currentMoveIndex++;
        }
        
        this.isPlaying = false;
        if (this.onProgress) this.onProgress(this.currentMoveIndex, this.movesQueue);
    }

    pause() { this.isPaused = true; }
    resume() { this.isPaused = false; }
    stop() { this.isPlaying = false; }

    resetView() {
        this.rotX = -20;
        this.rotY = -30;
        this.cubeWrapper.style.transform = `scale(${this.baseScale}) rotateX(${this.rotX}deg) rotateY(${this.rotY}deg)`;
    }

    animateMove(moveStr) {
        return new Promise(resolve => {
            const parsed = this.cube.parseMove(moveStr);
            if (!parsed || parsed.isPause) {
                resolve();
                return;
            }

            const offset = (this.size - 1) / 2;
            const movingIds = this.cube.cubies.filter(c => {
                const val = c.pos[parsed.axis];
                return parsed.layerIndices.some(idx => Math.abs(val - idx) < 0.1);
            }).map(c => c.id);

            // Group them
            const group = document.createElement('div');
            group.className = 'animation-group';
            // Insert group to wrapper
            this.cubeWrapper.appendChild(group);

            const cubieSize = 50;
            movingIds.forEach(id => {
                const el = this.domElements.get(id);
                // We need to move elements to group without changing their visual position
                // Actually, if group is at origin (0,0,0) and same transform, it's trivial
                group.appendChild(el);
            });

            // Trigger reflow
            void group.offsetWidth;

            // Apply rotation
            const duration = this.animationDuration;
            group.style.transition = `transform ${duration}ms ease`;
            let rotAxis = parsed.axis;
            // Map our Math axes to DOM axes
            // Math: +x right, +y up, +z out
            // DOM: +x right, +y down, +z out
            // So x is same, z is same, y is inverted.
            let cssAxis = rotAxis;
            let deg = (parsed.amount * 90);
            
            // To make visuals match the math:
            if (rotAxis === 'x') {
                deg = -deg; // DOM rotateX + is bottom-back, Math rotateX + is y->z (up->front) which is bottom-front. So invert.
            } else if (rotAxis === 'y') {
                deg = deg; // DOM rotateY + is right-back, Math rotateY + is z->x (front->right) which is right-back. Same!
            } else if (rotAxis === 'z') {
                deg = -deg; // DOM rotateZ + is right-down, Math rotateZ + is x->y (right->up) which is right-up. So invert.
            }

            group.style.transform = `rotate${cssAxis.toUpperCase()}(${deg}deg)`;

            setTimeout(() => {
                // Update logical state
                this.cube.applyMove(moveStr);
                
                // Ungroup
                movingIds.forEach(id => {
                    const el = this.domElements.get(id);
                    this.cubeWrapper.appendChild(el);
                });
                group.remove();
                
                // Refresh all from new logical state to clear CSS transform artifacts
                this.updateDOMTransforms();
                resolve();
            }, duration);
        });
    }

    setupInteractions() {
        let isDragging = false;
        let startX, startY;
        this.rotX = -20;
        this.rotY = -30;
        
        this.cubeWrapper.style.transform = `scale(${this.baseScale}) rotateX(${this.rotX}deg) rotateY(${this.rotY}deg)`;

        const onDown = (e) => {
            isDragging = true;
            startX = e.touches ? e.touches[0].clientX : e.clientX;
            startY = e.touches ? e.touches[0].clientY : e.clientY;
        };

        const onMove = (e) => {
            if (!isDragging) return;
            const x = e.touches ? e.touches[0].clientX : e.clientX;
            const y = e.touches ? e.touches[0].clientY : e.clientY;
            const dx = x - startX;
            const dy = y - startY;
            this.rotY += dx * 0.5;
            this.rotX -= dy * 0.5;
            this.cubeWrapper.style.transform = `scale(${this.baseScale}) rotateX(${this.rotX}deg) rotateY(${this.rotY}deg)`;
            startX = x;
            startY = y;
        };

        const onUp = () => { isDragging = false; };

        document.addEventListener('mousedown', onDown);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchstart', onDown);
        document.addEventListener('touchmove', onMove);
        document.addEventListener('touchend', onUp);
    }
}
