import { Cube, expandAlg, invertSeq, generateScramble } from '/cubejs/cube.js';
import { Cube3DUI } from '/cubejs/ui-3d.js';

/* ---- State ---- */
const state = {
    ui: null,
    size: 3,
    moves: [],
    currentIdx: 0,
    speed: 300,
    importInfo: null,
    animationEnabled: true,
    playOffset: 0,
    baseScramble: null,  // set on import — Reset returns to this scramble state
    bracketPause: true,  // pause playback at parentheses boundaries
    algString: '',       // raw alg text for bracket-pause rebuilding
};

/* ---- Cancellation token — prevents stale async side-effects ---- */
let _gen = 0;

/* ---- Helpers ---- */
function buildMoveList(alg) {
    try {
        const expanded = expandAlg(alg);
        return expanded.trim().split(/\s+/).filter(m => m !== '');
    } catch (e) {
        console.error('Invalid algorithm', e);
        return [];
    }
}

function stopPlayback() {
    if (state.ui) {
        state.ui.stop();
        state.ui.isPaused = false;
    }
    state.animating = false;
    _gen++;
}

function replayTo(index) {
    stopPlayback();
    const targetIdx = Math.max(0, Math.min(index, state.moves.length));
    state.ui.cube.reset();
    for (let i = 0; i < targetIdx; i++) {
        const m = state.moves[i];
        if (m === '(' || m === ')') continue;
        state.ui.cube.applyMove(m);
    }
    state.ui.updateDOMTransforms();
    state.currentIdx = targetIdx;
    updateUI();
}

function hideImportInfo() {
    const banner = document.getElementById('pg-import-info');
    if (banner) banner.classList.add('hidden');
}

function showScrambleInfo(text) {
    const el = document.getElementById('pg-scramble-info');
    const textEl = document.getElementById('pg-scramble-text');
    if (el && textEl) {
        el.classList.remove('hidden');
        textEl.textContent = text;
    }
}

function hideScrambleInfo() {
    const el = document.getElementById('pg-scramble-info');
    if (el) el.classList.add('hidden');
}

/** Reset the cube to the base scramble state (imported case) */
function replayBaseState() {
    if (!state.baseScramble || !state.baseScramble.length) return;
    state.ui.cube.reset();
    state.baseScramble.forEach(m => {
        if (m !== '(' && m !== ')') state.ui.cube.applyMove(m);
    });
    state.ui.updateDOMTransforms();
    state.currentIdx = 0;
    updateUI();
}

/**
 * Inverse a single move for animated step-back.
 *   R  → R'    R' → R     R2 → R2    R2' → R2'
 */
function invertSingleMove(m) {
    if (m.endsWith("2'")) return m;       // R2' self-inverse
    if (m.endsWith("'")) return m.slice(0, -1);  // R' → R
    if (m.endsWith("2")) return m;        // R2 self-inverse
    return m + "'";                       // R → R'
}

/** Rebuild state.moves from state.algString, respecting bracketPause */
function rebuildMoves() {
    if (!state.algString) return;
    const tokens = buildMoveList(state.algString);
    state.moves = state.bracketPause ? tokens : tokens.filter(m => m !== '(' && m !== ')');
}

/* ---- Play Button State Machine ---- */
async function handlePlayButton() {
    const input = document.getElementById('pg-alg-input');
    const alg = input.value.trim();

    // PLAYING → Pause
    if (state.ui.isPlaying && !state.ui.isPaused) {
        state.ui.pause();
        updateUI();
        return;
    }

    // PAUSED → Resume
    if (state.ui.isPaused) {
        state.ui.resume();
        updateUI();
        return;
    }

    // If input changed, update state.algString
    if (alg !== state.algString && alg) {
        await applyNewAlgAndPlay(alg, true);
    } else {
        if (state.moves.length === 0) return;
        if (state.currentIdx >= state.moves.length) {
            if (state.baseScramble) {
                replayBaseState();
            } else {
                state.currentIdx = 0;
            }
        }
        await startPlayback();
    }
}

async function applyNewAlgAndPlay(alg, resetCube = true) {
    if (!alg.trim()) return;
    stopPlayback();
    
    state.algString = alg;
    rebuildMoves();
    state.currentIdx = 0;

    if (resetCube) {
        if (state.baseScramble) {
            replayBaseState();
        } else {
            state.ui.cube.reset();
            state.ui.updateDOMTransforms();
        }
    } else {
        state.baseScramble = null;
        hideScrambleInfo();
    }

    updateUI();

    await startPlayback();
}

