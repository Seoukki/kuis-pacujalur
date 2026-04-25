/**
 * PACU JALUR - Game Engine
 * Optimized for Android TV & Split Screen Multiplayer
 */

// ============================================
// GAME STATE & CONSTANTS
// ============================================
const STATE = {
    SPLASH: 'splash',
    LOBBY: 'lobby',
    COUNTDOWN: 'countdown',
    RACING: 'racing',
    QUIZ: 'quiz',
    GAMEOVER: 'gameover'
};

const GAME_CONFIG = {
    FINISH_DISTANCE: 1000,      // meters
    CHECKPOINTS: [250, 500, 750], // checkpoint positions
    DECELERATION: 0.96,         // speed decay per frame
    MASH_BOOST: 12,             // speed added per mash
    MAX_SPEED: 20,              // max speed cap
    MIN_SPEED: 0.1,
    FRAME_RATE: 60,
    QUIZ_PENALTY_TIME: 2000,    // ms penalty for wrong answer
    QUIZ_BOOST_SPEED: 8         // speed bonus for correct answer
};

let currentState = STATE.SPLASH;
let quizQuestions = [];
let gameLoopId = null;
let lastTimestamp = 0;
let raceStartTime = 0;
let activeQuizPlayer = null;
let quizResolved = false;

// Audio Context for SFX
let audioCtx = null;
let bgmElement = null;

// Players Data
const players = [
    {
        id: 1,
        name: 'Pemain 1',
        ready: false,
        position: 0,
        speed: 0,
        checkpointsPassed: [],
        finished: false,
        finishTime: 0,
        mashCount: 0
    },
    {
        id: 2,
        name: 'Pemain 2',
        ready: false,
        position: 0,
        speed: 0,
        checkpointsPassed: [],
        finished: false,
        finishTime: 0,
        mashCount: 0
    }
];

// DOM Cache
const DOM = {
    screens: {
        splash: document.getElementById('screen-splash'),
        lobby: document.getElementById('screen-lobby'),
        countdown: document.getElementById('screen-countdown'),
        game: document.getElementById('screen-game'),
        gameover: document.getElementById('screen-gameover')
    },
    lobby: {
        nameP1: document.getElementById('name-p1'),
        nameP2: document.getElementById('name-p2'),
        fillP1: document.getElementById('btn-fill-p1'),
        fillP2: document.getElementById('btn-fill-p2'),
        readyP1: document.getElementById('btn-ready-p1'),
        readyP2: document.getElementById('btn-ready-p2'),
        statusP1: document.getElementById('status-p1'),
        statusP2: document.getElementById('status-p2')
    },
    game: {
        laneName1: document.getElementById('lane-name-1'),
        laneName2: document.getElementById('lane-name-2'),
        progress1: document.getElementById('progress-1'),
        progress2: document.getElementById('progress-2'),
        boat1: document.getElementById('boat-1'),
        boat2: document.getElementById('boat-2'),
        paddler1: document.getElementById('paddler-1'),
        paddler2: document.getElementById('paddler-2'),
        splash1: document.getElementById('splash-1'),
        splash2: document.getElementById('splash-2'),
        mashBtn1: document.getElementById('mash-btn-1'),
        mashBtn2: document.getElementById('mash-btn-2'),
        checkpoints1: document.getElementById('checkpoints-1'),
        checkpoints2: document.getElementById('checkpoints-2')
    },
    quiz: {
        overlay: document.getElementById('quiz-overlay'),
        title: document.getElementById('quiz-title'),
        playerName: document.getElementById('quiz-player-name'),
        question: document.getElementById('quiz-question-text'),
        options: document.getElementById('quiz-options'),
        feedback: document.getElementById('quiz-feedback')
    },
    countdown: {
        number: document.getElementById('countdown-number'),
        label: document.getElementById('countdown-label')
    },
    gameover: {
        winnerName: document.getElementById('winner-name'),
        distance: document.getElementById('winner-distance'),
        time: document.getElementById('winner-time'),
        confetti: document.getElementById('confetti-box')
    }
};

// ============================================
// AUDIO MANAGER
// ============================================
function initAudio() {
    bgmElement = document.getElementById('bgm');
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.warn('Web Audio API not supported');
    }
}

function playBGM() {
    if (bgmElement) {
        bgmElement.volume = 0.6;
        bgmElement.play().catch(e => console.log('BGM play blocked:', e));
    }
}

function stopBGM() {
    if (bgmElement) {
        bgmElement.pause();
        bgmElement.currentTime = 0;
    }
}

