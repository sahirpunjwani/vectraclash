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
let gameState = 'menu'; // menu, playing, dying, celebrating, dead, won
let actionPressed = false;
let animationFrameId;

const GRAVITY = 0.55;
const JUMP_FORCE = -9.5;
const SHIP_THRUST = -0.4;
const UFO_FLAP = -6.5;
const FLOOR_Y = 330;
const CEILING_Y = 60;

// Game feel helper parameters
let jumpBufferTimer = 0;   
let coyoteTimeTimer = 0;   
const BUFFER_WINDOW = 9;   
const COYOTE_WINDOW = 6;   

let obstacles = [];
let particles = []; 
let animationTimer = 0; // Dual-purpose timer for death and victory animation states
let totalLevelWidth = 4200; 
let cameraX = 0;
let gameSpeed = 5.5; 

// Core Player Physics State
let player = {
    x: 100,
    y: FLOOR_Y - 28,
    width: 28,
    height: 28,
    vy: 0,
    rotation: 0,
    mode: 'cube', 
    ballGravityDir: 1, 
    isGrounded: false
};

// Level design maps
const levelData = {
    1: { mode: 'cube', color: '#ff2a6d', map: [650, 1100, 1600, 2100, 2500, 2900, 3400] },
    2: { mode: 'ship', color: '#05d9e8', map: [600, 950, 1300, 1650, 2000, 2400, 2800, 3200, 3500] }, 
    3: { mode: 'ball', color: '#f5a623', map: [600, 900, 1200, 1500, 1800, 2100, 2400, 2700, 3000, 3300] },
    4: { mode: 'ufo',  color: '#b10dc9', map: [600, 900, 1200, 1500, 1800, 2100, 2400, 2700, 3000, 3400] },
    5: { mode: 'cube', color: '#01ff70', map: [] } 
};

