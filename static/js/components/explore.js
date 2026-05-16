import { Cube, expandAlg, invertSeq } from '/cubejs/cube.js';
import { Cube2DUI } from '/cubejs/ui-2d.js';
import { Cube3DUI } from '/cubejs/ui-3d.js';

const exploreState = {
    puzzle: null,
    category: null,
    level: 'puzzles',
    searchQuery: '',
    expandedPuzzles: new Set(),
    restoreSearchFocus: false
};

export function initExplore(container, db, progress) {
    if (!db) {
        container.innerHTML = '<p class="text-light-muted dark:text-dark-muted">No database loaded.</p>';
        return;
    }

    ensureDefaultState(db);
    if (!exploreState.level) {
        exploreState.level = 'puzzles';
    }
    exploreState.expandedPuzzles.add(exploreState.puzzle);
    renderTreeMenu(db);

    container.innerHTML = `
        <div class="mb-6">
            <h2 class="text-2xl font-bold font-serif">Explore Algorithms</h2>
            <p class="text-light-muted dark:text-dark-muted">Browse the full database and pick your main algorithms.</p>
        </div>
        <div id="explore-content">
            <!-- Dynamic explore content -->
        </div>
    `;

    renderExploreContent(container, db, progress);
}

export function onTreeCategorySelect(container, db, progress, puzzle, category) {
    exploreState.puzzle = puzzle;
    exploreState.category = category;
    exploreState.level = 'cases';
    exploreState.searchQuery = '';
    exploreState.expandedPuzzles.add(puzzle);
    renderTreeMenu(db);
    renderExploreContent(container, db, progress);
}

function ensureDefaultState(db) {
    if (!exploreState.level) {
        exploreState.level = 'puzzles';
    }

    if (exploreState.level === 'puzzles') {
        exploreState.puzzle = null;
        exploreState.category = null;
        return;
    }

    const puzzles = Object.keys(db);
    if (!puzzles.length) return;

    if (!exploreState.puzzle || !db[exploreState.puzzle]) {
        exploreState.puzzle = puzzles[0];
    }

    const categories = Object.keys(db[exploreState.puzzle] || {});
    if (!categories.length) {
        exploreState.category = null;
        return;
    }

    if (!exploreState.category || !db[exploreState.puzzle][exploreState.category]) {
        exploreState.category = null;
        exploreState.level = 'categories';
    }
}

function getCubeSizeFromPuzzle(puzzleKey) {
    if (!puzzleKey) return 3;
    const match = String(puzzleKey).match(/(\d+)\s*x\s*(\d+)/i);
    if (!match) return 3;
    const size = Number.parseInt(match[1], 10);
    if (Number.isNaN(size) || size < 2) return 3;
    return size;
}

function filterCasesByQuery(cases, query) {
    const q = query.trim().toLowerCase();
    if (!q) return cases;
    
    // Allow searching by multiple terms separated by space (e.g. "O adj")
    const terms = q.split(/\s+/);
    
    return cases.filter(caseData => {
        const searchableText = [
            (caseData.name || '').toLowerCase(),
            (caseData.subgroup || '').toLowerCase(),
            ...(caseData.algorithms || []).map(a => (a.alg || '').toLowerCase())
        ].join(' ');
        
        return terms.every(term => searchableText.includes(term));
    });
}