function playSFX(type) {
    if (!audioCtx) return;
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    
    switch(type) {
        case 'mash':
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
            osc.start(now);
            osc.stop(now + 0.08);
            break;
        case 'correct':
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523, now);
            osc.frequency.setValueAtTime(659, now + 0.1);
            osc.frequency.setValueAtTime(784, now + 0.2);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);
            break;
        case 'wrong':
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
            break;
        case 'countdown':
            osc.type = 'square';
            osc.frequency.setValueAtTime(440, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
            break;
        case 'go':
            osc.type = 'square';
            osc.frequency.setValueAtTime(880, now);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
            break;
        case 'win':
            // Simple victory arpeggio
            [523, 659, 784, 1047].forEach((freq, i) => {
                const o = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                o.connect(g);
                g.connect(audioCtx.destination);
                o.type = 'sine';
                o.frequency.value = freq;
                g.gain.setValueAtTime(0.15, now + i * 0.15);
                g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.3);
                o.start(now + i * 0.15);
                o.stop(now + i * 0.15 + 0.3);
            });
            break;
    }
}

// ============================================
// SCREEN MANAGEMENT
// ============================================
function switchScreen(screenName) {
    Object.values(DOM.screens).forEach(screen => {
        screen.classList.remove('active');
    });
    if (DOM.screens[screenName]) {
        DOM.screens[screenName].classList.add('active');
    }
    currentState = screenName;
}

// ============================================
// SPLASH SCREEN
// ============================================
document.getElementById('btn-to-lobby').addEventListener('click', () => {
    playSFX('mash');
    switchScreen('lobby');
});

// ============================================
// LOBBY SCREEN
// ============================================
function updateLobbyUI() {
    DOM.lobby.statusP1.textContent = players[0].ready ? '✅ Siap!' : '⏳ Belum Siap';
    DOM.lobby.statusP1.classList.toggle('ready', players[0].ready);
    DOM.lobby.readyP1.classList.toggle('active', players[0].ready);
    DOM.lobby.readyP1.textContent = players[0].ready ? '❌ Batal' : '⏳ Siap';
    
    DOM.lobby.statusP2.textContent = players[1].ready ? '✅ Siap!' : '⏳ Belum Siap';
    DOM.lobby.statusP2.classList.toggle('ready', players[1].ready);
    DOM.lobby.readyP2.classList.toggle('active', players[1].ready);
    DOM.lobby.readyP2.textContent = players[1].ready ? '❌ Batal' : '⏳ Siap';
}

function checkAllReady() {
    if (players[0].ready && players[1].ready) {
        setTimeout(startCountdown, 800);
    }
}

DOM.lobby.fillP1.addEventListener('click', () => {
    const name = DOM.lobby.nameP1.value.trim();
    if (name) {
        players[0].name = name.substring(0, 12);
        playSFX('correct');
        DOM.lobby.nameP1.blur();
    } else {
        playSFX('wrong');
        DOM.lobby.nameP1.focus();
    }
});

DOM.lobby.fillP2.addEventListener('click', () => {
    const name = DOM.lobby.nameP2.value.trim();
    if (name) {
        players[1].name = name.substring(0, 12);
        playSFX('correct');
        DOM.lobby.nameP2.blur();
    } else {
        playSFX('wrong');
        DOM.lobby.nameP2.focus();
    }
});

DOM.lobby.readyP1.addEventListener('click', () => {
    if (!players[0].name || players[0].name === 'Pemain 1') {
        const name = DOM.lobby.nameP1.value.trim();
        if (!name) {
            playSFX('wrong');
            DOM.lobby.nameP1.focus();
            return;
        }
        players[0].name = name.substring(0, 12);
    }
    players[0].ready = !players[0].ready;
    playSFX('mash');
    updateLobbyUI();
    if (players[0].ready) checkAllReady();
});

DOM.lobby.readyP2.addEventListener('click', () => {
    if (!players[1].name || players[1].name === 'Pemain 2') {
        const name = DOM.lobby.nameP2.value.trim();
        if (!name) {
            playSFX('wrong');
            DOM.lobby.nameP2.focus();
            return;
        }
        players[1].name = name.substring(0, 12);
    }
    players[1].ready = !players[1].ready;
    playSFX('mash');
    updateLobbyUI();
    if (players[1].ready) checkAllReady();
});

// Enter key support
DOM.lobby.nameP1.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') DOM.lobby.fillP1.click();
});
DOM.lobby.nameP2.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') DOM.lobby.fillP2.click();
});

