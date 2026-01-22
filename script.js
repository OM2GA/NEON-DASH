const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const bestElement = document.getElementById('bestScore');
const menu = document.getElementById('menu');
const gameUI = document.getElementById('gameUI');
const gameOverScreen = document.getElementById('gameOver');
const finalScoreElement = document.getElementById('finalScore');
const totalNéonsMenu = document.getElementById('totalNéonsMenu');
const currentNéonsHUD = document.getElementById('currentNéonsHUD');
const earnedNéonsElement = document.getElementById('earnedNéons');
const shopElement = document.getElementById('shop');
const shopGrid = document.getElementById('shopGrid');
const shopNéonsText = document.getElementById('shopNéons');
const deathBar = document.getElementById('deathBar');
const reviveCostElement = document.getElementById('reviveCost');
const reviveBtn = document.getElementById('reviveBtn');

// Configuration
const CONFIG = {
    baseWidth: 800,
    baseHeight: 400,
    playerX: 80,
    playerSize: 30,
    gravity: 0.6,
    initialSpeed: 6,
    obstacleInterval: 1000,
    particleInterval: 30,
    trailMax: 12,
    coinInterval: 1200,
    coinSize: 22
};

canvas.width = CONFIG.baseWidth;
canvas.height = CONFIG.baseHeight;

// Variables Globales
let score = 0;
let totalNéons = parseInt(localStorage.getItem('totalNéons')) || 0;
let currentSessionNéons = 0;
let ownedParticles = JSON.parse(localStorage.getItem('ownedParticles')) || ['square'];
let activeParticle = localStorage.getItem('activeParticle') || 'square';
let ownedPlayerColors = JSON.parse(localStorage.getItem('ownedPlayerColors')) || ['default'];
let activePlayerColor = localStorage.getItem('activePlayerColor') || 'default';
let ownedParticleColors = JSON.parse(localStorage.getItem('ownedParticleColors')) || ['default'];
let activeParticleColor = localStorage.getItem('activeParticleColor') || 'default';
let currentShopTab = 'shapes';
let gameActive = false;
let gameSpeed = CONFIG.initialSpeed;
let obstacles = [];
let coins = [];
let particles = [];
let trail = [];
let backgroundLayers = [];
// Gestion de la mort et revive
let deathTimer = null;
let deathTimeLeft = 100; // Pourcentage
let reviveCost = 10;
let revivesInSession = 0;
// Gestion de la rotation
let targetRotation = 0;
let currentRotation = 0;
let activeThemeKey = 'neon';
let lastTime = 0;
let lastObstacleTime = 0;
let lastCoinTime = 0;
let lastParticleTime = 0;
let shakeAmount = 0;
let scaleFactor = 1;

// Système de Redimensionnement Responsive
function resize() {
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    // On garde le ratio basé sur la hauteur de base (400px)
    scaleFactor = height / CONFIG.baseHeight;
    const virtualWidth = width / scaleFactor;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr * scaleFactor, dpr * scaleFactor);

    // Update CONFIG baseWidth pour que les obstacles apparaissent au bon endroit
    CONFIG.baseWidth = virtualWidth;
}

window.addEventListener('resize', resize);
resize();

// Gestionnaire d'Écrans (Transitions fluides)
function showScreen(screenId) {
    const screens = ['menu', 'shop', 'gameUI', 'gameOver', 'deathScreen'];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (id === screenId) {
            el.classList.add('screen-active');
        } else {
            el.classList.remove('screen-active');
        }
    });
}


const themes = {
    neon: { player: "#00ffcc", obs: "#ff0055", bg: "#080b12", name: "CYBER NEON", speed: 5, interval: 1200, increase: 0.003, reward: 1 },
    lava: { player: "#ffcc00", obs: "#ff4400", bg: "#1a0f0f", name: "LAVA CAVE", speed: 7, interval: 1000, increase: 0.005, reward: 2 },
    ice: { player: "#ffffff", obs: "#00d4ff", bg: "#0f172a", name: "FROZEN NIGHT", speed: 9, interval: 800, increase: 0.008, reward: 3 }
};

