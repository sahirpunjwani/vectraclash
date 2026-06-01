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

const GRAVITY = 0.6;
const JUMP_FORCE = -10;
const SHIP_THRUST = -0.4;
const UFO_FLAP = -7;
const FLOOR_Y = 330;
const CEILING_Y = 60;

let obstacles = [];
let totalLevelWidth = 4200; 
let cameraX = 0;
let gameSpeed = 6.5;

// Core Player Physics State
let player = {
    x: 100,
    y: FLOOR_Y - 30,
    width: 28,
    height: 28,
    vy: 0,
    rotation: 0,
    mode: 'cube', 
    ballGravityDir: 1, // 1 = normal, -1 = inverted
    isGrounded: false
};

const levelData = {
    1: { mode: 'cube', color: '#ff2a6d', map: [450, 700, 950, 1200, 1400, 1700, 1950, 2200, 2450, 2700, 2950, 3200, 3500] },
    2: { mode: 'ship', color: '#05d9e8', map: [500, 850, 1150, 1450, 1750, 2100, 2400, 2700, 3000, 3300] }, 
    3: { mode: 'ball', color: '#f5a623', map: [450, 750, 1050, 1350, 1650, 1950, 2250, 2550, 2850, 3150] },
    4: { mode: 'ufo',  color: '#b10dc9', map: [500, 800, 1100, 1400, 1700, 2000, 2300, 2600, 2900, 3300] },
    5: { mode: 'cube', color: '#01ff70', map: [] } 
};

