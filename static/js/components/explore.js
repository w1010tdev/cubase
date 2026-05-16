import { Cube, expandAlg, invertSeq } from '/cubejs/cube.js';
import { Cube2DUI } from '/cubejs/ui-2d.js';
import { Cube3DUI } from '/cubejs/ui-3d.js';

const exploreState = {
    puzzle: null,
    category: null,
    level: 'puzzles',
    searchQuery: '',
    expandedPuzzles: new Set(),
    restoreSearchFocus: false,
    showArrows: true
};

/* ---- Global 3D Modal Singleton ---- */
const _3dModal = (() => {
    let _init = false, _panel, _player, _titleEl, _seqEl, _progEl, _tagsEl;
    let _speedIn, _speedDisp;
    let _playBtn, _backBtn, _fwdBtn, _resetBtn, _closeBtn, _bracketToggle, _bracketThumb;
    let _ui = null, _moves = [], _curIdx = 0, _size = 3, _playOffset = 0, _bracketPause = true, _algorithm = '', _caseName = '', _puzzleSize = 3;

    function _updatePlayBtn() {
        if (!_playBtn) return;
        if (_ui && _ui.isPaused) {
            _playBtn.innerHTML = '<i class="fa-solid fa-play"></i> Continue';
            _playBtn.className = 'col-span-5 py-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-md transition flex justify-center items-center gap-2 text-lg active:scale-[0.98]';
        } else if (_curIdx >= _moves.length && _moves.length > 0) {
            _playBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Reset';
            _playBtn.className = 'col-span-5 py-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-bold shadow-md transition flex justify-center items-center gap-2 text-lg active:scale-[0.98]';
        } else if (_ui && _ui.isPlaying) {
            _playBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
            _playBtn.className = 'col-span-5 py-4 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-bold shadow-md transition flex justify-center items-center gap-2 text-lg active:scale-[0.98]';
        } else {
            _playBtn.innerHTML = '<i class="fa-solid fa-play"></i> Play';
            _playBtn.className = 'col-span-5 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md transition flex justify-center items-center gap-2 text-lg active:scale-[0.98]';
        }
    }

    function _initDOM() {
        if (_init) return;
        _init = true;
        _panel = document.createElement('div');
        _panel.id = 'global-3d-panel';
        _panel.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/80 hidden backdrop-blur-sm';
        _panel.style.position = 'fixed';
        _panel.innerHTML = [
            '<div class="bg-light-surface dark:bg-dark-surface w-full h-full flex flex-col relative overflow-hidden">',
            '  <div class="px-5 py-4 border-b border-light-border dark:border-dark-border flex items-center justify-between bg-light-menu dark:bg-dark-surface shrink-0 z-20 shadow-md">',
            '    <div class="font-bold text-lg flex items-center"><i class="fa-solid fa-cube mr-3 text-blue-500"></i><span id="g3d-title"></span> - 3D View</div>',
            '    <button type="button" class="w-10 h-10 flex items-center justify-center rounded-full text-light-muted dark:text-dark-muted hover:bg-light-hover dark:hover:bg-dark-hover hover:text-red-500 transition" id="g3d-close"><i class="fa-solid fa-xmark fa-xl"></i></button>',
            '  </div>',
            '  <div class="flex-1 flex flex-col lg:flex-row overflow-hidden relative w-full h-full">',
            '    <div class="flex-1 h-full border-b lg:border-b-0 lg:border-r border-light-border dark:border-dark-border bg-gradient-to-b from-gray-100 to-gray-300 dark:from-gray-800 dark:to-gray-900 relative overflow-hidden flex items-center justify-center cursor-move touch-none">',
            '      <div id="g3d-player" class="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden" style="perspective:1000px"></div>',
            '      <div class="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full text-sm font-medium backdrop-blur-md opacity-70 pointer-events-none"><i class="fa-solid fa-hand-pointer mr-2"></i> Drag to rotate cube</div>',
            '    </div>',
            '    <div class="w-full lg:w-[400px] flex-shrink-0 bg-light-surface dark:bg-dark-surface p-6 flex flex-col gap-8 overflow-y-auto z-10 shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.1)]">',
            '      <div>',
            '        <div class="text-sm font-bold text-light-muted dark:text-dark-muted uppercase tracking-widest mb-3">Algorithm</div>',
            '        <div class="text-base font-mono break-all font-semibold p-4 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg shadow-inner" id="g3d-seq"></div>',
            '      </div>',
            '      <div class="grid grid-cols-5 gap-3">',
            '        <button type="button" class="col-span-5 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md transition flex justify-center items-center gap-2 text-lg active:scale-[0.98]" id="g3d-play"><i class="fa-solid fa-play"></i> Play</button>',
            '        <button type="button" class="py-3 border border-light-border dark:border-dark-border hover:bg-light-hover dark:hover:bg-dark-hover rounded-lg font-bold transition flex justify-center items-center shadow-sm bg-light-surface dark:bg-dark-surface col-span-1 active:scale-95" title="Reset" id="g3d-reset"><i class="fa-solid fa-rotate-left"></i></button>',
            '        <button type="button" class="py-3 border border-light-border dark:border-dark-border hover:bg-light-hover dark:hover:bg-dark-hover rounded-lg font-bold transition flex justify-center items-center shadow-sm bg-light-surface dark:bg-dark-surface col-span-1 active:scale-95" title="Back" id="g3d-back"><i class="fa-solid fa-backward-step"></i></button>',
            '        <button type="button" class="py-3 border border-light-border dark:border-dark-border hover:bg-light-hover dark:hover:bg-dark-hover rounded-lg font-bold transition flex justify-center items-center shadow-sm bg-light-surface dark:bg-dark-surface col-span-3 active:scale-95" title="Forward" id="g3d-fwd"><i class="fa-solid fa-forward-step mr-2"></i> Next</button>',
            '      </div>',
            '      <div class="bg-light-bg dark:bg-dark-bg p-4 rounded-lg border border-light-border dark:border-dark-border">',
            '        <div class="flex justify-between items-center mb-3">',
            '          <label class="text-sm font-bold text-light-muted dark:text-dark-muted uppercase tracking-widest">Speed</label>',
            '          <span class="text-xs font-mono bg-light-surface dark:bg-dark-surface px-2 py-1 rounded" id="g3d-speed-display">300ms</span>',
            '        </div>',
            '        <input type="range" min="50" max="1200" step="50" value="300" class="w-full cursor-pointer accent-blue-500" id="g3d-speed">',
            '      </div>',
            '      <div class="flex items-center justify-between p-3 bg-light-bg dark:bg-dark-bg rounded-lg border border-light-border dark:border-dark-border">',
            '        <span class="text-sm font-medium">括号暂停</span>',
            '        <div class="flex items-center gap-2">',
            '          <span class="text-xs font-mono text-light-muted dark:text-dark-muted" id="g3d-bracket-mode">ON</span>',
            '          <button id="g3d-bracket-pause" class="relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none" style="background-color:#3b82f6">',
            '            <span id="g3d-bracket-thumb" class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200" style="left: 22px;"></span>',
            '          </button>',
            '        </div>',
            '      </div>',
            '      <div class="mt-auto pt-6 border-t border-light-border dark:border-dark-border">',
            '        <div class="flex flex-wrap gap-1 max-h-[90px] overflow-y-auto p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg shadow-inner font-mono text-sm" id="g3d-progress-tags"></div>',
            '        <div class="mt-2 text-sm font-bold text-center font-mono tracking-widest" id="g3d-progress-text">0 / 0</div>',
            '      </div>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('\n');
        document.body.appendChild(_panel);

        _player = _panel.querySelector('#g3d-player');
        _titleEl = _panel.querySelector('#g3d-title');
        _seqEl = _panel.querySelector('#g3d-seq');
        _tagsEl = _panel.querySelector('#g3d-progress-tags');
        _progEl = _panel.querySelector('#g3d-progress-text');
        _speedIn = _panel.querySelector('#g3d-speed');
        _speedDisp = _panel.querySelector('#g3d-speed-display');
        _closeBtn = _panel.querySelector('#g3d-close');
        _playBtn = _panel.querySelector('#g3d-play');
        _resetBtn = _panel.querySelector('#g3d-reset');
        _backBtn = _panel.querySelector('#g3d-back');
        _fwdBtn = _panel.querySelector('#g3d-fwd');
        _bracketToggle = _panel.querySelector('#g3d-bracket-pause');
        _bracketThumb = _panel.querySelector('#g3d-bracket-thumb');

        _closeBtn.addEventListener('click', close);
        _playBtn.addEventListener('click', () => {
            if (!_moves.length) return;
            if (!_ui) { _renderAt(_curIdx); return; }
            if (_ui.isPaused) { _ui.resume(); _updatePlayBtn(); return; }
            if (_ui.isPlaying) { _ui.pause(); _updatePlayBtn(); return; }
            if (_curIdx >= _moves.length) { _renderAt(0); return; }
            _playOffset = _curIdx;
            _ui.playSequence(_moves.slice(_curIdx).join(' '));
            _updatePlayBtn();
        });
        _resetBtn.addEventListener('click', () => _stopAndRender(0));
        _backBtn.addEventListener('click', () => _stopAndRender(_curIdx - 1));
        _fwdBtn.addEventListener('click', () => _stopAndRender(_curIdx + 1));
        _speedIn.addEventListener('input', (e) => {
            const s = Number(e.target.value || 300);
            if (_ui) _ui.animationDuration = s;
            _speedDisp.textContent = `${s}ms`;
        });
        _bracketToggle.addEventListener('click', () => {
            _bracketPause = !_bracketPause;
            _updateBracketToggleUI();
            if (_ui) _ui.stop();
            _buildMoves();
            _curIdx = 0;
            _renderAt(0);
        });
    }

    function _renderProgressTags() {
        if (!_tagsEl) return;
        _tagsEl.innerHTML = '';
        _moves.forEach((move, i) => {
            const span = document.createElement('span');
            span.textContent = move;
            if (move === '(' || move === ')') {
                span.className = 'bracket-tag';
            } else {
                span.className = 'move-tag';
                span.dataset.idx = i;
                if (i < _curIdx) span.classList.add('played');
                else if (i === _curIdx) span.classList.add('current');
            }
            _tagsEl.appendChild(span);
        });
    }

    function _updateProg() {
        const done = _moves.slice(0, _curIdx).filter(m => m !== '(' && m !== ')').length;
        const total = _moves.filter(m => m !== '(' && m !== ')').length;
        _progEl.textContent = `${done} / ${total}`;
        if (!_tagsEl) return;
        _tagsEl.querySelectorAll('.move-tag').forEach(span => {
            const idx = parseInt(span.dataset.idx);
            span.classList.remove('played', 'current');
            if (idx < _curIdx) span.classList.add('played');
            else if (idx === _curIdx) span.classList.add('current');
        });
    }

    function _renderAt(idx) {
        _destroyUI();
        _player.innerHTML = '';
        _curIdx = Math.max(0, Math.min(idx, _moves.length));
        if (!_moves.length) return;
        _ui = new Cube3DUI('g3d-player', _size);
        _ui.animationDuration = Number(_speedIn.value || 300);
        _moves.slice(0, _curIdx).forEach(m => {
            if (m === '(' || m === ')') return;
            _ui.cube.applyMove(m);
        });
        _ui.updateDOMTransforms();
        _playOffset = _curIdx;
        _ui.onProgress = (i) => {
            _curIdx = _playOffset + i;
            _updateProg();
            _updatePlayBtn();
        };
        _updateProg();
        _renderProgressTags();
        _updatePlayBtn();
    }

    function _destroyUI() { if (_ui && typeof _ui.destroy === 'function') _ui.destroy(); _ui = null; }
    function _stopAndRender(n) { if (_ui) _ui.stop(); _renderAt(n); }

    function _buildMoves() {
        _moves = buildMoveList(_algorithm, _size);
        if (!_bracketPause) {
            _moves = _moves.filter(m => m !== '(' && m !== ')');
        }
    }
    function _updateBracketToggleUI() {
        const on = _bracketPause;
        _bracketToggle.style.backgroundColor = on ? '#3b82f6' : '#9ca3af';
        _bracketThumb.style.left = on ? '22px' : '2px';
        const modeEl = _panel.querySelector('#g3d-bracket-mode');
        if (modeEl) modeEl.textContent = on ? 'ON' : 'OFF';
    }

    function open(caseName, puzzleSize, algorithm) {
        _initDOM();
        _caseName = caseName;
        _puzzleSize = puzzleSize;
        _algorithm = algorithm;
        _titleEl.textContent = caseName;
        _seqEl.textContent = algorithm.replace(/\(/g, ' ( ').replace(/\)/g, ' ) ').replace(/\s+/g, ' ').trim();
        _size = puzzleSize;
        _updateBracketToggleUI();
        _buildMoves();
        _curIdx = 0;
        _panel.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        _renderAt(0);
    }

    function close() {
        if (_ui) _ui.stop();
        _destroyUI();
        _panel.classList.add('hidden');
        document.body.style.overflow = '';
    }

    return { open, close };
})();

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
            <div class="flex items-center gap-4">
                <button id="show-arrows-toggle" class="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition ${exploreState.showArrows ? 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300' : 'bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-light-muted dark:text-dark-muted'}">
                    <i class="fa-solid ${exploreState.showArrows ? 'fa-eye' : 'fa-eye-slash'}"></i>
                    跑位图
                </button>
                <div class="text-sm text-light-muted dark:text-dark-muted">${cases.length} / ${allCases.length} cases</div>
            </div>
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
        render2D(card, caseData, exploreState.puzzle, mainAlg, exploreState.showArrows);
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

    const arrowsToggle = content.querySelector('#show-arrows-toggle');
    if (arrowsToggle) {
        arrowsToggle.addEventListener('click', () => {
            exploreState.showArrows = !exploreState.showArrows;
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
                    <p class="text-xs text-light-muted dark:text-dark-muted mt-1">Scramble: <code class="bg-light-hover dark:bg-dark-hover px-1 scramble-text" data-alg="${mainAlg}">Calculating...</code></p>
                    
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
            <button class="text-light-text dark:text-dark-text text-sm font-medium hover:underline" data-open-3d>
                <i class="fa-solid fa-video mr-1 text-light-muted dark:text-dark-muted"></i> 3D View
            </button>
            <button class="flex items-center text-sm text-light-muted dark:text-dark-muted hover:text-green-500">
                <i class="fa-regular fa-circle-check mr-1"></i> <span>Learned</span>
            </button>
        </div>
    `;

    const state = { activeAlg: mainAlg, size: getCubeSizeFromPuzzle(cat) };
    bind3DPlayer(div, state, caseData.name);
    return div;
}

function render2D(card, caseData, puzzleKey, mainAlg, showArrows) {
    const containerId = `cube2d-${caseData.name.replace(/\s+/g, '-')}`;
    const cubeSize = getCubeSizeFromPuzzle(puzzleKey);
    
    // Expand first so invertSeq handles parens as separate tokens
    const expanded = expandAlg(mainAlg);
    const scramble = invertSeq(expanded);
    
    // Update scramble text in UI
    const code = card.querySelector('.scramble-text');
    code.textContent = scramble;

    const cube = new Cube(cubeSize);
    scramble.split(/\s+/).forEach(move => {
        if (move === '(' || move === ')') return;
        cube.applyMove(move);
    });
    
    const ui = new Cube2DUI(containerId, cube);
    if (showArrows) ui.showArrows = true;
    ui.render();
}

function buildMoveList(alg, size) {
    const validator = new Cube(size || 3);
    const expanded = expandAlg(alg);
    return expanded.trim().split(/\s+/).filter(move => {
        if (!move) return false;
        if (move === '(' || move === ')') return true;
        return validator.parseMove(move) !== null;
    });
}

function bind3DPlayer(card, state, caseTitle) {
    const size = state.size;
    const defaultAlg = state.activeAlg;

    card.querySelector('[data-open-3d]')?.addEventListener('click', () => {
        _3dModal.open(caseTitle, size, defaultAlg);
    });

    card.querySelectorAll('[data-alg-row]').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            _3dModal.open(caseTitle, size, row.dataset.alg);
        });
    });

    card.querySelectorAll('[data-action]').forEach(button => {
        button.addEventListener('click', (e) => e.stopPropagation());
    });
}