let currentTheme = themes['neon'];

const particleStyles = {
    square: { name: "CARRE", icon: "□", price: 0, draw: (ctx, x, y, s) => ctx.fillRect(x - s / 2, y - s / 2, s, s) },
    circle: { name: "ROND", icon: "○", price: 0, draw: (ctx, x, y, s) => { ctx.beginPath(); ctx.arc(x, y, s / 2, 0, Math.PI * 2); ctx.fill(); } },
    triangle: { name: "TRIANGLE", icon: "△", price: 0, draw: (ctx, x, y, s) => { ctx.beginPath(); ctx.moveTo(x, y - s / 2); ctx.lineTo(x + s / 2, y + s / 2); ctx.lineTo(x - s / 2, y + s / 2); ctx.closePath(); ctx.fill(); } },
    star: { name: "ETOILE", icon: "☆", price: 0, draw: (ctx, x, y, s) => { ctx.beginPath(); for (let i = 0; i < 5; i++) { ctx.lineTo(x + Math.cos((18 + i * 72) * Math.PI / 180) * s / 2, y - Math.sin((18 + i * 72) * Math.PI / 180) * s / 2); ctx.lineTo(x + Math.cos((54 + i * 72) * Math.PI / 180) * s / 4, y - Math.sin((54 + i * 72) * Math.PI / 180) * s / 4); } ctx.closePath(); ctx.fill(); } },
    diamond: { name: "LOSANGE", icon: "◇", price: 0, draw: (ctx, x, y, s) => { ctx.beginPath(); ctx.moveTo(x, y - s / 2); ctx.lineTo(x + s / 2, y); ctx.lineTo(x, y + s / 2); ctx.lineTo(x - s / 2, y); ctx.closePath(); ctx.fill(); } },
    hexagon: { name: "HEXAGONE", icon: "⬡", price: 0, draw: (ctx, x, y, s) => { ctx.beginPath(); for (let i = 0; i < 6; i++) { ctx.lineTo(x + Math.cos(i * Math.PI / 3) * s / 2, y + Math.sin(i * Math.PI / 3) * s / 2); } ctx.closePath(); ctx.fill(); } },
    cross: { name: "CROIX", icon: "✕", price: 0, draw: (ctx, x, y, s) => { ctx.fillRect(x - s / 2, y - s / 6, s, s / 3); ctx.fillRect(x - s / 6, y - s / 2, s / 3, s); } }
};

const customColors = {
    default: { name: "THEME", value: null, price: 0 },
    neon: { name: "NEON", value: "#00ffcc", price: 0 },
    gold: { name: "OR", value: "#ffd700", price: 0 },
    ruby: { name: "RUBY", value: "#ff0055", price: 0 },
    ice: { name: "GLACE", value: "#00d4ff", price: 0 },
    purple: { name: "VIOLET", value: "#a855f7", price: 0 },
    white: { name: "BLANC", value: "#ffffff", price: 0 }
};

const player = { x: CONFIG.playerX, y: 200, size: CONFIG.playerSize, velocity: 0, onCeiling: false };

function startGame(themeKey) {
    activeThemeKey = themeKey;
    currentTheme = themes[themeKey];
    showScreen('gameUI');
    canvas.style.backgroundColor = currentTheme.bg;
    bestElement.innerText = `Record: ${Math.floor(localStorage.getItem(`best_${themeKey}`) || 0)}`;

    resetStats();
    initBackground();
    gameActive = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
}

function resetStats() {
    score = 0;
    gameSpeed = currentTheme.speed;
    obstacles = [];
    coins = [];
    particles = [];
    trail = [];
    player.y = CONFIG.baseHeight / 2 - CONFIG.playerSize / 2;
    player.velocity = 0;
    player.onCeiling = false;
    targetRotation = 0;
    currentRotation = 0;
    lastObstacleTime = 0;
    lastCoinTime = 0;
    lastParticleTime = 0;
    shakeAmount = 0;
    currentSessionNéons = 0;
    revivesInSession = 0;
    reviveCost = 10;
    updateNéonUI();
}