// ============================================
// COUNTDOWN
// ============================================
function startCountdown() {
    switchScreen('countdown');
    let count = 3;
    
    const doCount = () => {
        DOM.countdown.number.textContent = count;
        DOM.countdown.number.style.animation = 'none';
        DOM.countdown.number.offsetHeight; // trigger reflow
        DOM.countdown.number.style.animation = 'countPop 0.8s ease-out';
        playSFX('countdown');
        
        if (count > 0) {
            count--;
            setTimeout(doCount, 1000);
        } else {
            DOM.countdown.number.textContent = 'GO!';
            DOM.countdown.label.textContent = 'Pacu Jalur!';
            playSFX('go');
            setTimeout(startRace, 800);
        }
    };
    
    doCount();
}

// ============================================
// GAME INITIALIZATION
// ============================================
function initGame() {
    // Reset player states
    players.forEach(p => {
        p.position = 0;
        p.speed = 0;
        p.checkpointsPassed = [];
        p.finished = false;
        p.finishTime = 0;
        p.mashCount = 0;
    });
    
    // Update UI names
    DOM.game.laneName1.textContent = players[0].name;
    DOM.game.laneName2.textContent = players[1].name;
    
    // Reset positions
    updateBoatPosition(0);
    updateBoatPosition(1);
    
    // Generate checkpoint markers
    generateCheckpointMarkers();
    
    // Reset paddler animations
    DOM.game.paddler1.className = 'paddler';
    DOM.game.paddler2.className = 'paddler';
}

function generateCheckpointMarkers() {
    DOM.game.checkpoints1.innerHTML = '';
    DOM.game.checkpoints2.innerHTML = '';
    
    GAME_CONFIG.CHECKPOINTS.forEach(pos => {
        const pct = (pos / GAME_CONFIG.FINISH_DISTANCE) * 100;
        
        const flag1 = document.createElement('div');
        flag1.className = 'checkpoint-flag';
        flag1.style.left = `${pct}%`;
        DOM.game.checkpoints1.appendChild(flag1);
        
        const flag2 = document.createElement('div');
        flag2.className = 'checkpoint-flag';
        flag2.style.left = `${pct}%`;
        DOM.game.checkpoints2.appendChild(flag2);
    });
}

// ============================================
// RACE MECHANICS
// ============================================
function startRace() {
    switchScreen('game');
    initGame();
    playBGM();
    raceStartTime = performance.now();
    lastTimestamp = raceStartTime;
    currentState = STATE.RACING;
    gameLoopId = requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp) {
    if (currentState !== STATE.RACING) return;
    
    const deltaTime = Math.min((timestamp - lastTimestamp) / 1000, 0.05); // cap delta
    lastTimestamp = timestamp;
    
    players.forEach((player, index) => {
        if (player.finished) return;
        
        // Apply deceleration
        player.speed *= Math.pow(GAME_CONFIG.DECELERATION, deltaTime * 60);
        if (player.speed < GAME_CONFIG.MIN_SPEED) player.speed = 0;
        
        // Update position
        player.position += player.speed * deltaTime * 10; // scale factor
        
        // Check finish
        if (player.position >= GAME_CONFIG.FINISH_DISTANCE) {
            player.position = GAME_CONFIG.FINISH_DISTANCE;
            player.finished = true;
            player.finishTime = timestamp - raceStartTime;
            handleFinish(index);
        }
        
        // Check checkpoints
        GAME_CONFIG.CHECKPOINTS.forEach(cp => {
            if (player.position >= cp && !player.checkpointsPassed.includes(cp)) {
                player.checkpointsPassed.push(cp);
                triggerQuiz(index, cp);
            }
        });
        
        // Update visual
        updateBoatPosition(index);
        updatePaddlerAnimation(index);
    });
    
    // Update progress text
    DOM.game.progress1.textContent = `${Math.floor(players[0].position)}m`;
    DOM.game.progress2.textContent = `${Math.floor(players[1].position)}m`;
    
    gameLoopId = requestAnimationFrame(gameLoop);
}

function updateBoatPosition(playerIndex) {
    const boat = playerIndex === 0 ? DOM.game.boat1 : DOM.game.boat2;
    const pct = Math.min((players[playerIndex].position / GAME_CONFIG.FINISH_DISTANCE) * 85, 85); // max 85% to keep visible
    boat.style.left = `${3 + pct}%`;
}

