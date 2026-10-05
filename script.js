// ============================================================
// Executive N-Back - Cognitive Training App
// ============================================================

// Stimulus sets (7 items each, cyclic)
const STIMULI = {
    days: {
        name: 'Days',
        items: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
        emoji: '📅'
    },
    alphabet: {
        name: 'Alphabet',
        items: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
        emoji: '🔤'
    },
    shapes: {
        name: 'Shapes',
        items: ['●', '■', '▲', '◆', '★', '♥', '⬡'],
        emoji: '🔷'
    },
    months: {
        name: 'Months',
        items: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL'],
        emoji: '📆'
    }
};

// Game configuration
const CONFIG = {
    sessions: 6,
    blocksPerSession: 20,
    scoredPerBlock: 20,
    targetsPerBlock: 6,
    nonTargetsPerBlock: 14,
    minN: 1,
    maxN: 5
};

// Game state
let state = {
    // Settings
    stimulusType: 'days',
    startN: 2,
    stimulusDuration: 2000,

    // Session state
    currentSession: 1,
    currentBlock: 1,
    currentN: 2,

    // Block state
    sequence: [],
    currentIndex: 0,
    warmupCount: 0,
    scoredCount: 0,
    correctCount: 0,
    targetCount: 0,
    respondedTargets: 0,
    blockResults: [],

    // Session totals
    sessionCorrect: 0,
    sessionTotal: 0,

    // Overall totals
    totalCorrect: 0,
    totalAnswered: 0,
    peakN: 2,
    sessionFinalNs: [],

    // Timing
    stimulusTimer: null,
    timerInterval: null,
    isRunning: false,
    canRespond: false,
    hasResponded: false
};

// DOM Elements
const elements = {};

function cacheElements() {
    elements.settingsPanel = document.getElementById('settingsPanel');
    elements.settingsToggle = document.getElementById('settingsToggle');
    elements.settingsBody = document.getElementById('settingsBody');
    elements.stimulusOptions = document.getElementById('stimulusOptions');
    elements.nbackOptions = document.getElementById('nbackOptions');
    elements.durationOptions = document.getElementById('durationOptions');

    elements.startScreen = document.getElementById('startScreen');
    elements.startBtn = document.getElementById('startBtn');
    elements.startNLevel = document.getElementById('startNLevel');
    elements.startStimulus = document.getElementById('startStimulus');

    elements.gameScreen = document.getElementById('gameScreen');
    elements.progressFill = document.getElementById('progressFill');
    elements.sessionDisplay = document.getElementById('sessionDisplay');
    elements.blockDisplay = document.getElementById('blockDisplay');
    elements.nLevelDisplay = document.getElementById('nLevelDisplay');
    elements.scoreDisplay = document.getElementById('scoreDisplay');
    elements.stimulusCard = document.getElementById('stimulusCard');
    elements.stimulusText = document.getElementById('stimulusText');
    elements.timerBar = document.getElementById('timerBar');
    elements.feedbackText = document.getElementById('feedbackText');
    elements.responseBtn = document.getElementById('responseBtn');
    elements.sequenceItems = document.getElementById('sequenceItems');

    elements.blockComplete = document.getElementById('blockComplete');
    elements.blockScore = document.getElementById('blockScore');
    elements.blockAccuracy = document.getElementById('blockAccuracy');
    elements.blockNLevel = document.getElementById('blockNLevel');
    elements.nbackChangeText = document.getElementById('nbackChangeText');
    elements.nextBlockBtn = document.getElementById('nextBlockBtn');

    elements.sessionComplete = document.getElementById('sessionComplete');
    elements.sessionScore = document.getElementById('sessionScore');
    elements.sessionAccuracy = document.getElementById('sessionAccuracy');
    elements.sessionFinalN = document.getElementById('sessionFinalN');
    elements.nextSessionBtn = document.getElementById('nextSessionBtn');

    elements.finalResults = document.getElementById('finalResults');
    elements.finalStatsGrid = document.getElementById('finalStatsGrid');
    elements.peakN = document.getElementById('peakN');
    elements.overallAccuracy = document.getElementById('overallAccuracy');
    elements.restartBtn = document.getElementById('restartBtn');
}

// ============================================================
// Utility Functions
// ============================================================

function getStimulusSet() {
    return STIMULI[state.stimulusType].items;
}

function getNextItem(item) {
    const items = getStimulusSet();
    const idx = items.indexOf(item);
    return items[(idx + 1) % items.length];
}

function isExecutiveTarget(currentItem, nBackItem) {
    return currentItem === getNextItem(nBackItem);
}

