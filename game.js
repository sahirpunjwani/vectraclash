const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// DOM Element Selectors
const menuOverlay = document.getElementById('menu-overlay');
const endOverlay = document.getElementById('end-overlay');
const hud = document.getElementById('hud');
const endTitle = document.getElementById('end-title');
const endSub = document.getElementById('end-sub');
const levelDisplay = document.getElementById('level-display');
const progressDisplay = document.getElementById('progress-display');
const modeBadge = document.getElementById('mode-badge');
const playBtn = document.getElementById('play-btn');
const retryBtn = document.getElementById('retry-btn');
const levelButtons = document.querySelectorAll('.lvl-btn');

// System Configurations
let currentLevel = 1;
let gameState = 'menu'; // menu, playing, dead, won
let actionPressed = false;
let animationFrameId;

const GRAVITY = 0.55;
const JUMP_FORCE = -9.5;
const SHIP_THRUST = -0.4;
const UFO_FLAP = -6.5;
const FLOOR_Y = 330;
const CEILING_Y = 60;

let obstacles = [];
let totalLevelWidth = 4200; 
let cameraX = 0;
let gameSpeed = 6;

// Core Player Physics State
let player = {
    x: 100,
    y: FLOOR_Y - 28,
    width: 28,
    height: 28,
    vy: 0,
    rotation: 0,
    mode: 'cube', 
    ballGravityDir: 1, // 1 = normal, -1 = inverted
    isGrounded: false
};

const levelData = {
    1: { mode: 'cube', color: '#ff2a6d', map: [450, 750, 1050, 1350, 1600, 1900, 2200, 2500, 2800, 3100, 3400] },
    2: { mode: 'ship', color: '#05d9e8', map: [500, 850, 1150, 1450, 1750, 2100, 2400, 2700, 3000, 3300] }, 
    3: { mode: 'ball', color: '#f5a623', map: [450, 750, 1050, 1350, 1650, 1950, 2250, 2550, 2850, 3150] },
    4: { mode: 'ufo',  color: '#b10dc9', map: [500, 800, 1100, 1400, 1700, 2000, 2300, 2600, 2900, 3300] },
    5: { mode: 'cube', color: '#01ff70', map: [] } 
};

function generateObstacles(lvl) {
    obstacles = [];
    let data = levelData[lvl];
    
    if (lvl < 5) {
        data.map.forEach(x => {
            if (data.mode === 'cube' || data.mode === 'ball') {
                // Raised spike coordinates to avoid base layer grounding bugs
                obstacles.push({ x: x, y: FLOOR_Y - 28, type: 'spike', w: 28, h: 28 });
                if (x % 2 === 0 && data.mode === 'cube') {
                    // Safe spacing for platform structures
                    obstacles.push({ x: x - 130, y: FLOOR_Y - 50, type: 'block', w: 50, h: 20 });
                }
            } else if (data.mode === 'ship') {
                if (x % 2 === 0) {
                    obstacles.push({ x: x, y: FLOOR_Y - 55, type: 'spike', w: 35, h: 55 });
                } else {
                    obstacles.push({ x: x, y: CEILING_Y, type: 'ceiling_spike', w: 35, h: 55 });
                }
                obstacles.push({ x: x + 160, y: 190, type: 'block', w: 60, h: 35 });
            } else if (data.mode === 'ufo') {
                obstacles.push({ x: x, y: FLOOR_Y - 45, type: 'spike', w: 30, h: 45 });
                obstacles.push({ x: x + 120, y: CEILING_Y, type: 'ceiling_spike', w: 30, h: 45 });
                obstacles.push({ x: x + 180, y: 210, type: 'block', w: 40, h: 40 });
            }
        });
    } else {
        // LEVEL 5: Dynamic Hybrid Sequence Matrix
        // Stage A: Cube Start (0 -> 1000)
        obstacles.push({ x: 450, y: FLOOR_Y - 28, type: 'spike', w: 28, h: 28 });
        obstacles.push({ x: 700, y: FLOOR_Y - 28, type: 'spike', w: 28, h: 28 });
        obstacles.push({ x: 850, y: FLOOR_Y - 50, type: 'block', w: 60, h: 20 });
        
        // Portal Transition to Ship Mode (Slightly raised for entry smoothness)
        obstacles.push({ x: 1050, y: FLOOR_Y - 150, type: 'portal', targetMode: 'ship', w: 25, h: 120 });
        
        // Stage B: Spaceship Core (1050 -> 2000)
        obstacles.push({ x: 1250, y: CEILING_Y, type: 'ceiling_spike', w: 35, h: 60 });
        obstacles.push({ x: 1450, y: FLOOR_Y - 60, type: 'spike', w: 35, h: 60 });
        obstacles.push({ x: 1700, y: 185, type: 'block', w: 75, h: 40 });
        
        // Portal Transition to Ball Mode
        obstacles.push({ x: 2050, y: FLOOR_Y - 150, type: 'portal', targetMode: 'ball', w: 25, h: 120 });
        
        // Stage C: Gravity Ball Flux (2050 -> 3000)
        obstacles.push({ x: 2250, y: FLOOR_Y - 28, type: 'spike', w: 28, h: 28 });
        obstacles.push({ x: 2450, y: CEILING_Y, type: 'ceiling_spike', w: 28, h: 28 });
        obstacles.push({ x: 2650, y: FLOOR_Y - 28, type: 'spike', w: 28, h: 28 });
        obstacles.push({ x: 2850, y: CEILING_Y, type: 'ceiling_spike', w: 28, h: 28 });

        // Portal Transition to UFO Final Drive
        obstacles.push({ x: 3050, y: FLOOR_Y - 150, type: 'portal', targetMode: 'ufo', w: 25, h: 120 });

        // Stage D: UFO Finale (3050 -> 3900)
        obstacles.push({ x: 3250, y: 210, type: 'block', w: 50, h: 50 });
        obstacles.push({ x: 3450, y: FLOOR_Y - 50, type: 'spike', w: 40, h: 50 });
        obstacles.push({ x: 3700, y: CEILING_Y, type: 'ceiling_spike', w: 40, h: 50 });
    }
}