function updatePaddlerAnimation(playerIndex) {
    const paddler = playerIndex === 0 ? DOM.game.paddler1 : DOM.game.paddler2;
    const speed = players[playerIndex].speed;
    
    paddler.classList.remove('paddling', 'dancing');
    
    if (speed > GAME_CONFIG.MAX_SPEED * 0.7) {
        paddler.classList.add('dancing');
    } else if (speed > 0.5) {
        paddler.classList.add('paddling');
    }
}

function handleMash(playerIndex) {
    if (currentState !== STATE.RACING) return;
    if (players[playerIndex].finished) return;
    if (currentState === STATE.QUIZ) return;
    
    const player = players[playerIndex];
    player.speed += GAME_CONFIG.MASH_BOOST;
    if (player.speed > GAME_CONFIG.MAX_SPEED) player.speed = GAME_CONFIG.MAX_SPEED;
    player.mashCount++;
    
    // Visual feedback
    const btn = playerIndex === 0 ? DOM.game.mashBtn1 : DOM.game.mashBtn2;
    const splash = playerIndex === 0 ? DOM.game.splash1 : DOM.game.splash2;
    
    btn.classList.add('pressed');
    setTimeout(() => btn.classList.remove('pressed'), 100);
    
    splash.classList.add('active');
    setTimeout(() => splash.classList.remove('active'), 300);
    
    playSFX('mash');
}

// Mash button events
DOM.game.mashBtn1.addEventListener('touchstart', (e) => { e.preventDefault(); handleMash(0); });
DOM.game.mashBtn1.addEventListener('mousedown', (e) => { e.preventDefault(); handleMash(0); });
DOM.game.mashBtn2.addEventListener('touchstart', (e) => { e.preventDefault(); handleMash(1); });
DOM.game.mashBtn2.addEventListener('mousedown', (e) => { e.preventDefault(); handleMash(1); });

// Keyboard support for TV / testing
document.addEventListener('keydown', (e) => {
    if (currentState !== STATE.RACING) return;
    // Player 1: Q or A or ArrowLeft
    if (e.key === 'q' || e.key === 'Q' || e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        handleMash(0);
    }
    // Player 2: P or L or ArrowRight
    if (e.key === 'p' || e.key === 'P' || e.key === 'l' || e.key === 'L' || e.key === 'ArrowRight') {
        handleMash(1);
    }
});

// ============================================
// QUIZ SYSTEM
// ============================================
async function loadQuizData() {
    try {
        const response = await fetch('./kuis.json');
        const data = await response.json();
        quizQuestions = data.pertanyaan || [];
        // Shuffle questions
        quizQuestions.sort(() => Math.random() - 0.5);
    } catch (error) {
        console.error('Failed to load quiz:', error);
        // Fallback questions
        quizQuestions = getFallbackQuestions();
    }
}

function getFallbackQuestions() {
    return [
        { id: 1, soal: "Apa ibu kota Indonesia?", pilihan: ["Jakarta", "Surabaya", "Bandung", "Medan"], jawaban: 0 },
        { id: 2, soal: "Siapa presiden pertama Indonesia?", pilihan: ["Soekarno", "Soeharto", "Habibie", "Megawati"], jawaban: 0 },
        { id: 3, soal: "Apa nama mata uang Indonesia?", pilihan: ["Ringgit", "Peso", "Rupiah", "Baht"], jawaban: 2 },
        { id: 4, soal: "Di provinsi mana tradisi Pacu Jalur berasal?", pilihan: ["Riau", "Sumatera Barat", "Kalimantan", "Sulawesi"], jawaban: 0 },
        { id: 5, soal: "Apa nama pulau terbesar di Indonesia?", pilihan: ["Jawa", "Sumatera", "Kalimantan", "Sulawesi"], jawaban: 2 }
    ];
}

function triggerQuiz(playerIndex, checkpointPos) {
    if (quizQuestions.length === 0) return;
    
    currentState = STATE.QUIZ;
    activeQuizPlayer = playerIndex;
    quizResolved = false;
    
    // Pick random question
    const qIndex = Math.floor(Math.random() * quizQuestions.length);
    const question = quizQuestions[qIndex];
    
    // Show overlay
    DOM.quiz.overlay.classList.remove('hidden');
    DOM.quiz.playerName.textContent = players[playerIndex].name;
    DOM.quiz.question.textContent = question.soal;
    DOM.quiz.feedback.classList.add('hidden');
    DOM.quiz.feedback.className = 'quiz-feedback hidden';
    
    // Generate options
    DOM.quiz.options.innerHTML = '';
    question.pilihan.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option-btn';
        btn.textContent = `${String.fromCharCode(65 + idx)}. ${opt}`;
        btn.tabIndex = 0;
        btn.addEventListener('click', () => handleAnswer(playerIndex, idx, question.jawaban));
        DOM.quiz.options.appendChild(btn);
    });
}