function generateObstacles(lvl) {
    obstacles = [];
    let data = levelData[lvl];
    
    if (lvl < 5) {
        data.map.forEach(x => {
            if (data.mode === 'cube' || data.mode === 'ball') {
                obstacles.push({ x: x, y: FLOOR_Y - 28, type: 'spike', w: 28, h: 28 });
                if (x === 1100 || x === 2500) {
                    obstacles.push({ x: x - 180, y: FLOOR_Y - 48, type: 'block', w: 65, h: 20 });
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
        obstacles.push({ x: 500, y: FLOOR_Y - 28, type: 'spike', w: 28, h: 28 });
        obstacles.push({ x: 800, y: FLOOR_Y - 50, type: 'block', w: 60, h: 20 });
        
        obstacles.push({ x: 1100, y: FLOOR_Y - 150, type: 'portal', targetMode: 'ship', w: 25, h: 120 });
        
        obstacles.push({ x: 1350, y: CEILING_Y, type: 'ceiling_spike', w: 35, h: 60 });
        obstacles.push({ x: 1600, y: FLOOR_Y - 60, type: 'spike', w: 35, h: 60 });
        obstacles.push({ x: 1850, y: 185, type: 'block', w: 75, h: 40 });
        
        obstacles.push({ x: 2150, y: FLOOR_Y - 150, type: 'portal', targetMode: 'ball', w: 25, h: 120 });
        
        obstacles.push({ x: 2350, y: FLOOR_Y - 28, type: 'spike', w: 28, h: 28 });
        obstacles.push({ x: 2550, y: CEILING_Y, type: 'ceiling_spike', w: 28, h: 28 });
        obstacles.push({ x: 2750, y: FLOOR_Y - 28, type: 'spike', w: 28, h: 28 });

        obstacles.push({ x: 3050, y: FLOOR_Y - 150, type: 'portal', targetMode: 'ufo', w: 25, h: 120 });

        obstacles.push({ x: 3300, y: 210, type: 'block', w: 50, h: 50 });
        obstacles.push({ x: 3550, y: FLOOR_Y - 50, type: 'spike', w: 40, h: 50 });
    }
}

// Input Controllers
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
retryBtn.addEventListener('click', handleOverlayButtonClick);

function handleActionStart() {
    if (gameState !== 'playing') return;
    actionPressed = true;

    if (player.mode === 'cube') {
        jumpBufferTimer = BUFFER_WINDOW;
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

function createExplosion(x, y, color, speedMultiplier = 1) {
    particles = [];
    for (let i = 0; i < 35; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 8 * speedMultiplier,
            vy: (Math.random() - 0.5) * 8 * speedMultiplier,
            size: Math.random() * 4 + 2,
            alpha: 1,
            color: color
        });
    }
}

function startGame() {
    menuOverlay.classList.add('hidden');
    endOverlay.classList.add('hidden');
    hud.classList.remove('hidden');
    
    gameState = 'playing';
    cameraX = 0;
    particles = [];
    jumpBufferTimer = 0;
    coyoteTimeTimer = 0;
    
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

function triggerDeath() {
    gameState = 'dying';
    animationTimer = 45; 
    createExplosion(player.x + player.width / 2, player.y + player.height / 2, levelData[currentLevel].color, 1);
}

function triggerVictory() {
    gameState = 'celebrating';
    animationTimer = 60; // Long elegant window to enjoy the level fireworks
    createExplosion(totalLevelWidth - 195, (FLOOR_Y + CEILING_Y) / 2, '#01ff70', 1.5);
}

function handleOverlayButtonClick() {
    if (retryBtn.getAttribute('data-action') === 'next') {
        currentLevel++;
        // Update level choice indicators on menu screen automatically
        levelButtons.forEach(b => {
            b.classList.toggle('active', parseInt(b.getAttribute('data-lvl')) === currentLevel);
        });
        startGame();
    } else if (retryBtn.getAttribute('data-action') === 'menu') {
        endOverlay.classList.add('hidden');
        menuOverlay.classList.remove('hidden');
        gameState = 'menu';
        draw();
    } else {
        startGame(); // Default restart operation
    }
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
        
        if (currentLevel < 5) {
            retryBtn.innerText = "Advance Sequence";
            retryBtn.setAttribute('data-action', 'next');
        } else {
            endTitle.innerText = "System Mastered";
            endSub.innerText = "All architectural frameworks completely synchronized!";
            retryBtn.innerText = "Return to Main Grid";
            retryBtn.setAttribute('data-action', 'menu');
        }
    } else {
        endTitle.innerText = "System Crash";
        endTitle.style.textShadow = "0 0 15px #ff2a6d";
        endSub.innerText = `Sync breakdown at: ${Math.min(100, Math.floor((cameraX / (totalLevelWidth - 800)) * 100))}%`;
        retryBtn.innerText = "Reboot System";
        retryBtn.setAttribute('data-action', 'retry');
    }
}

function checkCollision(r1, r2) {
    return r1.x < r2.x + r2.w &&
           r1.x + r1.w > r2.x &&
           r1.y < r2.y + r2.h &&
           r1.y + r1.h > r2.y;
}

function update() {
    // Handling Death Particles Simulation Look
    if (gameState === 'dying') {
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= 0.02;
        });
        animationTimer--;
        if (animationTimer <= 0) endGame(false);
        return;
    }

    // Handling Celebration Animation Sequence Look
    if (gameState === 'celebrating') {
        cameraX += gameSpeed * 0.3; // camera smoothly pans slightly forward
        player.x += gameSpeed * 0.3;
        player.rotation += 0.15;   // rapid victory rotation spins
        
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= 0.015;
        });
        
        animationTimer--;
        if (animationTimer <= 0) endGame(true);
        return;
    }

    if (gameState !== 'playing') return;

    if (jumpBufferTimer > 0) jumpBufferTimer--;
    if (coyoteTimeTimer > 0) coyoteTimeTimer--;

    // --- HORIZONTAL MOVEMENT ---
    cameraX += gameSpeed;
    player.x = cameraX + 100;

    let playerRectX = { x: player.x, y: player.y, w: player.width, h: player.height };

    for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        let obsBox = { x: obs.x, y: obs.y, w: obs.w, h: obs.h };
        if (obs.type === 'spike' || obs.type === 'ceiling_spike') obsBox.h = obs.h - 4;

        if (checkCollision(playerRectX, obsBox)) {
            if (obs.type === 'portal') {
                if (player.mode !== obs.targetMode) {
                    player.mode = obs.targetMode;
                    player.vy = 0;
                }
            } else {
                triggerDeath();
                return;
            }
        }
    }

    // --- VERTICAL MOVEMENT & GRAVITY ---
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

    let dynamicGrounded = false;
    player.y += player.vy;

    // Boundaries
    if (player.y >= FLOOR_Y - player.height) {
        if (!(player.mode === 'ball' && player.ballGravityDir === -1)) {
            player.y = FLOOR_Y - player.height;
            player.vy = 0;
            dynamicGrounded = true;
        }
    } else if (player.y <= CEILING_Y) {
        if (!(player.mode === 'ball' && player.ballGravityDir === 1)) {
            player.y = CEILING_Y;
            player.vy = 0;
            dynamicGrounded = true;
        }
    }

    // Platforms
    let playerRectY = { x: player.x, y: player.y, w: player.width, h: player.height };
    
    for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        let obsBox = { x: obs.x, y: obs.y, w: obs.w, h: obs.h };

        if (checkCollision(playerRectY, obsBox)) {
            if (obs.type === 'block') {
                if (player.vy >= 0 && (player.y + player.height - player.vy) <= obs.y + 6 && player.ballGravityDir === 1) {
                    player.y = obs.y - player.height;
                    player.vy = 0;
                    dynamicGrounded = true;
                } 
                else if (player.vy <= 0 && (player.y - player.vy) >= (obs.y + obs.h - 6) && player.ballGravityDir === -1) {
                    player.y = obs.y + obs.h;
                    player.vy = 0;
                    dynamicGrounded = true;
                } else {
                    triggerDeath();
                    return;
                }
            } else if (obs.type === 'spike' || obs.type === 'ceiling_spike') {
                triggerDeath();
                return;
            }
        }
    }

    if (dynamicGrounded) {
        player.isGrounded = true;
        coyoteTimeTimer = COYOTE_WINDOW; 
    } else if (coyoteTimeTimer <= 0) {
        player.isGrounded = false;
    }

    // Controls Engine Logic Resolved
    if (player.mode === 'cube') {
        if (jumpBufferTimer > 0 && (player.isGrounded || coyoteTimeTimer > 0)) {
            player.vy = JUMP_FORCE;
            player.isGrounded = false;
            coyoteTimeTimer = 0;
            jumpBufferTimer = 0; 
        }
    }

    // --- ROTATION TRACKING ---
    if (player.mode === 'cube') {
        if (player.isGrounded) {
            player.rotation = Math.round(player.rotation / (Math.PI / 2)) * (Math.PI / 2);
        } else {
            player.rotation += 0.09; 
        }
    } else if (player.mode === 'ship' || player.mode === 'ufo') {
        player.rotation = player.vy * 0.05;
    } else if (player.mode === 'ball') {
        player.rotation += 0.08 * player.ballGravityDir;
    }

    let progress = Math.min(100, Math.floor((cameraX / (totalLevelWidth - 800)) * 100));
    progressDisplay.innerText = `Progress: ${progress}%`;
    modeBadge.innerText = player.mode;

    // Check level completion crossing point
    if (cameraX >= totalLevelWidth - 800) {
        triggerVictory();
        return;
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(-cameraX, 0); 

    // Grid Array Render
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    let gridSize = 50;
    let startGridX = Math.floor(cameraX / gridSize) * gridSize;
    for (let x = startGridX; x < startGridX + canvas.width + gridSize; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, CEILING_Y); ctx.lineTo(x, FLOOR_Y); ctx.stroke();
    }

    // Map Boundaries
    ctx.fillStyle = '#06030b';
    ctx.fillRect(cameraX, FLOOR_Y, canvas.width, canvas.height - FLOOR_Y);
    ctx.fillRect(cameraX, 0, canvas.width, CEILING_Y);
    
    ctx.strokeStyle = levelData[currentLevel].color;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cameraX, FLOOR_Y); ctx.lineTo(cameraX + canvas.width, FLOOR_Y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cameraX, CEILING_Y); ctx.lineTo(cameraX + canvas.width, CEILING_Y); ctx.stroke();

    // Goal Gate Layout
    ctx.fillStyle = '#01ff70';
    ctx.fillRect(totalLevelWidth - 200, CEILING_Y, 10, FLOOR_Y - CEILING_Y);

    // Obstacles Layer
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

    // Render death or victory fireworks particles
    if (gameState === 'dying' || gameState === 'celebrating') {
        particles.forEach(p => {
            ctx.save();
            ctx.globalAlpha = Math.max(0, p.alpha);
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 10;
            ctx.shadowColor = p.color;
            ctx.fillRect(p.x, p.y, p.size, p.size);
            ctx.restore();
        });
    }

    // Render active player avatar
    if (gameState === 'playing' || gameState === 'celebrating') {
        ctx.save();
        ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
        ctx.rotate(player.rotation);

        ctx.fillStyle = '#fff'; 
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2.5;

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
    }

    ctx.restore();
}

function loop() {
    update();
    draw();
    if (gameState === 'playing' || gameState === 'dying' || gameState === 'celebrating') {
        animationFrameId = requestAnimationFrame(loop);
    }
}

draw();