// math.js

// 3D Vector Math & Matrix Rotations for Cube Engine

export class Vector3 {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    clone() {
        return new Vector3(this.x, this.y, this.z);
    }

    equals(v) {
        return Math.abs(this.x - v.x) < 0.01 && 
               Math.abs(this.y - v.y) < 0.01 && 
               Math.abs(this.z - v.z) < 0.01;
    }
}

// Rotate vector around X axis by angle (in radians)
export function rotateX(v, angle) {
    const cos = Math.round(Math.cos(angle));
    const sin = Math.round(Math.sin(angle));
    const y = v.y * cos - v.z * sin;
    const z = v.y * sin + v.z * cos;
    return new Vector3(v.x, y, z);
}

// Rotate vector around Y axis by angle
export function rotateY(v, angle) {
    const cos = Math.round(Math.cos(angle));
    const sin = Math.round(Math.sin(angle));
    const x = v.x * cos + v.z * sin;
    const z = -v.x * sin + v.z * cos;
    return new Vector3(x, v.y, z);
}

// Rotate vector around Z axis by angle
export function rotateZ(v, angle) {
    const cos = Math.round(Math.cos(angle));
    const sin = Math.round(Math.sin(angle));
    const x = v.x * cos - v.y * sin;
    const y = v.x * sin + v.y * cos;
    return new Vector3(x, y, v.z);
}

export function rotate(v, axis, amount) {
    // amount is 1 (90deg), -1 (-90deg), or 2 (180deg)
    const angle = amount * Math.PI / 2;
    if (axis === 'x') return rotateX(v, angle);
    if (axis === 'y') return rotateY(v, angle);
    if (axis === 'z') return rotateZ(v, angle);
    return v.clone();
}
