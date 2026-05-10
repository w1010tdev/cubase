import { Cube, invertSeq } from '/cubejs/cube.js';
import { Cube2DUI } from '/cubejs/ui-2d.js';

export function initExplore(container, db, progress) {
    container.innerHTML = `
        <div class="mb-6">
            <h2 class="text-2xl font-bold font-serif">Explore Algorithms</h2>
            <p class="text-light-muted dark:text-dark-muted">Browse the full database and pick your main algorithms.</p>
        </div>
        <div id="explore-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <!-- Cards injection -->
        </div>
    `;

    const grid = document.getElementById('explore-grid');
    
    // For demo, just show the first category's items (3x3 -> CMLL)
    const category = "3x3";
    const subcategory = "CMLL";
    const cases = db[category][subcategory];

    cases.forEach(caseData => {
        const card = createCaseCard(category, subcategory, caseData, progress);
        grid.appendChild(card);
        render2D(card, caseData);
    });
}

function createCaseCard(cat, sub, caseData, progress) {
    const key = `${cat}|${caseData.name}`;
    const userProg = progress[key] || {};
    const mainAlg = userProg.main_alg || caseData.algorithms[0].alg;
    
    const div = document.createElement('div');
    div.className = "case-card bg-light-surface dark:bg-dark-surface overflow-hidden flex flex-col";
    div.innerHTML = `
        <div class="flex-1 p-4 flex flex-col">
            <div class="flex">
                <div class="w-24 h-24 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border" id="cube2d-${caseData.name.replace(/\s+/g, '-')}">
                    <!-- SVG injected here -->
                </div>
                <div class="ml-4 flex-1">
                    <div class="flex justify-between items-start">
                        <h3 class="font-bold text-lg font-serif">${caseData.name}</h3>
                        <span class="text-xs font-medium px-2 py-1 border border-light-border dark:border-dark-border ">${caseData.subgroup}</span>
                    </div>
                    <p class="text-xs text-light-muted dark:text-dark-muted mt-1 ">Scramble: <code class="bg-light-hover dark:bg-dark-hover px-1 scramble-text" data-alg="${mainAlg}">Calculating...</code></p>
                    
                    <div class="mt-3 space-y-2">
                        ${caseData.algorithms.map((a, idx) => `
                            <div class="text-sm p-2 bg-light-hover dark:bg-dark-hover border border-transparent hover:border-black dark:hover:border-white transition cursor-pointer flex justify-between items-center group">
                                <span class="font-mono text-xs break-all mr-2">${a.alg}</span>
                                <div class="flex space-x-1 opacity-0 group-hover:opacity-100 transition">
                                    <button class="p-1 hover:text-yellow-500" title="Set as Main"><i class="fa-solid fa-star text-light-muted dark:text-dark-muted ${a.alg === mainAlg ? 'text-yellow-500' : ''}"></i></button>
                                    <button class="p-1 hover:text-black dark:hover:text-white" title="Add to Set"><i class="fa-solid fa-plus text-light-muted dark:text-dark-muted"></i></button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
        <div class="bg-light-hover dark:bg-dark-hover px-4 py-2 border-t border-light-border dark:border-dark-border flex justify-between items-center mt-auto">
             <button class="text-light-text dark:text-dark-text text-sm font-medium hover:underline ">
                <i class="fa-solid fa-video mr-1 text-light-muted dark:text-dark-muted"></i> 3D View
             </button>
             <button class="flex items-center text-sm text-light-muted dark:text-dark-muted hover:text-green-500 ">
                <i class="fa-regular fa-circle-check mr-1"></i> <span>Learned</span>
             </button>
        </div>
    `;
    return div;
}

function render2D(card, caseData) {
    const containerId = `cube2d-${caseData.name.replace(/\s+/g, '-')}`;
    const mainAlg = caseData.algorithms[0].alg; // default
    
    // Generate Scramble: Inverse of the algorithm
    const scramble = invertSeq(mainAlg);
    
    // Update scramble text in UI
    const code = card.querySelector('.scramble-text');
    code.textContent = scramble;

    const cube = new Cube(3);
    // Apply scramble
    scramble.split(/\s+/).forEach(move => cube.applyMove(move));
    
    const ui = new Cube2DUI(containerId, cube);
    ui.render();
}