// Global Execution Hooks / Event Binding
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') handleActionStart();
});
window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') handleActionEnd();
});
canvas.addEventListener('mousedown', handleActionStart);
canvas.addEventListener('mouseup', handleActionEnd);

levelButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        levelButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentLevel = parseInt(btn.getAttribute('data-lvl'));
    });
});

playBtn.addEventListener('click', startGame);
retryBtn.addEventListener('click', startGame);

function handleActionStart() {
    if (gameState !== 'playing') return;
    actionPressed = true;

    if (player.mode === 'cube' && player.isGrounded) {
        player.vy = JUMP_FORCE;
        player.isGrounded = false;
    } else if (player.mode === 'ball') {
        player.ballGravityDir *= -1;
        player.isGrounded = false;
    } else if (player.mode === 'ufo') {
        player.vy = UFO_FLAP;
    }
}

function handleActionEnd() {
    actionPressed = false;
}

function startGame() {
    menuOverlay.classList.add('hidden');
    endOverlay.classList.add('hidden');
    hud.classList.remove('hidden');
    
    gameState = 'playing';
    cameraX = 0;
    
    player.x = 100;
    player.vy = 0;
    player.rotation = 0;
    player.ballGravityDir = 1;
    player.mode = levelData[currentLevel].mode;
    player.y = player.ballGravityDir === 1 ? FLOOR_Y - player.height : CEILING_Y;
    player.isGrounded = true;

    levelDisplay.innerText = `Grid ${currentLevel}`;
    modeBadge.innerText = player.mode;
    
    generateObstacles(currentLevel);
    loop();
}

function endGame(win) {
    gameState = win ? 'won' : 'dead';
    cancelAnimationFrame(animationFrameId);
    
    hud.classList.add('hidden');
    endOverlay.classList.remove('hidden');
    
    if (win) {
        endTitle.innerText = "Grid Cleared";
        endTitle.style.textShadow = "0 0 15px #01ff70";
        endSub.innerText = `Matrix ${currentLevel} successfully calibrated.`;
        retryBtn.innerText = "Rerun Simulation";
    } else {
        endTitle.innerText = "System Crash";
        endTitle.style.textShadow = "0 0 15px #ff2a6d";
        endSub.innerText = `Sync breakdown at: ${Math.min(100, Math.floor((cameraX / (totalLevelWidth - 800)) * 100))}%`;
        retryBtn.innerText = "Reboot System";
    }
}

// Check if two rectangles intersect (AABB)
function checkCollision(r1, r2) {
    return r1.x < r2.x + r2.w &&
           r1.x + r1.w > r2.x &&
           r1.y < r2.y + r2.h &&
           r1.y + r1.h > r2.y;
}