function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ============================================================
// Sequence Generation
// ============================================================

function generateBlockSequence() {
    const items = getStimulusSet();
    const n = state.currentN;
    const totalLength = n + CONFIG.scoredPerBlock;
    const sequence = [];

    // Generate warm-up stimuli (random)
    for (let i = 0; i < n; i++) {
        sequence.push(items[Math.floor(Math.random() * items.length)]);
    }

    // Generate scored stimuli with exactly 6 targets and 14 non-targets
    const scoredStimuli = [];
    const targetPositions = new Set();

    // Choose 6 random positions from the 20 scored positions
    while (targetPositions.size < CONFIG.targetsPerBlock) {
        targetPositions.add(Math.floor(Math.random() * CONFIG.scoredPerBlock));
    }

    // Build the scored sequence
    for (let i = 0; i < CONFIG.scoredPerBlock; i++) {
        if (targetPositions.has(i)) {
            // This should be a target: current = next after N-back
            const nBackIdx = n + i - n; // Index in full sequence of N-back item
            const nBackItem = sequence[nBackIdx];
            const targetItem = getNextItem(nBackItem);
            scoredStimuli.push(targetItem);
            sequence.push(targetItem);
        } else {
            // Non-target: pick something that is NOT the next after N-back
            const nBackIdx = n + i - n;
            const nBackItem = sequence[nBackIdx];
            const nextItem = getNextItem(nBackItem);

            // Pick a random item that is NOT the target
            let candidate;
            do {
                candidate = items[Math.floor(Math.random() * items.length)];
            } while (candidate === nextItem);

            scoredStimuli.push(candidate);
            sequence.push(candidate);
        }
    }

    return sequence;
}

// ============================================================
// Game Flow
// ============================================================

function startGame() {
    state.currentSession = 1;
    state.currentBlock = 1;
    state.currentN = state.startN;
    state.totalCorrect = 0;
    state.totalAnswered = 0;
    state.peakN = state.startN;
    state.sessionFinalNs = [];

    elements.startScreen.classList.add('hidden');
    elements.finalResults.classList.add('hidden');
    elements.gameScreen.classList.remove('hidden');

    startBlock();
}

function startBlock() {
    state.sequence = generateBlockSequence();
    state.currentIndex = 0;
    state.warmupCount = 0;
    state.scoredCount = 0;
    state.correctCount = 0;
    state.targetCount = 0;
    state.respondedTargets = 0;
    state.blockResults = [];
    state.isRunning = true;
    state.canRespond = false;
    state.hasResponded = false;

    updateDisplay();
    updateSequenceTracker();
    showStimulus();
}

function showStimulus() {
    if (state.currentIndex >= state.sequence.length) {
        endBlock();
        return;
    }

    const item = state.sequence[state.currentIndex];
    const isWarmup = state.currentIndex < state.currentN;

    // Update stimulus display
    elements.stimulusText.textContent = item;
    elements.stimulusCard.className = 'stimulus-card active';
    elements.stimulusCard.classList.remove('target-flash', 'miss-flash');

    // Update progress
    const totalStimuli = state.sequence.length;
    const progress = (state.currentIndex / totalStimuli) * 100;
    elements.progressFill.style.width = `${progress}%`;

    // Update stats
    elements.sessionDisplay.textContent = `${state.currentSession}/${CONFIG.sessions}`;
    elements.blockDisplay.textContent = `${state.currentBlock}/${CONFIG.blocksPerSession}`;
    elements.nLevelDisplay.textContent = `${state.currentN}-Back`;

    // Update sequence tracker
    updateSequenceTracker();

    // Start timer
    const duration = state.stimulusDuration;
    elements.timerBar.style.transition = 'none';
    elements.timerBar.style.width = '100%';
    void elements.timerBar.offsetWidth; // Force reflow
    elements.timerBar.style.transition = `width ${duration}ms linear`;
    elements.timerBar.style.width = '0%';

    // Enable response only during scored stimuli
    state.canRespond = !isWarmup;
    state.hasResponded = false;

    // Schedule next stimulus
    clearTimeout(state.stimulusTimer);
    state.stimulusTimer = setTimeout(() => {
        // Check if this was a target that was missed
        if (state.canRespond && !state.hasResponded) {
            const nBackItem = state.sequence[state.currentIndex - state.currentN];
            if (nBackItem && isExecutiveTarget(item, nBackItem)) {
                // Missed target
                state.blockResults.push({ type: 'missed', correct: false });
                state.correctCount--;
                showFeedback('Missed target!', 'missed');
                elements.stimulusCard.classList.add('miss-flash');
            }
        }

        state.currentIndex++;
        if (isWarmup) {
            state.warmupCount++;
        } else {
            state.scoredCount++;
        }

        // Small delay between stimuli
        setTimeout(showStimulus, 200);
    }, duration);
}