function updateNéonUI() {
    if (totalNéonsMenu) totalNéonsMenu.innerText = `Néons: ${totalNéons}`;
    if (currentNéonsHUD) currentNéonsHUD.innerText = `Néons: ${currentSessionNéons}`;
}

function initBackground() {
    backgroundLayers = [];
    for (let i = 0; i < 3; i++) {
        let stars = [];
        const count = 20 + i * 15;
        for (let j = 0; j < count; j++) {
            stars.push({ x: Math.random() * CONFIG.baseWidth, y: Math.random() * CONFIG.baseHeight, size: (i + 1) * 1.5, speed: (i + 1) * 0.15 });
        }
        backgroundLayers.push(stars);
    }
}

function openShop() { showScreen('shop'); currentShopTab = 'shapes'; renderShop(); }
function closeShop() { showScreen('menu'); updateNéonUI(); }

function switchTab(tab) {
    currentShopTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.innerText.toLowerCase().includes(tab.split('-')[1] || tab)) btn.classList.add('active');
        // Simple heuristic for tab activation
        if (tab === 'shapes' && btn.innerText === 'FORMES') btn.classList.add('active');
        if (tab === 'colors-player' && btn.innerText === 'COULEUR FORME') btn.classList.add('active');
        if (tab === 'colors-particles' && btn.innerText === 'COULEUR PARTICULES') btn.classList.add('active');
    });
    renderShop();
}

function renderShop() {
    shopNéonsText.innerText = totalNéons;
    shopGrid.innerHTML = '';

    if (currentShopTab === 'shapes') {
        Object.keys(particleStyles).forEach(key => {
            const style = particleStyles[key];
            const owned = ownedParticles.includes(key);
            const selected = activeParticle === key;
            const card = document.createElement('div');
            card.className = `shop-item ${owned ? 'owned' : ''} ${selected ? 'selected' : ''}`;
            card.innerHTML = `
                <div class="item-preview">${style.icon}</div>
                <div class="item-name">${style.name}</div>
                ${!owned ? `<div class="item-price">${style.price} NÉONS</div>` : '<div class="item-price">POSSÉDÉ</div>'}
                <button class="btn-buy ${owned ? 'owned' : ''}" onclick="processItem('${key}')">${selected ? 'SÉLECTIONNÉ' : owned ? 'CHOISIR' : 'ACHETER'}</button>
            `;
            shopGrid.appendChild(card);
        });
    } else {
        const isPlayer = currentShopTab === 'colors-player';
        const ownedList = isPlayer ? ownedPlayerColors : ownedParticleColors;
        const activeItem = isPlayer ? activePlayerColor : activeParticleColor;

        Object.keys(customColors).forEach(key => {
            const color = customColors[key];
            const owned = ownedList.includes(key);
            const selected = activeItem === key;
            const card = document.createElement('div');
            card.className = `shop-item ${owned ? 'owned' : ''} ${selected ? 'selected' : ''}`;

            const colorValue = color.value || (isPlayer ? currentTheme.player || '#00ffcc' : currentTheme.player || '#00ffcc');

            card.innerHTML = `
                <div class="color-preview" style="background: ${colorValue}; --glow-color: ${colorValue}"></div>
                <div class="item-name">${color.name}</div>
                ${!owned ? `<div class="item-price">${color.price} NÉONS</div>` : '<div class="item-price">POSSÉDÉ</div>'}
                <button class="btn-buy ${owned ? 'owned' : ''}" onclick="processColor('${key}', ${isPlayer})">${selected ? 'SÉLECTIONNÉ' : owned ? 'CHOISIR' : 'ACHETER'}</button>
            `;
            shopGrid.appendChild(card);
        });
    }
}

