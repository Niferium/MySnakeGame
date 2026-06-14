/**
 * MySnakeGame - Arcade Snake Game Logic
 * A fully functional, cute snake game with arcade aesthetics.
 */

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    // Grid dimensions (big grid as requested)
    GRID_COLS: 30,
    GRID_ROWS: 24,

    // Cell size in pixels (makes the grid look big and cool)
    CELL_SIZE: 20,

    // Speed range (ms per tick) — lower = faster
    MIN_SPEED: 80,    // Fastest speed (endgame)
    MAX_SPEED: 180,   // Slowest speed (start)

    // Speed decrease per food eaten (ms)
    SPEED_DECREASE: 3,

    // Initial snake length
    INITIAL_LENGTH: 4,

    // High score key for localStorage
    STORAGE_KEY: 'snake_high_score',

    // Colors
    COLORS: {
        gridBg: '#0d0d20',
        gridLine: '#1a1a3a',
        snakeBody: '#39ff14',
        snakeHead: '#2bcc10',
        snakeEye: '#0a0a1a',
        snakePupil: '#ffffff',
        food: '#ff2d7b',
        foodGlow: 'rgba(255, 45, 123, 0.6)',
        scorePopup: '#ffe600',
    },
};

// ============================================
// GAME STATE
// ============================================
let canvas, ctx;
let snake = [];           // Array of {x, y} segments
let direction = { x: 1, y: 0 };   // Current movement direction
let nextDirection = { x: 1, y: 0 }; // Buffered next direction (prevents 180° turns)
let food = { x: 0, y: 0 };
let score = 0;
let highScore = 0;
let gameSpeed = CONFIG.MAX_SPEED;
let gameLoopId = null;
let isRunning = false;
let lastTick = 0;

// ============================================
// INITIALIZATION
// ============================================
function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    // Set canvas size to match grid dimensions
    canvas.width = CONFIG.GRID_COLS * CONFIG.CELL_SIZE;
    canvas.height = CONFIG.GRID_ROWS * CONFIG.CELL_SIZE;

    // Load high score from localStorage
    loadHighScore();

    // Draw initial grid
    drawGrid();

    // Setup event listeners
    setupEventListeners();

    // Render start screen
    showStartScreen();
}

// ============================================
// LOCAL STORAGE — HIGH SCORE
// ============================================
function loadHighScore() {
    const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
    highScore = stored ? parseInt(stored, 10) : 0;
    document.getElementById('high-score').textContent = highScore;
}

function saveHighScore(newScore) {
    localStorage.setItem(CONFIG.STORAGE_KEY, newScore.toString());
}

function updateHighScoreDisplay() {
    document.getElementById('high-score').textContent = highScore;
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
    // Keyboard controls (arrows + WASD)
    document.addEventListener('keydown', handleKeyDown);

    // Start button
    document.getElementById('start-btn').addEventListener('click', startGame);

    // Retry button
    document.getElementById('retry-btn').addEventListener('click', startGame);
}

function handleKeyDown(e) {
    // Prevent default for arrow keys and WASD to avoid page scrolling
    const key = e.key.toLowerCase();

    // Map WASD and Arrow keys to directions
    const directionMap = {
        'arrowup':    { x: 0, y: -1 },
        'arrowdown':  { x: 0, y: 1 },
        'arrowleft':  { x: -1, y: 0 },
        'arrowright': { x: 1, y: 0 },
        'w':          { x: 0, y: -1 },
        's':          { x: 0, y: 1 },
        'a':          { x: -1, y: 0 },
        'd':          { x: 1, y: 0 },
    };

    const newDir = directionMap[key];

    if (newDir) {
        e.preventDefault();

        // Prevent 180° reversal: don't allow going opposite direction
        const isOpposite = (newDir.x === -direction.x && newDir.y === -direction.y);
        if (!isOpposite) {
            nextDirection = { ...newDir };
        }
    }
}

// ============================================
// SCREEN MANAGEMENT
// ============================================
function showStartScreen() {
    document.getElementById('start-screen').classList.remove('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
}

function showGameOverScreen(finalScore) {
    const gameOverScreen = document.getElementById('game-over-screen');
    const finalScoreEl = document.getElementById('final-score');
    const highScoreNotice = document.getElementById('high-score-notice');

    finalScoreEl.textContent = finalScore;

    // Check if player beat the high score
    if (finalScore > highScore) {
        highScoreNotice.classList.remove('hidden');
    } else {
        highScoreNotice.classList.add('hidden');
    }

    gameOverScreen.classList.remove('hidden');
}

function hideOverlays() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
}

// ============================================
// GAME START / RESET
// ============================================
function startGame() {
    // Reset game state
    snake = [];
    const startX = Math.floor(CONFIG.GRID_COLS / 4);
    const startY = Math.floor(CONFIG.GRID_ROWS / 2);

    // Create initial snake segments
    // BUG FIX: Changed loop to push head at index 0 first, then trailing body segments.
    // Original code pushed tail at index 0, causing immediate self-collision.
    for (let i = 0; i < CONFIG.INITIAL_LENGTH; i++) {
        snake.push({ x: startX - i, y: startY });
    }

    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;
    gameSpeed = CONFIG.MAX_SPEED;

    // Update UI
    updateScoreDisplay();
    updateSpeedDisplay();

    // Spawn first food
    spawnFood();

    // Hide overlays and start game
    hideOverlays();
    isRunning = true;

    // Start the game loop
    lastTick = performance.now();
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
    }
    gameLoop(performance.now());
}