function handleResponse() {
    if (!state.isRunning || !state.canRespond || state.hasResponded) return;

    state.hasResponded = true;
    const currentItem = state.sequence[state.currentIndex];
    const nBackItem = state.sequence[state.currentIndex - state.currentN];
    const isTarget = nBackItem && isExecutiveTarget(currentItem, nBackItem);

    elements.responseBtn.classList.add('pressed');
    setTimeout(() => elements.responseBtn.classList.remove('pressed'), 150);

    if (isTarget) {
        // Correct hit
        state.blockResults.push({ type: 'hit', correct: true });
        state.correctCount++;
        state.respondedTargets++;
        showFeedback('Correct!', 'correct');
        elements.stimulusCard.classList.add('target-flash');
    } else {
        // False alarm
        state.blockResults.push({ type: 'falseAlarm', correct: false });
        state.correctCount--;
        showFeedback('False alarm!', 'wrong');
    }
}

function showFeedback(text, type) {
    elements.feedbackText.textContent = text;
    elements.feedbackText.className = `feedback-text show ${type}`;
    setTimeout(() => {
        elements.feedbackText.classList.remove('show');
    }, 800);
}

function endBlock() {
    state.isRunning = false;
    clearTimeout(state.stimulusTimer);

    // Calculate block score
    const score = Math.max(0, state.correctCount);
    const accuracy = Math.round((score / CONFIG.scoredPerBlock) * 100);

    // Update totals
    state.sessionCorrect += score;
    state.sessionTotal += CONFIG.scoredPerBlock;
    state.totalCorrect += score;
    state.totalAnswered += CONFIG.scoredPerBlock;

    // Update peak N
    if (state.currentN > state.peakN) {
        state.peakN = state.currentN;
    }

    // Determine N-back change
    let nChange = 'same';
    if (score >= 19) {
        state.currentN = Math.min(state.currentN + 1, CONFIG.maxN);
        nChange = 'increase';
    } else if (score <= 15) {
        state.currentN = Math.max(state.currentN - 1, CONFIG.minN);
        nChange = 'decrease';
    }

    // Show block complete screen
    elements.gameScreen.classList.add('hidden');
    elements.blockComplete.classList.remove('hidden');

    elements.blockScore.textContent = `${score}/${CONFIG.scoredPerBlock}`;
    elements.blockAccuracy.textContent = `${accuracy}%`;
    elements.blockNLevel.textContent = state.currentN;

    if (nChange === 'increase') {
        elements.nbackChangeText.textContent = `N increased to ${state.currentN}!`;
        elements.nbackChangeText.className = 'nback-change-text increase';
    } else if (nChange === 'decrease') {
        elements.nbackChangeText.textContent = `N decreased to ${state.currentN}`;
        elements.nbackChangeText.className = 'nback-change-text decrease';
    } else {
        elements.nbackChangeText.textContent = `N stays at ${state.currentN}`;
        elements.nbackChangeText.className = 'nback-change-text same';
    }
}

function nextBlock() {
    elements.blockComplete.classList.add('hidden');

    if (state.currentBlock >= CONFIG.blocksPerSession) {
        endSession();
    } else {
        state.currentBlock++;
        elements.gameScreen.classList.remove('hidden');
        startBlock();
    }
}

function endSession() {
    state.sessionFinalNs.push(state.currentN);

    elements.blockComplete.classList.add('hidden');
    elements.sessionComplete.classList.remove('hidden');

    const sessionAccuracy = Math.round((state.sessionCorrect / state.sessionTotal) * 100);

    elements.sessionScore.textContent = `${state.sessionCorrect}/${state.sessionTotal}`;
    elements.sessionAccuracy.textContent = `${sessionAccuracy}%`;
    elements.sessionFinalN.textContent = state.currentN;
}

function nextSession() {
    elements.sessionComplete.classList.add('hidden');

    if (state.currentSession >= CONFIG.sessions) {
        showFinalResults();
    } else {
        state.currentSession++;
        state.currentBlock = 1;
        // Later sessions begin at previous session's final N minus 2
        state.currentN = Math.max(state.sessionFinalNs[state.sessionFinalNs.length - 1] - 2, CONFIG.minN);
        state.sessionCorrect = 0;
        state.sessionTotal = 0;
        elements.gameScreen.classList.remove('hidden');
        startBlock();
    }
}