function renderTreeMenu(db) {
    const tree = document.getElementById('tree-container');
    if (!tree) return;

    tree.innerHTML = '';
    const puzzles = Object.keys(db);

    puzzles.forEach(puzzle => {
        const puzzleWrap = document.createElement('div');
        const isActivePuzzle = exploreState.puzzle === puzzle;
        const isExpanded = exploreState.expandedPuzzles.has(puzzle);
        puzzleWrap.innerHTML = `
            <div class="flex items-stretch gap-1">
                <button data-puzzle-toggle="${puzzle}" class="tree-toggle px-2 py-2 border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface hover:bg-light-hover dark:hover:bg-dark-hover">
                    <span class="text-light-muted dark:text-dark-muted">${isExpanded ? '▾' : '▸'}</span>
                </button>
                <button data-puzzle="${puzzle}" class="tree-puzzle flex-1 text-left px-3 py-2 border bg-light-surface dark:bg-dark-surface hover:bg-light-hover dark:hover:bg-dark-hover ${isActivePuzzle ? 'font-bold border-black dark:border-white' : 'border-light-border dark:border-dark-border'}">
                    ${puzzle}
                </button>
            </div>
            <div class="tree-categories ${isExpanded ? '' : 'hidden'} mt-1 space-y-1"></div>
        `;
        tree.appendChild(puzzleWrap);

        const categoriesEl = puzzleWrap.querySelector('.tree-categories');
        const categories = Object.keys(db[puzzle] || {});
        categories.forEach(category => {
            const isActiveCategory = isActivePuzzle && exploreState.category === category;
            const btn = document.createElement('button');
            btn.className = `w-full text-left px-6 py-2 text-sm border hover:bg-light-hover dark:hover:bg-dark-hover ${isActiveCategory ? 'bg-light-hover dark:bg-dark-hover font-bold border-black dark:border-white' : 'bg-light-menu dark:bg-dark-surface border-light-border dark:border-dark-border'}`;
            btn.textContent = category;
            btn.dataset.puzzle = puzzle;
            btn.dataset.category = category;
            categoriesEl.appendChild(btn);
        });
    });

    tree.querySelectorAll('.tree-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const puzzle = btn.dataset.puzzleToggle;
            if (exploreState.expandedPuzzles.has(puzzle)) {
                exploreState.expandedPuzzles.delete(puzzle);
            } else {
                exploreState.expandedPuzzles.add(puzzle);
            }
            renderTreeMenu(db);
        });
    });

    tree.querySelectorAll('.tree-puzzle').forEach(btn => {
        btn.addEventListener('click', () => {
            const puzzle = btn.dataset.puzzle;
            exploreState.puzzle = puzzle;
            const categories = Object.keys(db[puzzle] || {});
            exploreState.category = null;
            exploreState.level = 'categories';
            exploreState.searchQuery = '';
            exploreState.expandedPuzzles.add(puzzle);
            renderTreeMenu(db);
            const appView = document.getElementById('app-view');
            if (appView) {
                renderExploreContent(appView, db, window.__CUBASE_PROGRESS__ || {});
            }
        });
    });

    tree.querySelectorAll('[data-category]').forEach(btn => {
        btn.addEventListener('click', () => {
            exploreState.puzzle = btn.dataset.puzzle;
            exploreState.category = btn.dataset.category;
            exploreState.level = 'cases';
            exploreState.searchQuery = '';
            exploreState.expandedPuzzles.add(exploreState.puzzle);
            renderTreeMenu(db);
            const appView = document.getElementById('app-view');
            if (appView) {
                renderExploreContent(appView, db, window.__CUBASE_PROGRESS__ || {});
            }
        });
    });
}