// Fixed-Step Two-Axis Decoupled Movement Update Loop
function update() {
    if (gameState !== 'playing') return;

    // --- 1. AXIS SEPARATED HORIZONTAL MOVEMENT ---
    cameraX += gameSpeed;
    let oldPlayerX = player.x;
    player.x = cameraX + 100;
    let actualMoveX = player.x - oldPlayerX;

    // Build player's prospective horizontal collision zone
    let playerRectX = { x: player.x, y: player.y, w: player.width, h: player.height };

    for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        let obsBox = { x: obs.x, y: obs.y, w: obs.w, h: obs.h };
        if (obs.type === 'spike' || obs.type === 'ceiling_spike') obsBox.h = obs.h - 4; // Slight grace padding

        if (checkCollision(playerRectX, obsBox)) {
            if (obs.type === 'portal') {
                if (player.mode !== obs.targetMode) {
                    player.mode = obs.targetMode;
                    player.vy = 0;
                }
            } else if (obs.type === 'block') {
                // If moving into a wall side before vertical update, it's a fatal crash!
                endGame(false);
                return;
            } else {
                endGame(false); // Hazard hit
                return;
            }
        }
    }

    // --- 2. AXIS SEPARATED VERTICAL MOVEMENT & GRAVITY ---
    if (player.mode === 'cube') {
        player.vy += GRAVITY;
    } else if (player.mode === 'ship') {
        if (actionPressed) player.vy += SHIP_THRUST;
        else player.vy += GRAVITY * 0.65;
        player.vy = Math.max(-5.5, Math.min(5.5, player.vy));
    } else if (player.mode === 'ball') {
        player.vy += GRAVITY * player.ballGravityDir;
    } else if (player.mode === 'ufo') {
        player.vy += GRAVITY * 0.75;
        player.vy = Math.min(7.5, player.vy); 
    }

    player.y += player.vy;
    player.isGrounded = false;

    // Hard Environment Boundaries Constraints
    if (player.y >= FLOOR_Y - player.height) {
        if (player.mode === 'ball' && player.ballGravityDir === -1) {
            // Intentionally letting it float past if gravity is inverted
        } else {
            player.y = FLOOR_Y - player.height;
            player.vy = 0;
            player.isGrounded = true;
        }
    } else if (player.y <= CEILING_Y) {
        if (player.mode === 'ball' && player.ballGravityDir === 1) {
            // Safe
        } else {
            player.y = CEILING_Y;
            player.vy = 0;
            player.isGrounded = true;
        }
    }

    // Solve solid vertical object interactions (Platforms)
    let playerRectY = { x: player.x, y: player.y, w: player.width, h: player.height };
    
    for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        let obsBox = { x: obs.x, y: obs.y, w: obs.w, h: obs.h };

        if (checkCollision(playerRectY, obsBox)) {
            if (obs.type === 'block') {
                // Land safely on top of blocks while moving down
                if (player.vy >= 0 && (player.y + player.height - player.vy) <= obs.y + 4 && player.ballGravityDir === 1) {
                    player.y = obs.y - player.height;
                    player.vy = 0;
                    player.isGrounded = true;
                } 
                // Snap cleanly into ceiling platform nodes under inverted tracking
                else if (player.vy <= 0 && (player.y - player.vy) >= (obs.y + obs.h - 4) && player.ballGravityDir === -1) {
                    player.y = obs.y + obs.h;
                    player.vy = 0;
                    player.isGrounded = true;
                } else {
                    // Striking under-hanging geometry from below or side
                    endGame(false);
                    return;
                }
            } else if (obs.type === 'spike' || obs.type === 'ceiling_spike') {
                endGame(false);
                return;
            }
        }
    }

    // --- 3. ROTATION TRACKING HANDLERS ---
    if (player.mode === 'cube') {
        if (player.isGrounded) {
            // Smoothly snap rotation back down flush to base plane angles when grounded
            player.rotation = Math.round(player.rotation / (Math.PI / 2)) * (Math.PI / 2);
        } else {
            player.rotation += 0.09; 
        }
    } else if (player.mode === 'ship' || player.mode === 'ufo') {
        player.rotation = player.vy * 0.05;
    } else if (player.mode === 'ball') {
        player.rotation += 0.08 * player.ballGravityDir;
    }

    // Engine UI Sync Update
    let progress = Math.min(100, Math.floor((cameraX / (totalLevelWidth - 800)) * 100));
    progressDisplay.innerText = `Progress: ${progress}%`;
    modeBadge.innerText = player.mode;

    if (cameraX >= totalLevelWidth - 800) {
        endGame(true);
        return;
    }
}