function processItem(key) {
    if (ownedParticles.includes(key)) {
        activeParticle = key;
        localStorage.setItem('activeParticle', key);
    } else {
        const style = particleStyles[key];
        if (totalNéons >= style.price) {
            totalNéons -= style.price;
            ownedParticles.push(key);
            activeParticle = key;
            localStorage.setItem('totalNéons', totalNéons);
            localStorage.setItem('ownedParticles', JSON.stringify(ownedParticles));
            localStorage.setItem('activeParticle', key);
        } else {
            alert("Néons insuffisants !");
        }
    }
    renderShop();
}

function processColor(key, isPlayer) {
    const ownedList = isPlayer ? ownedPlayerColors : ownedParticleColors;
    const storageOwnedKey = isPlayer ? 'ownedPlayerColors' : 'ownedParticleColors';
    const storageActiveKey = isPlayer ? 'activePlayerColor' : 'activeParticleColor';

    if (ownedList.includes(key)) {
        if (isPlayer) activePlayerColor = key;
        else activeParticleColor = key;
        localStorage.setItem(storageActiveKey, key);
    } else {
        const color = customColors[key];
        if (totalNéons >= color.price) {
            totalNéons -= color.price;
            ownedList.push(key);
            if (isPlayer) activePlayerColor = key;
            else activeParticleColor = key;

            localStorage.setItem('totalNéons', totalNéons);
            localStorage.setItem(storageOwnedKey, JSON.stringify(ownedList));
            localStorage.setItem(storageActiveKey, key);
        } else {
            alert("Néons insuffisants !");
        }
    }
    renderShop();
}

function createParticle(x, y, vx, vy, color, size) {
    particles.push({ x, y, vx, vy, life: 1.0, size, style: activeParticle, color });
}

function createCoin() {
    const obs = obstacles.find(o => o.x > CONFIG.baseWidth - 120);
    let yPos = obs ? (obs.y === 0 ? CONFIG.baseHeight - 80 - Math.random() * 40 : 40 + Math.random() * 40) : (CONFIG.baseHeight / 2 - 10) + (Math.random() - 0.5) * 160;
    coins.push({ x: CONFIG.baseWidth, y: yPos, size: CONFIG.coinSize, collected: false, pulse: 0 });
}

function update(dt) {
    if (!gameActive) return;
    const factor = dt / 16.67;
    score += factor;
    scoreElement.innerText = `Score: ${Math.floor(score)}`;
    if (Math.floor(score) % 1000 < 2 && Math.floor(score) > 0) gameSpeed += currentTheme.increase;
    if (shakeAmount > 0) shakeAmount *= 0.9;

    backgroundLayers.forEach(layer => layer.forEach(s => { s.x -= gameSpeed * s.speed * factor; if (s.x < -20) s.x = CONFIG.baseWidth + 20; }));

    player.velocity += (player.onCeiling ? -CONFIG.gravity : CONFIG.gravity) * factor;
    player.y += player.velocity * factor;
    player.y = Math.max(0, Math.min(CONFIG.baseHeight - player.size, player.y));
    if (player.y === 0 || player.y === CONFIG.baseHeight - player.size) player.velocity = 0;

    trail.unshift({ x: player.x, y: player.y, rotation: currentRotation });
    if (trail.length > CONFIG.trailMax) trail.pop();

    lastParticleTime += dt;
    if (lastParticleTime > CONFIG.particleInterval) {
        const pColor = customColors[activeParticleColor].value || currentTheme.player;
        createParticle(player.x, player.y + player.size / 2, -Math.random() * 3 - 2, (Math.random() - 0.5) * 4, pColor, Math.random() * 6 + 2);
        lastParticleTime = 0;
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * factor; p.y += p.vy * factor; p.life -= 0.02 * factor;
        if (p.life <= 0) particles.splice(i, 1);
    }

    lastObstacleTime += dt;
    if (lastObstacleTime > Math.max(450, currentTheme.interval - (gameSpeed * 40))) {
        const isTop = Math.random() > 0.5;
        const h = 60 + Math.random() * 120;
        obstacles.push({ x: CONFIG.baseWidth, y: isTop ? 0 : CONFIG.baseHeight - h, w: 35, h: h });
        lastObstacleTime = 0;
    }

    obstacles.forEach((o, i) => {
        o.x -= gameSpeed * factor;
        if (checkCollision(player, o)) endGame();
        if (o.x + o.w < 0) obstacles.splice(i, 1);
    });

    lastCoinTime += dt;
    if (lastCoinTime > CONFIG.coinInterval) { createCoin(); lastCoinTime = 0; }

    coins.forEach((c, i) => {
        c.x -= gameSpeed * factor; c.pulse += 0.1 * factor;
        if (!c.collected && checkCollision(player, { x: c.x - 2, y: c.y - 2, w: c.size + 4, h: c.size + 4 })) {
            c.collected = true; currentSessionNéons += currentTheme.reward; updateNéonUI();
            for (let j = 0; j < 8; j++) createParticle(c.x, c.y, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, "#ffd700", Math.random() * 4 + 2);
        }
        if (c.x + c.size < 0 || c.collected) coins.splice(i, 1);
    });
}

