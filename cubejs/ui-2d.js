// ui-2d.js

export class Cube2DUI {
    constructor(containerId, cube) {
        this.container = document.getElementById(containerId);
        this.cube = cube;
        this.size = cube.size;
        this.svgNS = "http://www.w3.org/2000/svg";
        this.showArrows = false;
    }

    render() {
        this.container.innerHTML = '';
        const svg = document.createElementNS(this.svgNS, 'svg');
        // Viewbox size based on cube size. Each cell is 30x30.
        // We need 1 cell margin on all sides for the side faces.
        const cellSize = 30;
        const totalSize = (this.size + 2) * cellSize;
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('viewBox', `0 0 ${totalSize} ${totalSize}`);
        
        // Define arrow markers
        const defs = document.createElementNS(this.svgNS, 'defs');
        const createMarker = (id, color) => {
            const marker = document.createElementNS(this.svgNS, 'marker');
            marker.setAttribute('id', id);
            marker.setAttribute('markerWidth', '6');
            marker.setAttribute('markerHeight', '6');
            marker.setAttribute('refX', '5');
            marker.setAttribute('refY', '3');
            marker.setAttribute('orient', 'auto');
            const polygon = document.createElementNS(this.svgNS, 'polygon');
            polygon.setAttribute('points', '0 0, 6 3, 0 6');
            polygon.setAttribute('fill', color);
            marker.appendChild(polygon);
            return marker;
        };
        defs.appendChild(createMarker('arrowhead-corner', 'rgba(210, 40, 40, 0.9)')); // Red for corners
        defs.appendChild(createMarker('arrowhead-edge', 'rgba(40, 100, 210, 0.9)')); // Blue for edges
        svg.appendChild(defs);

        // Find U face colors
        const offset = (this.size - 1) / 2;
        const uLayer = this.cube.cubies.filter(c => Math.abs(c.pos.y - offset) < 0.1);
        
        const getColor = (cubie, normalStr) => {
            const targetNormals = {
                'U': {x:0, y:1, z:0},
                'D': {x:0, y:-1, z:0},
                'F': {x:0, y:0, z:1},
                'B': {x:0, y:0, z:-1},
                'R': {x:1, y:0, z:0},
                'L': {x:-1, y:0, z:0}
            };
            const target = targetNormals[normalStr];
            
            for (let face in cubie.normals) {
                const n = cubie.normals[face];
                if (Math.abs(n.x - target.x) < 0.1 && 
                    Math.abs(n.y - target.y) < 0.1 && 
                    Math.abs(n.z - target.z) < 0.1) {
                    return cubie.colors[face] || '#222';
                }
            }
            return '#222';
        };

        // Render U face (center grid)
        uLayer.forEach(cubie => {
            // Map x,z to SVG coordinates
            // math: +x is right, +z is down(front)
            // SVG: +x is right, +y is down
            const svgX = (cubie.pos.x + offset + 1) * cellSize;
            const svgY = (cubie.pos.z + offset + 1) * cellSize;
            
            // Top color (U)
            const uColor = getColor(cubie, 'U');
            const rect = this.createRect(svgX, svgY, cellSize, cellSize, uColor);
            svg.appendChild(rect);

            // Side colors (F, B, L, R)
            if (cubie.pos.z > offset - 0.1) { // Front edge
                const fColor = getColor(cubie, 'F');
                svg.appendChild(this.createRect(svgX, svgY + cellSize, cellSize, cellSize/3, fColor));
            }
            if (cubie.pos.z < -offset + 0.1) { // Back edge
                const bColor = getColor(cubie, 'B');
                svg.appendChild(this.createRect(svgX, svgY - cellSize/3, cellSize, cellSize/3, bColor));
            }
            if (cubie.pos.x > offset - 0.1) { // Right edge
                const rColor = getColor(cubie, 'R');
                svg.appendChild(this.createRect(svgX + cellSize, svgY, cellSize/3, cellSize, rColor));
            }
            if (cubie.pos.x < -offset + 0.1) { // Left edge
                const lColor = getColor(cubie, 'L');
                svg.appendChild(this.createRect(svgX - cellSize/3, svgY, cellSize/3, cellSize, lColor));
            }
        });

        if (this.showArrows) {
            const originalUPieces = this.cube.cubies.filter(c => Math.abs(c.initialPos.y - offset) < 0.1);
            let isPLL = true;
            for (let c of originalUPieces) {
                if (Math.abs(c.pos.y - offset) > 0.1 || Math.abs(c.normals.U.y - 1) > 0.1) {
                    isPLL = false;
                    break;
                }
            }

            if (isPLL) {
                const rotations = [
                    (x, z) => ({x: x, z: z}),
                    (x, z) => ({x: -z, z: x}),
                    (x, z) => ({x: -x, z: -z}),
                    (x, z) => ({x: z, z: -x})
                ];
                
                let bestArrows = null;
                let minArrowCount = Infinity;
                let maxHorizontalCount = -1;

                rotations.forEach((rotFunc) => {
                    let currentArrows = [];
                    let horizontalCount = 0;

                    originalUPieces.forEach(cubie => {
                        const isEdgeOrCorner = Math.abs(Math.abs(cubie.initialPos.x) - offset) < 0.1 || 
                                               Math.abs(Math.abs(cubie.initialPos.z) - offset) < 0.1;
                        if (!isEdgeOrCorner) return;

                        const rotatedPos = rotFunc(cubie.pos.x, cubie.pos.z);
                        
                        if (Math.abs(cubie.initialPos.x - rotatedPos.x) < 0.1 && 
                            Math.abs(cubie.initialPos.z - rotatedPos.z) < 0.1) {
                            return;
                        }

                        const startX = (cubie.initialPos.x + offset + 1) * cellSize + cellSize / 2;
                        const startY = (cubie.initialPos.z + offset + 1) * cellSize + cellSize / 2;
                        const endX = (rotatedPos.x + offset + 1) * cellSize + cellSize / 2;
                        const endY = (rotatedPos.z + offset + 1) * cellSize + cellSize / 2;

                        if (Math.abs(startY - endY) < 0.1) {
                            horizontalCount++;
                        }

                        const isCorner = Math.abs(Math.abs(cubie.initialPos.x) - offset) < 0.1 && 
                                         Math.abs(Math.abs(cubie.initialPos.z) - offset) < 0.1;

                        currentArrows.push({
                            startX, startY, endX, endY, 
                            isCorner: isCorner
                        });
                    });

                    if (currentArrows.length < minArrowCount) {
                        minArrowCount = currentArrows.length;
                        maxHorizontalCount = horizontalCount;
                        bestArrows = currentArrows;
                    } else if (currentArrows.length === minArrowCount) {
                        if (horizontalCount > maxHorizontalCount) {
                            maxHorizontalCount = horizontalCount;
                            bestArrows = currentArrows;
                        }
                    }
                });

                if (bestArrows) {
                    bestArrows.forEach(arrow => {
                        const {startX, startY, endX, endY, isStraight} = arrow;
                        const dx = endX - startX;
                        const dy = endY - startY;
                        const len = Math.sqrt(dx*dx + dy*dy);
                        if (len < 0.1) return;

                        const shortenRatio = Math.max(0.1, len - 6) / len;
                        const finalEndX = startX + dx * shortenRatio;
                        const finalEndY = startY + dy * shortenRatio;

                        const path = document.createElementNS(this.svgNS, 'path');
                        
                        if (isStraight) {
                            path.setAttribute('d', `M ${startX} ${startY} L ${finalEndX} ${finalEndY}`);
                        } else {
                            const midX = (startX + endX) / 2;
                            const midY = (startY + endY) / 2;
                            const ctrlX = midX - dy * 0.35;
                            const ctrlY = midY + dx * 0.35;
                            path.setAttribute('d', `M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${finalEndX} ${finalEndY}`);
                        }
                        
                        path.setAttribute('fill', 'none');
                        path.setAttribute('stroke', 'rgba(0,0,0,0.7)');
                        path.setAttribute('stroke-width', '2.5');
                        path.setAttribute('marker-end', 'url(#arrowhead)');
                        svg.appendChild(path);
                    });
                }
            }
        }

        this.container.appendChild(svg);
    }

    createRect(x, y, w, h, fill) {
        const rect = document.createElementNS(this.svgNS, 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', w);
        rect.setAttribute('height', h);
        rect.setAttribute('fill', fill);
        rect.setAttribute('stroke', '#000');
        rect.setAttribute('stroke-width', '2');
        return rect;
    }

    // drawArrow(idx1, idx2) logic could go here
    // using SVG <line> and <marker>
}