async function startPlayback() {
    if (state.currentIdx >= state.moves.length) return;

    const gen = _gen;

    if (state.animationEnabled) {
        state.playOffset = state.currentIdx;
        const remaining = state.moves.slice(state.playOffset).join(' ');

        state.ui.onProgress = (idx) => {
            if (gen !== _gen) { state.ui.stop(); return; }
            if (state.ui.isPlaying || state.ui.isPaused) {
                state.currentIdx = state.playOffset + idx;
                updateTagsProgress();
                updateProgressText();
                updatePlayBtn();
            }
        };

        try {
            await state.ui.playSequence(remaining);
        } catch (_) { /* stopped */ }

        if (gen !== _gen) return;
        state.currentIdx = state.moves.length;
        updateUI();
    } else {
        // Instant playback — batch all remaining moves
        const valid = state.moves.slice(state.currentIdx).filter(m => m !== '(' && m !== ')');
        valid.forEach(m => state.ui.cube.applyMove(m));
        state.ui.updateDOMTransforms();
        state.currentIdx = state.moves.length;
        updateUI();
    }
}

/* ---- Scramble ---- */
async function doScramble() {
    stopPlayback();
    const scramble = generateScramble(state.size);
    const input = document.getElementById('pg-alg-input');
    if (input) input.value = scramble;

    // Play scramble from current state
    await applyNewAlgAndPlay(scramble, false);
}

/* ---- Step Forward / Back ---- */
async function stepForward() {
    if (state.animating || state.currentIdx >= state.moves.length) return;
    stopPlayback();

    const m = state.moves[state.currentIdx];
    if (m === '(' || m === ')') {
        state.currentIdx++;
        updateUI();
        return;
    }

    const gen = _gen;
    state.animating = true;

    if (state.animationEnabled) {
        await state.ui.animateMove(m);
    } else {
        state.ui.cube.applyMove(m);
        state.ui.updateDOMTransforms();
    }

    if (gen !== _gen) return; // cancelled by another action
    state.currentIdx++;
    state.animating = false;
    updateUI();
}

async function stepBack() {
    if (state.animating || state.currentIdx <= 0) return;
    stopPlayback();

    const m = state.moves[state.currentIdx - 1];
    if (m === '(' || m === ')') {
        state.currentIdx--;
        updateUI();
        return;
    }

    if (state.animationEnabled) {
        const inverse = invertSingleMove(m);
        const gen = _gen;
        state.animating = true;
        await state.ui.animateMove(inverse);
        if (gen !== _gen) return;
        state.currentIdx--;
        state.animating = false;
        updateUI();
    } else {
        replayTo(state.currentIdx - 1);
    }
}

/* ---- Update UI ---- */
function updatePlayBtn() {
    const btn = document.getElementById('pg-play-btn');
    if (!btn) return;
    const icon = btn.querySelector('i');
    const text = btn.querySelector('span');

    if (state.ui && state.ui.isPlaying && state.ui.isPaused) {
        icon.className = 'fa-solid fa-play text-sm';
        text.textContent = 'Continue';
        btn.className = 'col-span-2 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-bold transition flex items-center justify-center gap-1.5 text-xs active:scale-95';
    } else if (state.ui && state.ui.isPlaying) {
        icon.className = 'fa-solid fa-pause text-sm';
        text.textContent = 'Pause';
        btn.className = 'col-span-2 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded font-bold transition flex items-center justify-center gap-1.5 text-xs active:scale-95';
    } else if (state.currentIdx >= state.moves.length && state.moves.length > 0) {
        icon.className = 'fa-solid fa-rotate-left text-sm';
        text.textContent = 'Replay';
        btn.className = 'col-span-2 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded font-bold transition flex items-center justify-center gap-1.5 text-xs active:scale-95';
    } else {
        icon.className = 'fa-solid fa-play text-sm';
        text.textContent = 'Play';
        btn.className = 'col-span-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold transition flex items-center justify-center gap-1.5 text-xs active:scale-95';
    }
}

function renderProgressTags() {
    const tagsEl = document.getElementById('pg-progress-tags');
    if (!tagsEl) return;
    tagsEl.innerHTML = '';
    state.moves.forEach((move, i) => {
        const span = document.createElement('span');
        span.textContent = move;
        if (move === '(' || move === ')') {
            span.className = 'bracket-tag';
        } else {
            span.className = 'move-tag';
            span.dataset.idx = i;
            if (i < state.currentIdx) span.classList.add('played');
            else if (i === state.currentIdx) span.classList.add('current');
        }
        tagsEl.appendChild(span);
    });
}

