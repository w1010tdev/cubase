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
            marker.setAttribute('refX', '6'); // Exactly at tip
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
            const svgX = (cubie.pos.x + offset + 1) * cellSize;
            const svgY = (cubie.pos.z + offset + 1) * cellSize;
            
            const uColor = getColor(cubie, 'U');
            const rect = this.createRect(svgX, svgY, cellSize, cellSize, uColor);
            svg.appendChild(rect);

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
                const getGroupInfo = (x, z, offset) => {
                    const isXEdge = Math.abs(Math.abs(x) - offset) < 0.1;
                    const isZEdge = Math.abs(Math.abs(z) - offset) < 0.1;
                    if (!isXEdge && !isZEdge) return null; // center piece
                    
                    const signX = isXEdge ? (x > 0.1 ? 1 : (x < -0.1 ? -1 : 0)) : 0;
                    const signZ = isZEdge ? (z > 0.1 ? 1 : (z < -0.1 ? -1 : 0)) : 0;
                    const isCorner = isXEdge && isZEdge;
                    
                    return {
                        id: `${isCorner ? 'C' : 'E'}_${signX}_${signZ}`,
                        isCorner: isCorner,
                        centerX: signX * offset,
                        centerZ: signZ * offset
                    };
                };

                const rotations = [
                    {name: "0deg", func: (x, z) => ({x: x, z: z})},
                    {name: "90deg", func: (x, z) => ({x: -z, z: x})},
                    {name: "180deg", func: (x, z) => ({x: -x, z: -z})},
                    {name: "270deg", func: (x, z) => ({x: z, z: -x})}
                ];
                
                let bestArrows = null;
                let minArrowCount = Infinity;
                let bestIsEven = false;
                let maxOrthoCount = -1;
                let maxHorizontalCount = -1;

                console.log("--- Smart AUF Evaluation ---");

                rotations.forEach((rot) => {
                    const uniqueArrows = new Map();

                    originalUPieces.forEach(cubie => {
                        const srcInfo = getGroupInfo(cubie.initialPos.x, cubie.initialPos.z, offset);
                        if (!srcInfo) return; // skip centers

                        const rotatedPos = rot.func(cubie.pos.x, cubie.pos.z);
                        const destInfo = getGroupInfo(rotatedPos.x, rotatedPos.z, offset);
                        
                        if (!destInfo || srcInfo.id === destInfo.id) return;

                        const arrowKey = `${srcInfo.id}->${destInfo.id}`;
                        if (!uniqueArrows.has(arrowKey)) {
                            const startX = (srcInfo.centerX + offset + 1) * cellSize + cellSize / 2;
                            const startY = (srcInfo.centerZ + offset + 1) * cellSize + cellSize / 2;
                            const endX = (destInfo.centerX + offset + 1) * cellSize + cellSize / 2;
                            const endY = (destInfo.centerZ + offset + 1) * cellSize + cellSize / 2;

                            uniqueArrows.set(arrowKey, {
                                startX, startY, endX, endY, 
                                isCorner: srcInfo.isCorner,
                                srcId: srcInfo.id,
                                destId: destInfo.id
                            });
                        }
                    });

                    const currentArrows = Array.from(uniqueArrows.values());
                    
                    let horizontalCount = 0;
                    let verticalCount = 0;
                    currentArrows.forEach(a => {
                        if (Math.abs(a.startY - a.endY) < 0.1) horizontalCount++;
                        if (Math.abs(a.startX - a.endX) < 0.1) verticalCount++;
                    });

                    // Calculate Edge Parity (Only edges matter for this heuristic)
                    let cycles = 0;
                    let visited = new Set();
                    let edgeArrows = currentArrows.filter(a => !a.isCorner);
                    let N = edgeArrows.length;
                    let graph = new Map();
                    edgeArrows.forEach(a => {
                        graph.set(a.srcId, a.destId);
                    });

                    edgeArrows.forEach(a => {
                        if (!visited.has(a.srcId)) {
                            cycles++;
                            let curr = a.srcId;
                            while (curr && !visited.has(curr)) {
                                visited.add(curr);
                                curr = graph.get(curr);
                            }
                        }
                    });
                    const isEvenPerm = N === 0 ? true : (N - cycles) % 2 === 0;
                    let orthoCount = horizontalCount + verticalCount;

                    console.log(`[${rot.name}] Arrows: ${N}, EvenPerm: ${isEvenPerm}, Ortho: ${orthoCount}, Horiz: ${horizontalCount}`);

                    let shouldReplace = false;
                    if (currentArrows.length < minArrowCount) {
                        shouldReplace = true;
                    } else if (currentArrows.length === minArrowCount) {
                        if (isEvenPerm && !bestIsEven) {
                            shouldReplace = true;
                        } else if (isEvenPerm === bestIsEven) {
                            if (orthoCount > maxOrthoCount) {
                                shouldReplace = true;
                            } else if (orthoCount === maxOrthoCount) {
                                if (horizontalCount > maxHorizontalCount) {
                                    shouldReplace = true;
                                }
                            }
                        }
                    }

                    if (shouldReplace || bestArrows === null) {
                        minArrowCount = currentArrows.length;
                        bestIsEven = isEvenPerm;
                        maxOrthoCount = orthoCount;
                        maxHorizontalCount = horizontalCount;
                        bestArrows = currentArrows;
                    }
                });
                
                console.log(`=> Selected AUF: Arrows=${minArrowCount}, EvenPerm=${bestIsEven}, Ortho=${maxOrthoCount}, Horiz=${maxHorizontalCount}`);

                if (bestArrows) {
                    bestArrows.forEach(arrow => {
                        const {startX, startY, endX, endY, isCorner} = arrow;

                        const path = document.createElementNS(this.svgNS, 'path');
                        // Exact center-to-center drawing without shortening
                        path.setAttribute('d', `M ${startX} ${startY} L ${endX} ${endY}`);
                        
                        const color = isCorner ? 'rgba(210, 40, 40, 0.9)' : 'rgba(40, 100, 210, 0.9)';
                        const markerId = isCorner ? 'arrowhead-corner' : 'arrowhead-edge';

                        path.setAttribute('fill', 'none');
                        path.setAttribute('stroke', color);
                        path.setAttribute('stroke-width', '2.5');
                        path.setAttribute('marker-end', `url(#${markerId})`);
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

    getSVG() {
        return this.container.innerHTML;
    }
}