function checkCollision(p, o) {
    const pad = 4;
    return p.x + pad < o.x + o.w && p.x + p.size - pad > o.x && p.y + pad < o.y + o.h && p.y + p.size - pad > o.y;
}

function draw() {
    ctx.save();
    if (shakeAmount > 0.1) ctx.translate((Math.random() - 0.5) * shakeAmount, (Math.random() - 0.5) * shakeAmount);
    ctx.clearRect(-100, -100, CONFIG.baseWidth + 200, CONFIG.baseHeight + 200);

    backgroundLayers.forEach((layer, index) => {
        ctx.fillStyle = currentTheme.obs + (index === 0 ? "22" : index === 1 ? "44" : "66");
        layer.forEach(s => {
            if (activeThemeKey === 'neon') ctx.fillRect(s.x, s.y, s.size, s.size);
            else if (activeThemeKey === 'lava') { ctx.beginPath(); ctx.arc(s.x, s.y, s.size / 2, 0, Math.PI * 2); ctx.fill(); }
            else { ctx.beginPath(); ctx.moveTo(s.x, s.y - s.size); ctx.lineTo(s.x + s.size, s.y); ctx.lineTo(s.x, s.y + s.size); ctx.lineTo(s.x - s.size, s.y); ctx.closePath(); ctx.fill(); }
        });
    });

    const style = particleStyles[activeParticle] || particleStyles.square;
    const pColor = customColors[activePlayerColor].value || currentTheme.player;
    const partColor = customColors[activeParticleColor].value || currentTheme.player;

    trail.forEach((pos, index) => {
        ctx.globalAlpha = ((CONFIG.trailMax - index) / CONFIG.trailMax) * 0.3;
        ctx.save();
        ctx.translate(pos.x + player.size / 2, pos.y + player.size / 2);
        ctx.rotate(pos.rotation);
        ctx.fillStyle = pColor;
        style.draw(ctx, 0, 0, player.size);
        ctx.restore();
    });

    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color || partColor;
        (particleStyles[p.style] || style).draw(ctx, p.x, p.y, p.size);
    });
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(player.x + player.size / 2, player.y + player.size / 2);
    currentRotation += (targetRotation - currentRotation) * 0.15;
    ctx.rotate(currentRotation);
    ctx.shadowBlur = 15; ctx.shadowColor = pColor; ctx.fillStyle = pColor;
    style.draw(ctx, 0, 0, player.size);
    ctx.restore();

    ctx.shadowBlur = 10; ctx.shadowColor = currentTheme.obs; ctx.fillStyle = currentTheme.obs;
    obstacles.forEach(o => ctx.fillRect(o.x, o.y, o.w, o.h));

    ctx.shadowBlur = 15; ctx.shadowColor = "#ffd700"; ctx.fillStyle = "#ffd700"; ctx.strokeStyle = "white"; ctx.lineWidth = 2;
    coins.forEach(c => {
        const ps = Math.sin(c.pulse) * 4;
        ctx.beginPath(); ctx.moveTo(c.x + c.size / 2, c.y - ps); ctx.lineTo(c.x + c.size + ps, c.y + c.size / 2); ctx.lineTo(c.x + c.size / 2, c.y + c.size + ps); ctx.lineTo(c.x - ps, c.y + c.size / 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    });

    ctx.restore();
}