function updateTagsProgress() {
    const tagsEl = document.getElementById('pg-progress-tags');
    if (!tagsEl) return;
    tagsEl.querySelectorAll('.move-tag').forEach(span => {
        const idx = parseInt(span.dataset.idx);
        span.classList.remove('played', 'current');
        if (idx < state.currentIdx) span.classList.add('played');
        else if (idx === state.currentIdx) span.classList.add('current');
    });
}

function updateProgressText() {
    const progEl = document.getElementById('pg-progress-text');
    if (!progEl) return;
    const done = state.moves.slice(0, state.currentIdx).filter(m => m !== '(' && m !== ')').length;
    const total = state.moves.filter(m => m !== '(' && m !== ')').length;
    progEl.textContent = `${done} / ${total}`;
}

function updateUI() {
    updatePlayBtn();
    renderProgressTags();
    updateProgressText();
}

/* ---- Check Import from Explore ---- */
function checkImport() {
    try {
        const raw = localStorage.getItem('cubase_playground_import');
        if (!raw) return false;
        localStorage.removeItem('cubase_playground_import');
        const data = JSON.parse(raw);
        if (!data || !data.alg) return false;
        const { alg, size, caseName } = data;
        state.size = size || 3;

        // Algorithm = the solution (what user wants to practise)
        const expanded = expandAlg(alg);

        // Scramble = inverse of the algorithm = the case state
        const scrambleStr = invertSeq(expanded);
        const scrambleTokens = scrambleStr.trim().split(/\s+/).filter(m => {
            if (!m) return false;
            if (m === '(' || m === ')') return false;
            return true;
        });

        // Store algorithm string and rebuild moves (respects bracketPause)
        state.algString = alg;
        rebuildMoves();
        state.currentIdx = 0;
        state.baseScramble = scrambleTokens.length ? scrambleTokens : null;

        // Apply scramble to cube (starting scrambled)
        if (state.baseScramble) {
            state.ui.cube.reset();
            state.baseScramble.forEach(m => state.ui.cube.applyMove(m));
            state.ui.updateDOMTransforms();
        }

        // Put formula in input so it tracks progress
        const input = document.getElementById('pg-alg-input');
        if (input) input.value = alg;

        // Import banner
        const banner = document.getElementById('pg-import-info');
        const nameEl = document.getElementById('pg-import-name');
        if (banner && nameEl) {
            banner.classList.remove('hidden');
            nameEl.textContent = caseName || 'Imported Case';
        }

        // Scramble label
        if (state.baseScramble) {
            showScrambleInfo(state.baseScramble.join(' '));
        }

        updateUI();
        return true;
    } catch (e) {
        console.error('Import error', e);
        return false;
    }
}