function renderExploreContent(container, db, progress) {
    const content = container.querySelector('#explore-content');
    if (!content) return;

    if (exploreState.level === 'puzzles') {
        const puzzles = Object.keys(db);
        content.innerHTML = `
            <div class="mb-4">
                <div class="text-xl font-bold font-serif">Choose Puzzle Type</div>
                <div class="text-sm text-light-muted dark:text-dark-muted">Select a puzzle to continue.</div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" id="puzzle-grid"></div>
        `;
        const puzzleGrid = content.querySelector('#puzzle-grid');
        puzzles.forEach(p => {
            const count = Object.keys(db[p] || {}).length;
            const item = document.createElement('button');
            item.className = 'text-left p-4 border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface hover:bg-light-hover dark:hover:bg-dark-hover';
            item.innerHTML = `
                <div class="text-lg font-bold ">${p}</div>
                <div class="text-sm text-light-muted dark:text-dark-muted">${count} categories</div>
            `;
            item.addEventListener('click', () => {
                exploreState.puzzle = p;
                const categories = Object.keys(db[p] || {});
                exploreState.category = null;
                exploreState.level = 'categories';
                exploreState.searchQuery = '';
                exploreState.expandedPuzzles.add(p);
                renderTreeMenu(db);
                renderExploreContent(container, db, progress);
            });
            puzzleGrid.appendChild(item);
        });
        return;
    }

    if (!exploreState.puzzle) {
        content.innerHTML = '<p class="text-light-muted dark:text-dark-muted">No puzzles available.</p>';
        return;
    }

    if (exploreState.level === 'categories') {
        const categories = Object.keys(db[exploreState.puzzle] || {});
        content.innerHTML = `
            <div class="mb-4 flex items-center justify-between">
                <div>
                    <button id="back-to-puzzles" class="text-sm text-light-muted dark:text-dark-muted hover:underline mb-1">Back to puzzle types</button>
                    <div class="text-xl font-bold">${exploreState.puzzle} Categories</div>
                </div>
                <div class="text-sm text-light-muted dark:text-dark-muted">${categories.length} categories</div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" id="category-grid"></div>
        `;

        const categoryGrid = content.querySelector('#category-grid');
        categories.forEach(c => {
            const size = ((db[exploreState.puzzle] || {})[c] || []).length;
            const item = document.createElement('button');
            item.className = 'text-left p-4 border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface hover:bg-light-hover dark:hover:bg-dark-hover';
            item.innerHTML = `
                <div class="text-lg font-bold">${c}</div>
                <div class="text-sm text-light-muted dark:text-dark-muted">${size} cases</div>
            `;
            item.addEventListener('click', () => {
                exploreState.category = c;
                exploreState.level = 'cases';
                exploreState.searchQuery = '';
                renderTreeMenu(db);
                renderExploreContent(container, db, progress);
            });
            categoryGrid.appendChild(item);
        });

        const backBtn = content.querySelector('#back-to-puzzles');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                exploreState.level = 'puzzles';
                exploreState.puzzle = null;
                exploreState.category = null;
                exploreState.expandedPuzzles.clear();
                renderTreeMenu(db);
                renderExploreContent(container, db, progress);
            });
        }
        return;
    }

    if (!exploreState.category) {
        content.innerHTML = '<p class="text-light-muted dark:text-dark-muted">No categories available for this puzzle.</p>';
        return;
    }

    const allCases = (db[exploreState.puzzle] && db[exploreState.puzzle][exploreState.category]) || [];
    const cases = filterCasesByQuery(allCases, exploreState.searchQuery);
    content.innerHTML = `
        <div class="mb-4 flex items-center justify-between">
            <div>
                <button id="back-to-categories" class="text-sm text-light-muted dark:text-dark-muted hover:underline mb-1">Back to categories</button>
                <div class="text-sm text-light-muted dark:text-dark-muted">${exploreState.puzzle} / ${exploreState.category}</div>
                <div class="text-xl font-bold">${exploreState.category} Cases</div>
            </div>
            <div class="text-sm text-light-muted dark:text-dark-muted">${cases.length} / ${allCases.length} cases</div>
        </div>
        <div class="mb-4">
            <input
                id="explore-search"
                type="text"
                value="${exploreState.searchQuery.replace(/"/g, '&quot;')}"
                placeholder="Search by case name / subgroup / algorithm"
                class="w-full px-3 py-2 border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface text-light-text dark:text-dark-text font-serif focus:outline-none"
            />
        </div>
        <div id="explore-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"></div>
    `;

    const grid = content.querySelector('#explore-grid');
    cases.forEach(caseData => {
        const key = `${exploreState.puzzle}|${caseData.name}`;
        const userProg = progress[key] || {};
        const mainAlg = userProg.main_alg || caseData.algorithms[0].alg;
        const card = createCaseCard(exploreState.puzzle, exploreState.category, caseData, mainAlg);
        grid.appendChild(card);
        render2D(card, caseData, exploreState.puzzle, mainAlg);
    });

    const searchInput = content.querySelector('#explore-search');
    if (searchInput) {
        if (exploreState.restoreSearchFocus) {
            const nextValue = searchInput.value.length;
            searchInput.focus();
            searchInput.setSelectionRange(nextValue, nextValue);
            exploreState.restoreSearchFocus = false;
        }
        searchInput.addEventListener('input', (e) => {
            exploreState.searchQuery = e.target.value || '';
            exploreState.restoreSearchFocus = true;
            renderExploreContent(container, db, progress);
        });
    }

    const backToCategories = content.querySelector('#back-to-categories');
    if (backToCategories) {
        backToCategories.addEventListener('click', () => {
            exploreState.level = 'categories';
            exploreState.category = null;
            renderTreeMenu(db);
            renderExploreContent(container, db, progress);
        });
    }
}