// ============================================
// GAME LOOP
// ============================================
function gameLoop(currentTime) {
    if (!isRunning) return;

    // Calculate elapsed time since last tick
    const elapsed = currentTime - lastTick;

    if (elapsed >= gameSpeed) {
        update();
        draw();
        lastTick = currentTime;
    }

    gameLoopId = requestAnimationFrame(gameLoop);
}

// ============================================
// GAME UPDATE (Logic)
// ============================================
function update() {
    // Apply buffered direction
    direction = { ...nextDirection };

    // Calculate new head position
    const head = snake[0];
    const newHead = {
        x: head.x + direction.x,
        y: head.y + direction.y,
    };

    // --- Collision Detection ---

    // Wall collision
    if (
        newHead.x < 0 ||
        newHead.x >= CONFIG.GRID_COLS ||
        newHead.y < 0 ||
        newHead.y >= CONFIG.GRID_ROWS
    ) {
        gameOver();
        return;
    }

    // Self collision (check against all body segments except tail,
    // which will be removed this tick)
    for (let i = 0; i < snake.length - 1; i++) {
        if (snake[i].x === newHead.x && snake[i].y === newHead.y) {
            gameOver();
            return;
        }
    }

    // Move snake: add new head
    snake.unshift(newHead);

    // Check food collision
    if (newHead.x === food.x && newHead.y === food.y) {
        // Ate food: increase score, speed up, spawn new food
        score += 10;
        updateScoreDisplay();

        // Increase speed (decrease interval), clamped to MIN_SPEED
        gameSpeed = Math.max(CONFIG.MIN_SPEED, gameSpeed - CONFIG.SPEED_DECREASE);
        updateSpeedDisplay();

        spawnFood();

        // Visual bump on score display
        bumpScoreDisplay();
    } else {
        // Didn't eat: remove tail
        snake.pop();
    }
}

// ============================================
// FOOD SPAWNING
// ============================================
function spawnFood() {
    let validPosition = false;

    while (!validPosition) {
        const x = Math.floor(Math.random() * CONFIG.GRID_COLS);
        const y = Math.floor(Math.random() * CONFIG.GRID_ROWS);

        // Make sure food doesn't spawn on the snake
        let onSnake = false;
        for (const segment of snake) {
            if (segment.x === x && segment.y === y) {
                onSnake = true;
                break;
            }
        }

        if (!onSnake) {
            food = { x, y };
            validPosition = true;
        }
    }
}

// ============================================
// GAME OVER
// ============================================
function gameOver() {
    isRunning = false;

    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
        gameLoopId = null;
    }

    // Check and save high score
    if (score > highScore) {
        highScore = score;
        saveHighScore(highScore);
        updateHighScoreDisplay();
    }

    // Show game over screen
    showGameOverScreen(score);
}

// ============================================
// DRAWING — GRID
// ============================================
function drawGrid() {
    const cellSize = CONFIG.CELL_SIZE;
    const cols = CONFIG.GRID_COLS;
    const rows = CONFIG.GRID_ROWS;

    // Background
    ctx.fillStyle = CONFIG.COLORS.gridBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines (subtle)
    ctx.strokeStyle = CONFIG.COLORS.gridLine;
    ctx.lineWidth = 0.5;

    for (let x = 0; x <= cols; x++) {
        ctx.beginPath();
        ctx.moveTo(x * cellSize, 0);
        ctx.lineTo(x * cellSize, canvas.height);
        ctx.stroke();
    }

    for (let y = 0; y <= rows; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * cellSize);
        ctx.lineTo(canvas.width, y * cellSize);
        ctx.stroke();
    }
}

// ============================================
// DRAWING — SNAKE (Cute with Eyes!)
// ============================================
function drawSnake() {
    const cellSize = CONFIG.CELL_SIZE;

    snake.forEach((segment, index) => {
        const x = segment.x * cellSize;
        const y = segment.y * cellSize;

        if (index === 0) {
            // --- HEAD ---
            drawSnakeHead(x, y, cellSize);
        } else {
            // --- BODY ---
            drawSnakeBody(x, y, cellSize, index);
        }
    });
}

function drawSnakeHead(x, y, cellSize) {
    const padding = 1;

    // Head body (rounded rectangle)
    ctx.fillStyle = CONFIG.COLORS.snakeHead;
    ctx.shadowColor = CONFIG.COLORS.snakeBody;
    ctx.shadowBlur = 8;

    roundRect(ctx, x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2, 5);
    ctx.fill();

    ctx.shadowBlur = 0;

    // --- Eyes (cute factor!) ---
    drawEyes(x, y, cellSize);
}