/* ---- HTML Builder ---- */
function buildHTML() {
    return `
        <div class="flex flex-col lg:flex-row h-full gap-0">
            <!-- Left: 3D Cube -->
            <div class="flex-1 relative bg-gradient-to-b from-gray-100 to-gray-300 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center cursor-move touch-none min-h-0" style="min-height:400px;">
                <div id="playground-cube" class="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden" style="perspective:1000px"></div>
                <div class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-md opacity-60 pointer-events-none whitespace-nowrap">
                    <i class="fa-solid fa-hand-pointer mr-1"></i> Drag to rotate
                </div>
            </div>
            <!-- Right: Control Panel -->
            <div id="playground-panel" class="w-full lg:w-80 xl:w-96 flex-shrink-0 bg-light-surface dark:bg-dark-surface border-t lg:border-t-0 lg:border-l border-light-border dark:border-dark-border p-4 flex flex-col gap-3 overflow-y-auto max-h-[50vh] lg:max-h-full">
                
                <!-- Import Info Banner -->
                <div id="pg-import-info" class="hidden p-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs">
                    <div class="flex items-center justify-between">
                        <span><i class="fa-solid fa-arrow-right-to-bracket mr-1.5 text-blue-500"></i>Imported: <strong id="pg-import-name" class="font-mono"></strong></span>
                        <button id="pg-import-close" class="text-light-muted dark:text-dark-muted hover:text-red-500 ml-2"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                </div>

                <!-- Scramble Info -->
                <div id="pg-scramble-info" class="hidden p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs">
                    <div class="flex items-start gap-1.5">
                        <span class="text-amber-600 dark:text-amber-400 mt-0.5"><i class="fa-solid fa-shuffle text-xs"></i></span>
                        <div class="flex-1 min-w-0">
                            <div class="font-semibold text-amber-800 dark:text-amber-300 mb-0.5">打乱</div>
                            <div id="pg-scramble-text" class="font-mono text-[10px] break-all leading-snug text-light-muted dark:text-dark-muted"></div>
                        </div>
                    </div>
                </div>

                <!-- Algorithm Input -->
                <div>
                    <div class="text-[11px] font-bold text-light-muted dark:text-dark-muted uppercase tracking-widest mb-1.5">Algorithm</div>
                    <input id="pg-alg-input" type="text" placeholder="e.g. R U R' U'" spellcheck="false"
                        class="w-full px-2.5 py-1.5 border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg text-xs font-mono focus:outline-none focus:border-black dark:focus:border-white rounded" />
                </div>

                <!-- Playback Controls -->
                <div class="grid grid-cols-4 gap-1.5">
                    <button id="pg-play-btn" class="col-span-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold transition flex items-center justify-center gap-1.5 text-xs active:scale-95">
                        <i class="fa-solid fa-play text-sm"></i> <span>Play</span>
                    </button>
                    <button id="pg-step-back-btn" class="py-2 border border-light-border dark:border-dark-border hover:bg-light-hover dark:hover:bg-dark-hover rounded font-bold transition flex items-center justify-center text-sm active:scale-95" title="Step Back">
                        <i class="fa-solid fa-backward-step"></i>
                    </button>
                    <button id="pg-step-fwd-btn" class="py-2 border border-light-border dark:border-dark-border hover:bg-light-hover dark:hover:bg-dark-hover rounded font-bold transition flex items-center justify-center text-sm active:scale-95" title="Step Forward">
                        <i class="fa-solid fa-forward-step"></i>
                    </button>
                    <button id="pg-scramble-btn" class="col-span-2 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold transition flex items-center justify-center gap-1.5 text-xs active:scale-95">
                        <i class="fa-solid fa-shuffle text-sm"></i> Scramble
                    </button>
                    <button id="pg-reset-btn" class="col-span-2 py-1.5 border border-light-border dark:border-dark-border hover:bg-light-hover dark:hover:bg-dark-hover rounded font-bold transition flex items-center justify-center gap-1.5 text-xs active:scale-95">
                        <i class="fa-solid fa-rotate-left text-sm"></i> Reset
                    </button>
                </div>

                <!-- Speed Slider -->
                <div class="bg-light-bg dark:bg-dark-bg p-2.5 rounded-lg border border-light-border dark:border-dark-border">
                    <div class="flex justify-between items-center mb-1">
                        <label class="text-[11px] font-bold text-light-muted dark:text-dark-muted uppercase tracking-widest">Speed</label>
                        <span class="text-[10px] font-mono bg-light-surface dark:bg-dark-surface px-2 py-0.5 rounded" id="pg-speed-display">300ms</span>
                    </div>
                    <input type="range" min="50" max="1200" step="50" value="300" class="w-full cursor-pointer accent-blue-500 h-1.5" id="pg-speed">
                </div>

                <!-- Animation Toggle -->
                <div class="flex items-center justify-between p-2.5 bg-light-bg dark:bg-dark-bg rounded-lg border border-light-border dark:border-dark-border">
                    <span class="text-[11px] font-bold uppercase tracking-widest text-light-muted dark:text-dark-muted">Animation</span>
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-mono text-light-muted dark:text-dark-muted" id="pg-anim-status">ON</span>
                        <button id="pg-anim-toggle" class="relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none" style="background-color:#3b82f6">
                            <span id="pg-anim-thumb" class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200" style="left:22px;"></span>
                        </button>
                    </div>
                </div>

                <!-- Bracket Pause Toggle -->
                <div class="flex items-center justify-between p-2.5 bg-light-bg dark:bg-dark-bg rounded-lg border border-light-border dark:border-dark-border">
                    <span class="text-[11px] font-bold uppercase tracking-widest text-light-muted dark:text-dark-muted">Bracket Pause</span>
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-mono text-light-muted dark:text-dark-muted" id="pg-bracket-status">ON</span>
                        <button id="pg-bracket-toggle" class="relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none" style="background-color:#3b82f6">
                            <span id="pg-bracket-thumb" class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200" style="left:22px;"></span>
                        </button>
                    </div>
                </div>

                <!-- Progress -->
                <div class="border-t border-light-border dark:border-dark-border pt-2.5 mt-auto">
                    <div class="flex flex-wrap gap-0.5 max-h-[60px] overflow-y-auto p-1.5 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded font-mono text-xs min-h-[28px]" id="pg-progress-tags"></div>
                    <div class="mt-1 text-[10px] font-bold text-center font-mono tracking-widest text-light-muted dark:text-dark-muted" id="pg-progress-text">0 / 0</div>
                </div>
            </div>
        </div>
    `;
}