// Specialized Canvas Rendering Routine
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(-cameraX, 0); 

    // Render Matrix Grid Arrays (Parallax Illusion Effect)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    let gridSize = 50;
    let startGridX = Math.floor(cameraX / gridSize) * gridSize;
    for (let x = startGridX; x < startGridX + canvas.width + gridSize; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, CEILING_Y); ctx.lineTo(x, FLOOR_Y); ctx.stroke();
    }

    // Static Border Layouts
    ctx.fillStyle = '#06030b';
    ctx.fillRect(cameraX, FLOOR_Y, canvas.width, canvas.height - FLOOR_Y);
    ctx.fillRect(cameraX, 0, canvas.width, CEILING_Y);
    
    ctx.strokeStyle = levelData[currentLevel].color;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cameraX, FLOOR_Y); ctx.lineTo(cameraX + canvas.width, FLOOR_Y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cameraX, CEILING_Y); ctx.lineTo(cameraX + canvas.width, CEILING_Y); ctx.stroke();

    // Terminating Level Node Gate
    ctx.fillStyle = '#01ff70';
    ctx.fillRect(totalLevelWidth - 200, CEILING_Y, 10, FLOOR_Y - CEILING_Y);

    // Hazard and Structure Layer Rendering Loop
    obstacles.forEach(obs => {
        ctx.fillStyle = levelData[currentLevel].color;
        
        if (obs.type === 'spike') {
            ctx.beginPath();
            ctx.moveTo(obs.x, obs.y + obs.h);
            ctx.lineTo(obs.x + obs.w / 2, obs.y);
            ctx.lineTo(obs.x + obs.w, obs.y + obs.h);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();
        } 
        else if (obs.type === 'ceiling_spike') {
            ctx.beginPath();
            ctx.moveTo(obs.x, obs.y);
            ctx.lineTo(obs.x + obs.w / 2, obs.y + obs.h);
            ctx.lineTo(obs.x + obs.w, obs.y);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();
        } 
        else if (obs.type === 'block') {
            ctx.fillStyle = '#171122';
            ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
            ctx.strokeStyle = levelData[currentLevel].color;
            ctx.lineWidth = 2;
            ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        }
        else if (obs.type === 'portal') {
            let gradient = ctx.createLinearGradient(obs.x, obs.y, obs.x + obs.w, obs.y);
            gradient.addColorStop(0, 'transparent');
            gradient.addColorStop(0.5, '#00ffff');
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
            
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 9px monospace';
            ctx.fillText(obs.targetMode.toUpperCase(), obs.x - 12, obs.y - 12);
        }
    });

    // Translate canvas focal point to player spatial matrix center
    ctx.save();
    ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
    ctx.rotate(player.rotation);

    ctx.fillStyle = '#fff'; 
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.5;

    // Vector Graphics Node Configurations for Player Avatars
    if (player.mode === 'cube') {
        ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);
        ctx.strokeRect(-player.width / 2, -player.height / 2, player.width, player.height);
        ctx.fillStyle = levelData[currentLevel].color;
        ctx.fillRect(-player.width / 4, -player.height / 4, player.width / 2, player.height / 2);
    } 
    else if (player.mode === 'ship') {
        ctx.beginPath();
        ctx.moveTo(-player.width/2, player.height/4);
        ctx.lineTo(player.width/2, 0);
        ctx.lineTo(-player.width/2, -player.height/2);
        ctx.lineTo(-player.width/4, 0);
        ctx.closePath();
        ctx.fillStyle = levelData[currentLevel].color;
        ctx.fill();
        ctx.stroke();
    } 
    else if (player.mode === 'ball') {
        ctx.beginPath();
        ctx.arc(0, 0, player.width / 2, 0, Math.PI * 2);
        ctx.fillStyle = levelData[currentLevel].color;
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-player.width/2, 0); ctx.lineTo(player.width/2, 0);
        ctx.moveTo(0, -player.height/2); ctx.lineTo(0, player.height/2);
        ctx.strokeStyle = '#fff';
        ctx.stroke();
    } 
    else if (player.mode === 'ufo') {
        ctx.beginPath();
        ctx.ellipse(0, 0, player.width/1.1, player.height/2.4, 0, 0, Math.PI*2);
        ctx.fillStyle = levelData[currentLevel].color;
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -3, player.width/3, Math.PI, 0);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.stroke();
    }

    ctx.restore();
    ctx.restore();
}

function loop() {
    update();
    draw();
    if (gameState === 'playing') {
        animationFrameId = requestAnimationFrame(loop);
    }
}

// Force frame zero initialization layout paint
draw();