function showFinalResults() {
    elements.sessionComplete.classList.add('hidden');
    elements.finalResults.classList.remove('hidden');

    const overallAccuracy = Math.round((state.totalCorrect / state.totalAnswered) * 100);

    // Build final stats grid
    let statsHTML = '';
    for (let i = 0; i < CONFIG.sessions; i++) {
        const finalN = state.sessionFinalNs[i] || state.startN;
        statsHTML += `
            <div class="final-stat-card">
                <span class="value">${finalN}</span>
                <span class="label">Session ${i + 1} N</span>
            </div>
        `;
    }
    elements.finalStatsGrid.innerHTML = statsHTML;

    elements.peakN.textContent = state.peakN;
    elements.overallAccuracy.textContent = `${overallAccuracy}%`;
}

function restartGame() {
    elements.finalResults.classList.add('hidden');
    elements.startScreen.classList.remove('hidden');
    elements.startNLevel.textContent = state.startN;
    elements.startStimulus.textContent = STIMULI[state.stimulusType].name;
}

// ============================================================
// Display Updates
// ============================================================

function updateDisplay() {
    elements.scoreDisplay.textContent = `${Math.max(0, state.correctCount)}/${state.scoredCount}`;
}

function updateSequenceTracker() {
    const n = state.currentN;
    const currentIdx = state.currentIndex;
    let html = '';

    // Show last N+1 items (N-back window + current)
    const startIdx = Math.max(0, currentIdx - n);
    const endIdx = Math.min(state.sequence.length, currentIdx + 1);

    for (let i = startIdx; i < endIdx; i++) {
        let className = 'sequence-item';
        if (i === currentIdx) {
            className += ' current';
        } else if (i === currentIdx - n) {
            className += ' nback';
        }

        // Check if this was a target
        if (i > n - 1 && i < state.sequence.length) {
            const nBackItem = state.sequence[i - n];
            if (nBackItem && isExecutiveTarget(state.sequence[i], nBackItem)) {
                className += ' target';
            }
        }

        html += `<span class="${className}">${state.sequence[i]}</span>`;
    }

    elements.sequenceItems.innerHTML = html;
}

// ============================================================
// Settings
// ============================================================

function setupSettings() {
    // Settings toggle
    elements.settingsToggle.addEventListener('click', () => {
        elements.settingsPanel.classList.toggle('collapsed');
    });

    // Stimulus type buttons
    elements.stimulusOptions.querySelectorAll('.stimulus-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            elements.stimulusOptions.querySelectorAll('.stimulus-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.stimulusType = btn.dataset.type;
            elements.startStimulus.textContent = STIMULI[state.stimulusType].name;
        });
    });

    // N-back level buttons
    elements.nbackOptions.querySelectorAll('.nback-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            elements.nbackOptions.querySelectorAll('.nback-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.startN = parseInt(btn.dataset.n);
            elements.startNLevel.textContent = state.startN;
        });
    });

    // Duration buttons
    elements.durationOptions.querySelectorAll('.duration-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            elements.durationOptions.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.stimulusDuration = parseInt(btn.dataset.dur);
        });
    });
}

// ============================================================
// Event Listeners
// ============================================================

function setupEventListeners() {
    // Start button
    elements.startBtn.addEventListener('click', startGame);

    // Response button
    elements.responseBtn.addEventListener('click', handleResponse);

    // Next block button
    elements.nextBlockBtn.addEventListener('click', nextBlock);

    // Next session button
    elements.nextSessionBtn.addEventListener('click', nextSession);

    // Restart button
    elements.restartBtn.addEventListener('click', restartGame);

    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        if (e.key === 'j' || e.key === 'J') {
            e.preventDefault();
            handleResponse();
        }
        if (e.key === ' ') {
            e.preventDefault();
            if (!elements.startScreen.classList.contains('hidden')) {
                startGame();
            } else if (!elements.blockComplete.classList.contains('hidden')) {
                nextBlock();
            } else if (!elements.sessionComplete.classList.contains('hidden')) {
                nextSession();
            } else if (!elements.finalResults.classList.contains('hidden')) {
                restartGame();
            }
        }
    });
}

// ============================================================
// Initialization
// ============================================================

function init() {
    cacheElements();
    setupSettings();
    setupEventListeners();
    elements.startNLevel.textContent = state.startN;
    elements.startStimulus.textContent = STIMULI[state.stimulusType].name;
}

document.addEventListener('DOMContentLoaded', init);
