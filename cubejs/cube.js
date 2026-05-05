// cube.js
import { Vector3, rotate } from './math.js';

export class Cubie {
    constructor(id, x, y, z, offset) {
        this.id = id;
        this.initialPos = new Vector3(x, y, z);
        // Current position
        this.pos = new Vector3(x, y, z);
        // Face normals (which color points in which global direction)
        // Default orientations: U=y(1), D=y(-1), F=z(1), B=z(-1), R=x(1), L=x(-1)
        this.normals = {
            U: new Vector3(0, 1, 0),
            D: new Vector3(0, -1, 0),
            F: new Vector3(0, 0, 1),
            B: new Vector3(0, 0, -1),
            R: new Vector3(1, 0, 0),
            L: new Vector3(-1, 0, 0)
        };
        
        // Initial colors logic based on starting pos (Red Front, Yellow Up scheme)
        this.colors = {};
        if (y === offset) this.colors.U = 'yellow';
        if (y === -offset) this.colors.D = 'white';
        if (z === offset) this.colors.F = 'red';
        if (z === -offset) this.colors.B = 'orange';
        if (x === offset) this.colors.R = 'blue';
        if (x === -offset) this.colors.L = 'green';
    }

    rotate(axis, amount) {
        this.pos = rotate(this.pos, axis, amount);
        for (let face in this.normals) {
            this.normals[face] = rotate(this.normals[face], axis, amount);
        }
    }
}

export class Cube {
    constructor(size = 3) {
        this.size = size;
        this.cubies = [];
        this.reset();
    }

    reset() {
        this.cubies = [];
        let id = 0;
        const offset = (this.size - 1) / 2;
        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                for (let z = 0; z < this.size; z++) {
                    const cx = x - offset;
                    const cy = y - offset;
                    const cz = z - offset;
                    this.cubies.push(new Cubie(id++, cx, cy, cz, offset));
                }
            }
        }
    }

    // Apply a standard WCA move (e.g. U, R', F2, Rw)
    applyMove(moveStr) {
        const parsed = this.parseMove(moveStr);
        if (!parsed) return;
        this._rotateSlice(parsed.axis, parsed.layerIndices, parsed.amount);
    }

    _rotateSlice(axis, layerIndices, amount) {
        this.cubies.forEach(cubie => {
            const val = cubie.pos[axis];
            // Due to floating point (e.g. 0.5 for even sizes), we check close match
            const matchesLayer = layerIndices.some(idx => Math.abs(val - idx) < 0.1);
            if (matchesLayer) {
                cubie.rotate(axis, amount);
            }
        });
    }

    parseMove(moveStr) {
        const offset = (this.size - 1) / 2;
        const match = moveStr.match(/^([1-9])?([UDFBRLMESxyzudfbrl])(w)?(2)?(')?$/);
        if (!match) return null;

        const prefix = match[1];
        let face = match[2];
        let isWide = !!match[3];
        const isDouble = !!match[4];
        const isPrime = !!match[5];

        if (/[udfbrl]/.test(face)) {
            face = face.toUpperCase();
            isWide = true;
        }

        let amount = isPrime ? -1 : 1;
        if (isDouble) amount = 2;

        let axis, layerIndices = [];
        
        let depth = prefix ? parseInt(prefix) : (isWide ? 2 : 1);
        let startLayer = isWide ? 1 : depth;
        let endLayer = depth;
        
        const getIndices = (dir) => {
            let indices = [];
            for (let i = startLayer; i <= endLayer; i++) {
                if (dir === 1) indices.push(offset - (i - 1));
                else indices.push(-offset + (i - 1));
            }
            return indices;
        };

        // E 跟 D 方向一致，M 跟 L 一致，S 跟 F 一致
        // 整体旋转 x 跟 R 一致，y 跟 U 一致，z 跟 F 一致
        
        switch (face) {
            case 'R': axis = 'x'; amount *= -1; layerIndices = getIndices(1); break;
            case 'L': axis = 'x'; amount *= 1;  layerIndices = getIndices(-1); break;
            case 'U': axis = 'y'; amount *= -1; layerIndices = getIndices(1); break;
            case 'D': axis = 'y'; amount *= 1;  layerIndices = getIndices(-1); break;
            case 'F': axis = 'z'; amount *= -1; layerIndices = getIndices(1); break;
            case 'B': axis = 'z'; amount *= 1;  layerIndices = getIndices(-1); break;
            case 'M': axis = 'x'; amount *= 1;  layerIndices = [0]; break;
            case 'E': axis = 'y'; amount *= 1;  layerIndices = [0]; break;
            case 'S': axis = 'z'; amount *= -1; layerIndices = [0]; break;
            case 'x': axis = 'x'; amount *= -1; layerIndices = this._allLayers(); break;
            case 'y': axis = 'y'; amount *= -1; layerIndices = this._allLayers(); break;
            case 'z': axis = 'z'; amount *= -1; layerIndices = this._allLayers(); break;
        }

        return { axis, layerIndices, amount };
    }

    _allLayers() {
        const layers = [];
        const offset = (this.size - 1) / 2;
        for(let i = 0; i < this.size; i++) layers.push(i - offset);
        return layers;
    }
}

// Scramble Optimizer (Cancellation)
export function optimizeScramble(movesArr) {
    // Simple mock optimizer: just returns joined string.
    // Full move cancellation (e.g. U U' -> '') could be implemented here.
    return movesArr.join(' ');
}

export function generateScramble(size = 3, length = 21) {
    const faces = ['U', 'D', 'F', 'B', 'R', 'L'];
    const modifiers = ['', "'", '2'];
    let scramble = [];
    let lastFace = '';

    for (let i = 0; i < length; i++) {
        let face;
        do {
            face = faces[Math.floor(Math.random() * faces.length)];
        } while (face === lastFace);

        let mod = modifiers[Math.floor(Math.random() * modifiers.length)];
        let move = face + mod;
        
        // Add random wide or inner slice moves for higher orders
        if (size > 3 && Math.random() > 0.5) {
            let depth = Math.floor(Math.random() * Math.floor(size / 2)) + 1;
            if (depth > 1) {
               let isWide = Math.random() > 0.5 ? 'w' : '';
               move = (depth > 2 ? depth : '') + face + isWide + mod; 
            }
        }
        
        scramble.push(move);
        lastFace = face;
    }
    return optimizeScramble(scramble);
}
