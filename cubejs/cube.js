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
                    // Skip internal core cubies to drastically improve NxN performance
                    const isInternal = x > 0 && x < this.size - 1 && 
                                       y > 0 && y < this.size - 1 && 
                                       z > 0 && z < this.size - 1;
                    if (isInternal && this.size > 2) continue;

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
        if (moveStr === '(' || moveStr === ')') return { isPause: true };

        const offset = (this.size - 1) / 2;
        
        // Normalize single token synonyms
        moveStr = moveStr.replace(/i/g, "'").replace(/-/g, "'").replace(/'2/g, "2'");

        const match = moveStr.match(/^([1-9][0-9]*(?:-[1-9][0-9]*)?)?([UDFBRLMESxyzudfbrl])(w)?(\d*)(')?$/);
        if (!match) return null;

        const prefix = match[1];
        let face = match[2];
        let isWide = !!match[3];
        const amountStr = match[4];
        const isPrime = !!match[5];

        if (/[udfbrl]/.test(face)) {
            face = face.toUpperCase();
            isWide = true;
        }

        let baseAmount = 1;
        if (amountStr !== "") {
            baseAmount = parseInt(amountStr) % 4;
            if (baseAmount === 0) return { isPause: true }; // No-op
        }
        
        let amount = isPrime ? -baseAmount : baseAmount;
        if (amount === 3) amount = -1;
        if (amount === -3) amount = 1;
        if (amount === -2) amount = 2; // Keep 180 degrees as 2

        let axis, layerIndices = [];
        
        let startLayer, endLayer;
        if (prefix) {
            if (prefix.includes('-')) {
                const parts = prefix.split('-');
                startLayer = parseInt(parts[0]);
                endLayer = parseInt(parts[1]);
            } else {
                let p = parseInt(prefix);
                startLayer = isWide ? 1 : p;
                endLayer = p;
            }
        } else {
            startLayer = 1;
            endLayer = isWide ? 2 : 1;
        }
        
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

export function generateScramble(size = 3) {
    const lengths = {2: 11, 3: 21, 4: 40, 5: 60, 6: 80, 7: 100};
    const length = lengths[size] || (size * 15);
    const faces = ['U', 'D', 'F', 'B', 'R', 'L'];
    const modifiers = ['', "'", '2'];
    let scramble = [];
    let lastFace = '';
    const oppositeFace = { 'U':'D', 'D':'U', 'F':'B', 'B':'F', 'R':'L', 'L':'R' };

    for (let i = 0; i < length; i++) {
        let face;
        do {
            face = faces[Math.floor(Math.random() * faces.length)];
        } while (face === lastFace || (size > 3 && face === oppositeFace[lastFace] && Math.random() < 0.5));

        let mod = modifiers[Math.floor(Math.random() * modifiers.length)];
        let move = face + mod;
        
        // Add random wide or inner slice moves for higher orders to scramble centers
        if (size > 3) {
            const type = Math.random();
            const maxDepth = Math.floor(size / 2);
            if (type < 0.4 && maxDepth > 1) {
                // Wide move (e.g., 3Rw)
                let depth = Math.floor(Math.random() * maxDepth) + 1;
                move = (depth > 1 ? depth : '') + face + 'w' + mod; 
            } else if (type < 0.6 && maxDepth > 1) {
                // Inner slice (e.g., 2R)
                let depth = Math.floor(Math.random() * maxDepth) + 1;
                move = (depth > 1 ? depth : '') + face + mod;
            }
        }
        
        scramble.push(move);
        lastFace = face;
    }
    return optimizeScramble(scramble);
}

// Expand advanced notations (commutators, conjugates, brackets, groupings)
export function expandAlg(str) {
    str = str.replace(/-/g, "'").replace(/i/g, "'");
    str = str.replace(/'2/g, "2'"); 
    str = str.replace(/\n|\t|\r/g, ' '); // Clean whitespace
    
    // Add spaces around brackets to safely tokenize
    str = str.replace(/\(/g, ' ( ').replace(/\)/g, ' ) ');
    // Re-attach modifiers to closing brackets (e.g., " ) 3 " -> ")3 ", " ) 2' " -> ")2' ")
    str = str.replace(/\)\s+((?:\d+)?'?)/g, (match, mod) => {
        return mod ? ')' + mod + ' ' : ') ';
    });
    
    let changed = true;
    let iterations = 0;
    while(changed && iterations < 10) {
        changed = false;
        iterations++;
        
        // Commutator: [A, B] -> { A } { B } { A' } { B' }
        str = str.replace(/\[\s*([^\[\]:,]+)\s*,\s*([^\[\]]+)\s*\]((?:\d+)?'?)/g, (match, a, b, mod) => {
            changed = true;
            let expanded = ` { ${a} } { ${b} } { ${invertSeq(a)} } { ${invertSeq(b)} } `;
            return applyMod(expanded, mod);
        });
        
        // Conjugate: [A: B] -> { A } { B } { A' }
        str = str.replace(/\[\s*([^\[\],:]+)\s*:\s*([^\[\]]+)\s*\]((?:\d+)?'?)/g, (match, a, b, mod) => {
            changed = true;
            let expanded = ` { ${a} } { ${b} } { ${invertSeq(a)} } `;
            return applyMod(expanded, mod);
        });

        // Parentheses: (A) -> { A }
        str = str.replace(/\(\s*([^()]+)\s*\)((?:\d+)?'?)/g, (match, inner, mod) => {
            changed = true;
            if (!mod) return ` { ${inner} } `;
            return applyMod(` { ${inner} } `, mod);
        });
    }
    
    // Restore structural brackets for playback pauses
    str = str.replace(/\{/g, ' ( ').replace(/\}/g, ' ) ');
    
    // Clean up multiple spaces
    return str.replace(/\s+/g, ' ').trim();
}

function applyMod(seq, mod) {
    if (!mod) return seq;
    
    let isPrime = mod.includes("'");
    let n = parseInt(mod);
    if (isNaN(n)) n = 1;
    
    let baseSeq = isPrime ? invertSeq(seq) : seq;
    
    let res = [];
    for(let i = 0; i < n; i++) res.push(baseSeq);
    return res.join(' ');
}

export function invertSeq(seq) {
    return seq.trim().split(/\s+/).reverse().map(invertToken).join(' ');
}

export function invertToken(token) {
    if (!token) return '';
    if (token === '(') return ')';
    if (token === ')') return '(';
    if (token === '{') return '}';
    if (token === '}') return '{';
    
    const match = token.match(/^([1-9][0-9]*(?:-[1-9][0-9]*)?)?([UDFBRLMESxyzudfbrl])(w)?(\d*)(')?$/);
    if (!match) return token;
    
    let [_, prefix, face, w, amountStr, isPrime] = match;
    prefix = prefix || '';
    w = w || '';
    amountStr = amountStr || '';
    
    let baseAmount = amountStr === '' ? 1 : parseInt(amountStr);
    if (baseAmount % 2 === 0) return token; // R2 inverse is R2, R4 is R4
    
    if (isPrime) return prefix + face + w + amountStr;
    return prefix + face + w + amountStr + "'";
}