function loop(timestamp) {
    if (!gameActive) return;
    if (!lastTime) lastTime = timestamp;
    update(Math.min(100, timestamp - lastTime));
    lastTime = timestamp;
    draw();
    requestAnimationFrame(loop);
}

function switchGravity() { if (gameActive) { player.onCeiling = !player.onCeiling; targetRotation += Math.PI; shakeAmount = 8; } }

function endGame() {
    gameActive = false;
    shakeAmount = 20;

    // Calculer le coût de revive
    reviveCost = 10 + (revivesInSession * 15);
    reviveCostElement.innerText = reviveCost;

    // Désactiver le bouton si pas assez de néons
    if (totalNéons < reviveCost) {
        reviveBtn.disabled = true;
        reviveBtn.innerText = "PAS ASSEZ DE NÉONS";
    } else {
        reviveBtn.disabled = false;
        reviveBtn.innerText = "REVIVRE";
    }

    setTimeout(() => {
        showScreen('deathScreen');
        startDeathTimer();
    }, 500);
}

function startDeathTimer() {
    deathTimeLeft = 100;
    deathBar.style.width = '100%';

    if (deathTimer) clearInterval(deathTimer);

    deathTimer = setInterval(() => {
        deathTimeLeft -= 2; // ~2.5 secondes total (50 iterations * 100ms)
        deathBar.style.width = `${deathTimeLeft}%`;

        if (deathTimeLeft <= 0) {
            clearInterval(deathTimer);
            confirmDeath();
        }
    }, 50);
}

function revivePlayer() {
    if (totalNéons >= reviveCost) {
        totalNéons -= reviveCost;
        revivesInSession++;
        localStorage.setItem('totalNéons', totalNéons);

        clearInterval(deathTimer);

        // Supprimer les obstacles proches du joueur pour éviter de remourir instantanément
        obstacles = obstacles.filter(o => o.x > player.x + 200 || o.x < player.x - 50);

        // Reset position joueur
        player.y = CONFIG.baseHeight / 2 - CONFIG.playerSize / 2;
        player.velocity = 0;

        showScreen('gameUI');
        gameActive = true;
        lastTime = performance.now();
        requestAnimationFrame(loop);
        updateNéonUI();
    }
}

function confirmDeath() {
    clearInterval(deathTimer);
    const best = Math.floor(Math.max(score, localStorage.getItem(`best_${activeThemeKey}`) || 0));
    localStorage.setItem(`best_${activeThemeKey}`, best);
    totalNéons += currentSessionNéons;
    localStorage.setItem('totalNéons', totalNéons);

    showScreen('gameOver');
    earnedNéonsElement.innerText = `+${currentSessionNéons}`;
    finalScoreElement.innerHTML = `<span style="color: ${currentTheme.player}">${currentTheme.name}</span><br>SCORE: ${Math.floor(score)}<br><span style="font-size: 0.8em; color: #ffd700;">RECORD: ${best}</span>`;
    updateNéonUI();
}

function backToMenu() { showScreen('menu'); updateNéonUI(); }
updateNéonUI();
// Initialiser le premier écran
showScreen('menu');
window.addEventListener('keydown', e => { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); switchGravity(); } });
canvas.addEventListener('mousedown', e => { e.preventDefault(); switchGravity(); });
canvas.addEventListener('touchstart', e => { e.preventDefault(); switchGravity(); }, { passive: false });