function drawEyes(x, y, cellSize) {
    const eyeRadius = cellSize * 0.15;
    const pupilRadius = eyeRadius * 0.55;

    // Eye positions depend on direction
    let eye1X, eye1Y, eye2X, eye2Y;

    const centerX = x + cellSize / 2;
    const centerY = y + cellSize / 2;

    if (direction.x === 1) {
        // Moving right
        eye1X = centerX + cellSize * 0.2;
        eye1Y = centerY - cellSize * 0.2;
        eye2X = centerX + cellSize * 0.2;
        eye2Y = centerY + cellSize * 0.2;
    } else if (direction.x === -1) {
        // Moving left
        eye1X = centerX - cellSize * 0.2;
        eye1Y = centerY - cellSize * 0.2;
        eye2X = centerX - cellSize * 0.2;
        eye2Y = centerY + cellSize * 0.2;
    } else if (direction.y === -1) {
        // Moving up
        eye1X = centerX - cellSize * 0.2;
        eye1Y = centerY - cellSize * 0.2;
        eye2X = centerX + cellSize * 0.2;
        eye2Y = centerY - cellSize * 0.2;
    } else {
        // Moving down (default)
        eye1X = centerX - cellSize * 0.2;
        eye2X = centerX + cellSize * 0.2;
        eye1Y = centerY + cellSize * 0.2;
        eye2Y = centerY + cellSize * 0.2;
    }

    // Draw white of eyes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eye1X, eye1Y, eyeRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(eye2X, eye2Y, eyeRadius, 0, Math.PI * 2);
    ctx.fill();

    // Draw pupils (look in movement direction)
    const pupilOffsetX = direction.x * pupilRadius * 0.4;
    const pupilOffsetY = direction.y * pupilRadius * 0.4;

    ctx.fillStyle = CONFIG.COLORS.snakeEye;
    ctx.beginPath();
    ctx.arc(eye1X + pupilOffsetX, eye1Y + pupilOffsetY, pupilRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(eye2X + pupilOffsetX, eye2Y + pupilOffsetY, pupilRadius, 0, Math.PI * 2);
    ctx.fill();

    // Tiny highlight on pupils (makes them look alive!)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(eye1X + pupilOffsetX - pupilRadius * 0.3, eye1Y + pupilOffsetY - pupilRadius * 0.3, pupilRadius * 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(eye2X + pupilOffsetX - pupilRadius * 0.3, eye2Y + pupilOffsetY - pupilRadius * 0.3, pupilRadius * 0.35, 0, Math.PI * 2);
    ctx.fill();
}

function drawSnakeBody(x, y, cellSize, index) {
    const padding = 2;
    const bodyColor = index % 2 === 0 ? CONFIG.COLORS.snakeBody : '#2bcc10';

    // Body segment (rounded rectangle)
    ctx.fillStyle = bodyColor;
    roundRect(ctx, x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2, 4);
    ctx.fill();

    // Subtle inner highlight for depth
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    roundRect(ctx, x + padding + 2, y + padding + 2, cellSize - padding * 3, (cellSize - padding * 3) / 2, 3);
    ctx.fill();
}

// ============================================
// DRAWING — FOOD
// ============================================
function drawFood() {
    const cellSize = CONFIG.CELL_SIZE;
    const x = food.x * cellSize + cellSize / 2;
    const y = food.y * cellSize + cellSize / 2;
    const radius = cellSize * 0.4;

    // Glow effect
    ctx.shadowColor = CONFIG.COLORS.foodGlow;
    ctx.shadowBlur = 12;

    // Food circle (cute apple-like)
    ctx.fillStyle = CONFIG.COLORS.food;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    // Little shine on the food
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(x - radius * 0.25, y - radius * 0.25, radius * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Tiny stem
    ctx.strokeStyle = '#4a8c3f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - radius);
    ctx.lineTo(x + 3, y - radius - 4);
    ctx.stroke();

    // Tiny leaf
    ctx.fillStyle = '#4a8c3f';
    ctx.beginPath();
    ctx.ellipse(x + 5, y - radius - 2, 4, 2, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
}

// ============================================
// DRAWING — MAIN RENDER
// ============================================
function draw() {
    // Clear and redraw grid
    drawGrid();

    // Draw food
    drawFood();

    // Draw snake
    drawSnake();
}

// ============================================
// UTILITY — Rounded Rectangle Helper
// ============================================
function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

// ============================================
// UI UPDATES
// ============================================
function updateScoreDisplay() {
    const scoreEl = document.getElementById('score');
    scoreEl.textContent = score;
}

function updateSpeedDisplay() {
    const speedEl = document.getElementById('speed-display');
    // Calculate speed multiplier relative to max speed
    const multiplier = (CONFIG.MAX_SPEED / gameSpeed).toFixed(1);
    speedEl.textContent = `${multiplier}x`;
}

function bumpScoreDisplay() {
    const scoreEl = document.getElementById('score');
    scoreEl.classList.add('bump');
    setTimeout(() => {
        scoreEl.classList.remove('bump');
    }, 150);
}

// ============================================
// BOOTSTRAP
// ============================================
window.addEventListener('DOMContentLoaded', init);