function createCaseCard(cat, sub, caseData, mainAlg) {
    const safeKey = `${cat}-${sub}-${caseData.name}`.replace(/[^a-zA-Z0-9_-]/g, '-');
    const playerId = `cube3d-${safeKey}`;
    const panelId = `panel-${safeKey}`;
    const div = document.createElement('div');
    div.className = "case-card bg-light-surface dark:bg-dark-surface flex flex-col border border-light-border dark:border-dark-border rounded-lg relative";
    div.innerHTML = `
        <div class="flex-1 p-4 flex flex-col">
            <div class="flex">
                <div class="w-24 h-24 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border" id="cube2d-${caseData.name.replace(/\s+/g, '-')}">
                    <!-- SVG injected here -->
                </div>
                <div class="ml-4 flex-1">
                    <div class="flex justify-between items-start">
                        <h3 class="font-bold text-lg">${caseData.name}</h3>
                        ${caseData.subgroup ? `<span class="text-xs font-medium px-2 py-1 border border-light-border dark:border-dark-border rounded">${caseData.subgroup}</span>` : ''}
                    </div>
                    <p class="text-xs text-light-muted dark:text-dark-muted mt-1 ">Scramble: <code class="bg-light-hover dark:bg-dark-hover px-1 scramble-text" data-alg="${mainAlg}">Calculating...</code></p>
                    
                    <div class="mt-3 space-y-2">
                        ${caseData.algorithms.map((a, idx) => `
                                                <div data-alg-row="${idx}" data-alg="${a.alg}" class="text-sm p-2 bg-light-hover dark:bg-dark-hover border ${a.alg === mainAlg ? 'border-2 border-yellow-400 dark:border-yellow-500' : 'border border-transparent hover:border-black dark:hover:border-dark-border'} transition cursor-pointer flex justify-between items-center group">
                                <span class="font-mono text-xs break-all mr-2">${a.alg}</span>
                                <div class="flex space-x-1 opacity-0 group-hover:opacity-100 transition">
                                                        <button class="p-1 hover:text-yellow-500" title="Set as Main" data-action="main" data-alg="${a.alg}"><i class="fa-solid fa-star text-light-muted dark:text-dark-muted ${a.alg === mainAlg ? 'text-yellow-500' : ''}"></i></button>
                                                        <button class="p-1 hover:text-black dark:hover:text-white" title="Add to Set" data-action="add" data-alg="${a.alg}"><i class="fa-solid fa-plus text-light-muted dark:text-dark-muted"></i></button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
        <div class="bg-light-hover dark:bg-dark-hover px-4 py-2 border-t border-light-border dark:border-dark-border flex justify-between items-center mt-auto">
                                 <button class="text-light-text dark:text-dark-text text-sm font-medium hover:underline" data-open-3d="main">
                <i class="fa-solid fa-video mr-1 text-light-muted dark:text-dark-muted"></i> 3D View
             </button>
                                 <button class="flex items-center text-sm text-light-muted dark:text-dark-muted hover:text-green-500 ">
                <i class="fa-regular fa-circle-check mr-1"></i> <span>Learned</span>
             </button>
        </div>
                            <div id="${panelId}" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 hidden backdrop-blur-sm" style="position: fixed !important;">
                    <div class="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border shadow-2xl w-[95vw] max-w-5xl h-[85vh] flex flex-col rounded-xl overflow-hidden relative">
                        <div class="px-5 py-4 border-b border-light-border dark:border-dark-border flex items-center justify-between bg-light-menu dark:bg-dark-surface shrink-0">
                            <div class="font-bold text-lg"><i class="fa-solid fa-cube mr-2"></i>${caseData.name} - 3D View</div>
                            <button type="button" class="w-8 h-8 flex items-center justify-center rounded-full text-light-muted dark:text-dark-muted hover:bg-light-hover dark:hover:bg-dark-hover hover:text-black dark:hover:text-white transition" data-3d-close>
                                <i class="fa-solid fa-xmark fa-lg"></i>
                            </button>
                        </div>
                        <div class="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
                            <!-- Left: 3D Canvas Area -->
                            <div class="flex-1 h-[50vh] lg:h-full border-b lg:border-b-0 lg:border-r border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg relative overflow-hidden">
                                <div id="${playerId}" class="absolute inset-0 w-full h-full"></div>
                            </div>
                            
                            <!-- Right: Controls Sidebar -->
                            <div class="w-full lg:w-80 flex-shrink-0 bg-light-surface dark:bg-dark-surface p-5 flex flex-col gap-6 overflow-y-auto z-10">
                                <div>
                                    <div class="text-xs font-bold text-light-muted dark:text-dark-muted uppercase tracking-wider mb-2">Algorithm</div>
                                    <div class="text-sm font-mono break-all font-semibold p-3 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded" data-3d-sequence>${mainAlg}</div>
                                </div>
                                
                                <div class="grid grid-cols-5 gap-2">
                                    <button type="button" class="col-span-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold shadow transition flex justify-center items-center gap-2" data-3d-play><i class="fa-solid fa-play"></i> Play</button>
                                    <button type="button" class="py-2 border border-light-border dark:border-dark-border hover:bg-light-hover dark:hover:bg-dark-hover rounded font-bold transition flex justify-center items-center shadow-sm bg-light-surface dark:bg-dark-surface col-span-1" title="Pause" data-3d-pause><i class="fa-solid fa-pause"></i></button>
                                    <button type="button" class="py-2 border border-light-border dark:border-dark-border hover:bg-light-hover dark:hover:bg-dark-hover rounded font-bold transition flex justify-center items-center shadow-sm bg-light-surface dark:bg-dark-surface col-span-1" title="Reset" data-3d-reset><i class="fa-solid fa-rotate-left"></i></button>
                                    <button type="button" class="py-2 border border-light-border dark:border-dark-border hover:bg-light-hover dark:hover:bg-dark-hover rounded font-bold transition flex justify-center items-center shadow-sm bg-light-surface dark:bg-dark-surface col-span-1" title="Back" data-3d-back><i class="fa-solid fa-backward-step"></i></button>
                                    <button type="button" class="py-2 border border-light-border dark:border-dark-border hover:bg-light-hover dark:hover:bg-dark-hover rounded font-bold transition flex justify-center items-center shadow-sm bg-light-surface dark:bg-dark-surface col-span-2" title="Forward" data-3d-forward><i class="fa-solid fa-forward-step mr-2"></i> Next</button>
                                </div>

                                <div>
                                    <label class="block text-xs font-bold text-light-muted dark:text-dark-muted uppercase tracking-wider mb-2">Playback Speed</label>
                                    <input type="range" min="50" max="1200" step="50" value="300" class="w-full cursor-pointer accent-blue-500" data-3d-speed>
                                </div>
                                
                                <div class="mt-auto pt-4 border-t border-light-border dark:border-dark-border">
                                    <div class="text-sm font-bold text-center bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border py-2 rounded-full" data-3d-progress>0 / 0 moves</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
    `;

                        const state = {
                            ui: null,
                            moves: buildMoveList(mainAlg, getCubeSizeFromPuzzle(cat)),
                            currentIndex: 0,
                            activeAlg: mainAlg,
                            size: getCubeSizeFromPuzzle(cat),
                            playerId,
                            panelId
                        };

                        bind3DPlayer(div, state, caseData.name);

    return div;
}

function render2D(card, caseData, puzzleKey, mainAlg) {
    const containerId = `cube2d-${caseData.name.replace(/\s+/g, '-')}`;
    const cubeSize = getCubeSizeFromPuzzle(puzzleKey);
    
    // Generate Scramble: Inverse of the algorithm
    const scramble = invertSeq(mainAlg);
    
    // Update scramble text in UI
    const code = card.querySelector('.scramble-text');
    code.textContent = scramble;

    const cube = new Cube(cubeSize);
    // Apply scramble
    scramble.split(/\s+/).forEach(move => cube.applyMove(move));
    
    const ui = new Cube2DUI(containerId, cube);
    ui.render();
}

function buildMoveList(alg, size) {
    const validator = new Cube(size || 3);
    const expanded = expandAlg(alg);
    return expanded.trim().split(/\s+/).filter(move => move && validator.parseMove(move) !== null);
}

function bind3DPlayer(card, state, caseTitle) {
    const panel = card.querySelector(`#${state.panelId}`);
    const viewer = card.querySelector(`#${state.playerId}`);
    const sequenceLabel = card.querySelector('[data-3d-sequence]');
    const progressLabel = card.querySelector('[data-3d-progress]');
    const speedInput = card.querySelector('[data-3d-speed]');
    const openButton = card.querySelector('[data-open-3d]');
    const playButton = card.querySelector('[data-3d-play]');
    const pauseButton = card.querySelector('[data-3d-pause]');
    const backButton = card.querySelector('[data-3d-back]');
    const forwardButton = card.querySelector('[data-3d-forward]');
    const resetButton = card.querySelector('[data-3d-reset]');
    const closeButton = card.querySelector('[data-3d-close]');

    const updateProgress = () => {
        if (progressLabel) {
            progressLabel.textContent = `${state.currentIndex} / ${state.moves.length}`;
        }
    };

    const destroyUI = () => {
        if (state.ui && typeof state.ui.destroy === 'function') {
            state.ui.destroy();
        }
        state.ui = null;
    };

    const renderAtIndex = (index) => {
        destroyUI();
        viewer.innerHTML = '';
        state.currentIndex = Math.max(0, Math.min(index, state.moves.length));
        state.ui = new Cube3DUI(state.playerId, state.size);
        state.ui.animationDuration = Number(speedInput?.value || 300);
        for (const move of state.moves.slice(0, state.currentIndex)) {
            state.ui.cube.applyMove(move);
        }
        state.ui.updateDOMTransforms();
        state.ui.onMoveFinished = () => {
            state.currentIndex = Math.min(state.currentIndex + 1, state.moves.length);
            updateProgress();
        };
        updateProgress();
    };

    const openPanel = (alg) => {
        state.activeAlg = alg;
        state.moves = buildMoveList(alg, state.size);
        sequenceLabel.textContent = alg;
        panel.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        renderAtIndex(0);
    };

    const stopAndRender = (nextIndex) => {
        if (state.ui) state.ui.stop();
        renderAtIndex(nextIndex);
    };

    openButton?.addEventListener('click', () => openPanel(state.activeAlg));

    card.querySelectorAll('[data-alg-row]').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            const alg = row.dataset.alg;
            openPanel(alg);
        });
    });

    card.querySelectorAll('[data-action]').forEach(button => {
        button.addEventListener('click', (e) => e.stopPropagation());
    });

    playButton?.addEventListener('click', () => {
        if (!panel || panel.classList.contains('hidden')) {
            openPanel(state.activeAlg);
        }
        if (!state.ui) renderAtIndex(state.currentIndex);
        if (state.ui.isPaused) {
            state.ui.resume();
            return;
        }
        if (state.currentIndex >= state.moves.length) {
            renderAtIndex(0);
        }
        const remaining = state.moves.slice(state.currentIndex);
        if (!remaining.length) return;
        state.ui.playSequence(remaining.join(' '));
    });

    pauseButton?.addEventListener('click', () => {
        if (state.ui) state.ui.pause();
    });

    backButton?.addEventListener('click', () => {
        stopAndRender(state.currentIndex - 1);
    });

    forwardButton?.addEventListener('click', () => {
        stopAndRender(state.currentIndex + 1);
    });

    resetButton?.addEventListener('click', () => {
        stopAndRender(0);
    });

    speedInput?.addEventListener('input', (e) => {
        const speed = Number(e.target.value || 300);
        if (state.ui) state.ui.animationDuration = speed;
    });

    closeButton?.addEventListener('click', () => {
        if (state.ui) state.ui.stop();
        panel.classList.add('hidden');
        document.body.style.overflow = '';
    });
}