// Generates procedural structures for levels 1-4, handcrafted gauntlet for level 5
function generateObstacles(lvl) {
    obstacles = [];
    let data = levelData[lvl];
    
    if (lvl < 5) {
        data.map.forEach(x => {
            if (data.mode === 'cube' || data.mode === 'ball') {
                obstacles.push({ x: x, y: FLOOR_Y, type: 'spike', w: 28, h: 28 });
                if(x % 2 === 0 && data.mode === 'cube') {
                    obstacles.push({ x: x - 120, y: FLOOR_Y - 55, type: 'block', w: 45, h: 20 });
                }
            } else if (data.mode === 'ship') {
                if (x % 2 === 0) {
                    obstacles.push({ x: x, y: FLOOR_Y, type: 'spike', w: 35, h: 55 });
                } else {
                    obstacles.push({ x: x, y: CEILING_Y + 55, type: 'ceiling_spike', w: 35, h: 55 });
                }
                obstacles.push({ x: x + 160, y: 190, type: 'block', w: 60, h: 35 });
            } else if (data.mode === 'ufo') {
                obstacles.push({ x: x, y: FLOOR_Y, type: 'spike', w: 30, h: 45 });
                obstacles.push({ x: x + 120, y: CEILING_Y + 45, type: 'ceiling_spike', w: 30, h: 45 });
                obstacles.push({ x: x + 180, y: 210, type: 'block', w: 40, h: 40 });
            }
        });
    } else {
        // LEVEL 5: Dynamic Hybrid Sequence Matrix
        // Stage A: Cube Start (0 -> 1000)
        obstacles.push({ x: 450, y: FLOOR_Y, type: 'spike', w: 28, h: 28 });
        obstacles.push({ x: 700, y: FLOOR_Y, type: 'spike', w: 28, h: 28 });
        obstacles.push({ x: 850, y: FLOOR_Y - 45, type: 'block', w: 60, h: 20 });
        
        // Portal Transition to Ship Mode
        obstacles.push({ x: 1050, y: FLOOR_Y - 120, type: 'portal', targetMode: 'ship', w: 25, h: 120 });
        
        // Stage B: Spaceship Core (1050 -> 2000)
        obstacles.push({ x: 1250, y: CEILING_Y + 65, type: 'ceiling_spike', w: 35, h: 60 });
        obstacles.push({ x: 1450, y: FLOOR_Y, type: 'spike', w: 35, h: 60 });
        obstacles.push({ x: 1700, y: 185, type: 'block', w: 75, h: 40 });
        
        // Portal Transition to Ball Mode
        obstacles.push({ x: 2050, y: FLOOR_Y - 120, type: 'portal', targetMode: 'ball', w: 25, h: 120 });
        
        // Stage C: Gravity Ball Flux (2050 -> 3000)
        obstacles.push({ x: 2250, y: FLOOR_Y, type: 'spike', w: 28, h: 28 });
        obstacles.push({ x: 2450, y: CEILING_Y + 28, type: 'ceiling_spike', w: 28, h: 28 });
        obstacles.push({ x: 2650, y: FLOOR_Y, type: 'spike', w: 28, h: 28 });
        obstacles.push({ x: 2850, y: CEILING_Y + 28, type: 'ceiling_spike', w: 28, h: 28 });

        // Portal Transition to UFO Final Drive
        obstacles.push({ x: 3050, y: FLOOR_Y - 120, type: 'portal', targetMode: 'ufo', w: 25, h: 120 });

        // Stage D: UFO Finale (3050 -> 3900)
        obstacles.push({ x: 3250, y: 210, type: 'block', w: 50, h: 50 });
        obstacles.push({ x: 3450, y: FLOOR_Y, type: 'spike', w: 40, h: 50 });
        obstacles.push({ x: 3700, y: CEILING_Y + 60, type: 'ceiling_spike', w: 40, h: 50 });
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

// Mathematics and Structural Real-time Updating
function update() {
    if (gameState !== 'playing') return;

    cameraX += gameSpeed;
    player.x = cameraX + 100;

    // Separate Environment Kinematics rules based on vehicle status
    if (player.mode === 'cube') {
        player.vy += GRAVITY;
        player.y += player.vy;
        
        if (player.y >= FLOOR_Y - player.height) {
            player.y = FLOOR_Y - player.height;
            player.vy = 0;
            player.isGrounded = true;
            player.rotation = Math.round(player.rotation / (Math.PI / 2)) * (Math.PI / 2);
        } else {
            player.rotation += 0.09; 
        }
    } 
    else if (player.mode === 'ship') {
        if (actionPressed) player.vy += SHIP_THRUST;
        else player.vy += GRAVITY * 0.65;

        player.vy = Math.max(-5.5, Math.min(5.5, player.vy));
        player.y += player.vy;
        player.rotation = player.vy * 0.06;

        if (player.y <= CEILING_Y) { player.y = CEILING_Y; player.vy = 0; }
        if (player.y >= FLOOR_Y - player.height) { player.y = FLOOR_Y - player.height; player.vy = 0; }
    } 
    else if (player.mode === 'ball') {
        player.vy += GRAVITY * player.ballGravityDir;
        player.y += player.vy;
        
        if (player.ballGravityDir === 1 && player.y >= FLOOR_Y - player.height) {
            player.y = FLOOR_Y - player.height;
            player.vy = 0;
            player.isGrounded = true;
        } else if (player.ballGravityDir === -1 && player.y <= CEILING_Y) {
            player.y = CEILING_Y;
            player.vy = 0;
            player.isGrounded = true;
        }
        player.rotation += 0.08 * player.ballGravityDir;
    } 
    else if (player.mode === 'ufo') {
        player.vy += GRAVITY * 0.75;
        player.vy = Math.min(7.5, player.vy); 
        player.y += player.vy;
        player.rotation = player.vy * 0.04;

        if (player.y <= CEILING_Y) { player.y = CEILING_Y; player.vy = 0; }
        if (player.y >= FLOOR_Y - player.height) { player.y = FLOOR_Y - player.height; player.vy = 0; }
    }

    // Engine UI Synchronizer
    let progress = Math.min(100, Math.floor((cameraX / (totalLevelWidth - 800)) * 100));
    progressDisplay.innerText = `Progress: ${progress}%`;
    modeBadge.innerText = player.mode;

    if (cameraX >= totalLevelWidth - 800) {
        endGame(true);
        return;
    }

    // High performance localized AABB Intersect Collisions
    for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        
        let pLeft = player.x, pRight = player.x + player.width;
        let pTop = player.y, pBottom = player.y + player.height;
        
        let oLeft = obs.x, oRight = obs.x + obs.w;
        let oTop = obs.type.includes('ceiling') ? obs.y - obs.h : obs.y - obs.h;
        if (obs.type === 'block') oTop = obs.y; 
        let oBottom = obs.type === 'block' ? obs.y + obs.h : obs.y;
        if(obs.type === 'portal') { oTop = obs.y; oBottom = obs.y + obs.h; }

        if (pRight > oLeft && pLeft < oRight && pBottom > oTop && pTop < oBottom) {
            if (obs.type === 'portal') {
                if (player.mode !== obs.targetMode) {
                    player.mode = obs.targetMode;
                    player.vy = 0;
                }
            } else if (obs.type === 'block') {
                if (pBottom - player.vy <= oTop + 3 && player.ballGravityDir === 1) {
                    player.y = oTop - player.height;
                    player.vy = 0;
                    player.isGrounded = true;
                } else if (pTop - player.vy >= oBottom - 3 && player.ballGravityDir === -1) {
                    player.y = oBottom;
                    player.vy = 0;
                    player.isGrounded = true;
                } else {
                    endGame(false); 
                    return;
                }
            } else {
                endGame(false);
                return;
            }
        }
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
            ctx.moveTo(obs.x, obs.y);
            ctx.lineTo(obs.x + obs.w / 2, obs.y - obs.h);
            ctx.lineTo(obs.x + obs.w, obs.y);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();
        } 
        else if (obs.type === 'ceiling_spike') {
            ctx.beginPath();
            ctx.moveTo(obs.x, obs.y - obs.h);
            ctx.lineTo(obs.x + obs.w / 2, obs.y);
            ctx.lineTo(obs.x + obs.w, obs.y - obs.h);
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