/* ---- Bind Controls ---- */
function bindControls() {
    // Play button
    document.getElementById('pg-play-btn').addEventListener('click', handlePlayButton);

    // Enter key → Play
    document.getElementById('pg-alg-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handlePlayButton();
    });

    // Step Back / Forward
    document.getElementById('pg-step-back-btn').addEventListener('click', stepBack);
    document.getElementById('pg-step-fwd-btn').addEventListener('click', stepForward);

    // Reset
    document.getElementById('pg-reset-btn').addEventListener('click', () => {
        stopPlayback();
        if (state.baseScramble) {
            replayBaseState();
        } else {
            replayTo(0);
        }
    });

    // Scramble
    document.getElementById('pg-scramble-btn').addEventListener('click', doScramble);

    // Speed
    const speedInput = document.getElementById('pg-speed');
    const speedDisp = document.getElementById('pg-speed-display');
    speedInput.addEventListener('input', (e) => {
        state.speed = Number(e.target.value || 300);
        if (state.ui) state.ui.animationDuration = state.speed;
        speedDisp.textContent = `${state.speed}ms`;
    });

    // Animation toggle
    const animToggle = document.getElementById('pg-anim-toggle');
    const animThumb = document.getElementById('pg-anim-thumb');
    const animStatus = document.getElementById('pg-anim-status');
    animToggle.addEventListener('click', () => {
        state.animationEnabled = !state.animationEnabled;
        if (state.animationEnabled) {
            animToggle.style.backgroundColor = '#3b82f6';
            animThumb.style.left = '22px';
            animStatus.textContent = 'ON';
        } else {
            animToggle.style.backgroundColor = '#9ca3af';
            animThumb.style.left = '2px';
            animStatus.textContent = 'OFF';
        }
    });

    // Bracket pause toggle — rebuilds moves, re-renders from 0
    const bracketToggle = document.getElementById('pg-bracket-toggle');
    const bracketThumb = document.getElementById('pg-bracket-thumb');
    const bracketStatus = document.getElementById('pg-bracket-status');
    bracketToggle.addEventListener('click', () => {
        stopPlayback();
        state.bracketPause = !state.bracketPause;

        const on = state.bracketPause;
        bracketToggle.style.backgroundColor = on ? '#3b82f6' : '#9ca3af';
        bracketThumb.style.left = on ? '22px' : '2px';
        bracketStatus.textContent = on ? 'ON' : 'OFF';

        if (state.algString) {
            rebuildMoves();
            state.currentIdx = 0;
            if (state.baseScramble) {
                replayBaseState();
            } else {
                state.ui.cube.reset();
                state.ui.updateDOMTransforms();
                updateUI();
            }
        }
    });

    // Import banner close
    document.getElementById('pg-import-close').addEventListener('click', hideImportInfo);

    // Theme observer for cube background
    const cubeBg = document.querySelector('#app-view .flex-1.relative');
    if (cubeBg) {
        const updateBg = () => {
            const dark = document.documentElement.classList.contains('dark');
            cubeBg.className = `flex-1 relative bg-gradient-to-b ${dark ? 'from-gray-800 to-gray-900' : 'from-gray-100 to-gray-300'} flex items-center justify-center cursor-move touch-none min-h-0`;
        };
        updateBg();
        const observer = new MutationObserver(updateBg);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }
}

/* ---- Exports ---- */
export function initPlayground(container) {
    container.innerHTML = buildHTML();

    state.size = 3;
    state.ui = new Cube3DUI('playground-cube', state.size);
    state.ui.animationDuration = state.speed;
    state.moves = [];
    state.currentIdx = 0;
    state.importInfo = null;
    state.animationEnabled = true;
    state.baseScramble = null;

    bindControls();
    hideImportInfo();
    hideScrambleInfo();
    checkImport();
    updateUI();
}

export function destroyPlayground() {
    if (state.ui) {
        state.ui.stop();
        state.ui.destroy();
        state.ui = null;
    }
    state.moves = [];
    state.currentIdx = 0;
}