function handleAnswer(playerIndex, selected, correct) {
    if (quizResolved) return;
    quizResolved = true;
    
    const buttons = DOM.quiz.options.querySelectorAll('.quiz-option-btn');
    buttons[selected].classList.add(selected === correct ? 'correct' : 'wrong');
    buttons[correct].classList.add('correct');
    
    DOM.quiz.feedback.classList.remove('hidden');
    
    if (selected === correct) {
        DOM.quiz.feedback.textContent = '✅ Benar! +Boost Kecepatan!';
        DOM.quiz.feedback.classList.add('correct');
        players[playerIndex].speed += GAME_CONFIG.QUIZ_BOOST_SPEED;
        playSFX('correct');
    } else {
        DOM.quiz.feedback.textContent = '❌ Salah! Penalti 2 detik...';
        DOM.quiz.feedback.classList.add('wrong');
        playSFX('wrong');
    }
    
    // Disable all buttons
    buttons.forEach(btn => btn.disabled = true);
    
    setTimeout(() => {
        DOM.quiz.overlay.classList.add('hidden');
        currentState = STATE.RACING;
        lastTimestamp = performance.now(); // reset delta
        if (selected !== correct) {
            // Penalty: stall the player
            players[playerIndex].speed = 0;
        }
    }, selected === correct ? 1500 : 2500);
}

// ============================================
// FINISH & GAME OVER
// ============================================
function handleFinish(winnerIndex) {
    const otherIndex = winnerIndex === 0 ? 1 : 0;
    
    // If other player also finished, compare times
    if (players[otherIndex].finished) {
        endGame();
        return;
    }
    
    // Small delay to let both potentially finish close together
    setTimeout(() => {
        if (!players[otherIndex].finished) {
            endGame();
        }
    }, 500);
}

function endGame() {
    cancelAnimationFrame(gameLoopId);
    currentState = STATE.GAMEOVER;
    stopBGM();
    playSFX('win');
    
    // Determine winner
    let winner;
    if (players[0].finished && players[1].finished) {
        winner = players[0].finishTime <= players[1].finishTime ? players[0] : players[1];
    } else if (players[0].finished) {
        winner = players[0];
    } else {
        winner = players[1];
    }
    
    // Update Game Over screen
    DOM.gameover.winnerName.textContent = winner.name;
    DOM.gameover.distance.textContent = `${GAME_CONFIG.FINISH_DISTANCE}m`;
    
    const seconds = ((winner.finishTime || 0) / 1000).toFixed(2);
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    DOM.gameover.time.textContent = `${mins.toString().padStart(2, '0')}:${secs.padStart(5, '0')}`;
    
    // Generate confetti
    generateConfetti();
    
    switchScreen('gameover');
}

function generateConfetti() {
    DOM.gameover.confetti.innerHTML = '';
    const colors = ['#FF6B35', '#4CC9F0', '#FFD60A', '#2ECC71', '#E74C3C', '#9B59B6'];
    
    for (let i = 0; i < 50; i++) {
        const conf = document.createElement('div');
        conf.className = 'confetti';
        conf.style.left = `${Math.random() * 100}%`;
        conf.style.background = colors[Math.floor(Math.random() * colors.length)];
        conf.style.animationDelay = `${Math.random() * 3}s`;
        conf.style.animationDuration = `${3 + Math.random() * 3}s`;
        conf.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
        DOM.gameover.confetti.appendChild(conf);
    }
}

// ============================================
// RESET & RETURN TO LOBBY
// ============================================
document.getElementById('btn-back-lobby').addEventListener('click', () => {
    playSFX('mash');
    
    // Reset all states
    players.forEach(p => {
        p.ready = false;
        p.position = 0;
        p.speed = 0;
        p.checkpointsPassed = [];
        p.finished = false;
        p.finishTime = 0;
        p.mashCount = 0;
    });
    
    // Reset UI
    DOM.lobby.nameP1.value = '';
    DOM.lobby.nameP2.value = '';
    updateLobbyUI();
    
    switchScreen('lobby');
});

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initAudio();
    loadQuizData();
    switchScreen('splash');
    
    // Prevent zoom on double tap for mobile/TV browsers
    document.addEventListener('dblclick', (e) => e.preventDefault());
    
    // Keep screen awake if possible
    if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').catch(e => console.log('Wake lock not supported'));
    }
});
