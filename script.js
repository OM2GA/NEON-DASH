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

// Variables Réseau
let peer = null;
let conn = null; // Connexion unique si on est client
let connections = []; // Liste des connexions si on est host
let isHost = false;
let players = {}; // {id: {x, y, pseudo, color, isAlive, isReady, shape, partColor, trail: []}}
let isReady = false;
let isSpectating = false;
let spectatedPlayerId = null;

// Chargement du pseudo au démarrage
window.addEventListener('DOMContentLoaded', () => {
    const savedPseudo = localStorage.getItem('playerPseudo');
    if (savedPseudo) {
        document.getElementById('playerName').value = savedPseudo;
    }
});

// Système de Redimensionnement Responsive
function resize() {
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    // On fixe la résolution virtuelle à 800x400 pour garantir l'équité (Multiplayer Safe)
    const virtualWidth = 800;
    const virtualHeight = 400;
    const targetAspect = virtualWidth / virtualHeight;
    const currentAspect = width / height;

    // On calcule le scaleFactor pour que le rectangle 800x400 rentre dans l'écran
    if (currentAspect > targetAspect) {
        scaleFactor = height / virtualHeight;
    } else {
        scaleFactor = width / virtualWidth;
    }

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    // Centrage du canvas : on calcule les offsets
    const offsetX = (width - (virtualWidth * scaleFactor)) / 2;
    const offsetY = (height - (virtualHeight * scaleFactor)) / 2;

    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset
    ctx.scale(dpr, dpr);
    ctx.translate(offsetX, offsetY);
    ctx.scale(scaleFactor, scaleFactor);

    // On garde les dimensions de base fixes pour le moteur de jeu
    CONFIG.baseWidth = virtualWidth;
    CONFIG.baseHeight = virtualHeight;
}

window.addEventListener('resize', resize);
resize();

// Gestionnaire d'Écrans (Transitions fluides)
function showScreen(screenId) {
    const screens = ['menu', 'shop', 'gameUI', 'gameOver', 'deathScreen', 'multiMenu'];
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

    isSpectating = false;
    spectatedPlayerId = null;
    document.getElementById('spectateBtn').style.display = 'none';

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
        const count = 30 + i * 20; // Plus d'étoiles pour l'immersion
        for (let j = 0; j < count; j++) {
            stars.push({
                x: Math.random() * CONFIG.baseWidth,
                y: Math.random() * CONFIG.baseHeight,
                size: (i + 1) * 1.5,
                speed: (i + 1) * 0.15
            });
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

// --- LOGIQUE MULTIJOUEUR ---
function openMultiMenu() {
    showScreen('multiMenu');
    // On initialise un Peer par défaut si ce n'est pas déjà fait 
    // pour permettre de rejoindre immédiatement
    if (!peer) {
        const randomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        initializePeer("ND-" + randomId, false); // false = don't set isHost yet
    }
}

function generateRandomHostCode() {
    if (peer) {
        peer.destroy();
        peer = null;
    }

    const randomId = Math.random().toString(36).substring(2, 7).toUpperCase();
    initializePeer("ND-" + randomId);
}

function hostGame() {
    const manualCode = document.getElementById('joinCode').value.trim().toUpperCase();
    if (peer) {
        peer.destroy();
        peer = null;
    }

    if (manualCode) {
        initializePeer("ND-" + manualCode);
    } else {
        const randomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        initializePeer("ND-" + randomId);
    }
}

function initializePeer(id, setHost = true) {
    if (peer) {
        peer.destroy();
    }

    peer = new Peer(id);

    peer.on('open', (openedId) => {
        if (setHost) {
            document.getElementById('groupCodeDisplay').innerText = "Code du groupe : " + openedId.replace("ND-", "");
            isHost = true;
            connections = [];
            players = {};
            isReady = false;
        } else {
            document.getElementById('groupCodeDisplay').innerText = "";
        }
        updateLobbyUI();
    });

    peer.on('connection', (c) => {
        setupConnHandlers(c);
        if (!connections.includes(c)) connections.push(c);
        isHost = true; // Si on reçoit une connexion, on devient l'hôte
        updateLobbyUI();
    });

    peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
            if (setHost) alert("Ce code est déjà utilisé. Choisis-en un autre ou génère un code aléatoire.");
        } else {
            console.error("PeerJS Error:", err);
        }
    });
}

function joinGame() {
    const code = document.getElementById('joinCode').value.trim().toUpperCase();
    if (!code) {
        alert("Entre le code du groupe !");
        return;
    }

    if (!peer || peer.destroyed) {
        const randomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        initializePeer("ND-" + randomId, false);
        // On doit attendre que le peer soit ouvert avant de connecter
        peer.on('open', () => {
            performConnect(code);
        });
    } else {
        performConnect(code);
    }
}

function performConnect(code) {
    isHost = false;
    conn = peer.connect("ND-" + code);
    connections = [];
    players = {};
    isReady = false;
    setupConnHandlers(conn);
}

function setupConnHandlers(c) {
    c.on('open', () => {
        if (!isHost) {
            document.getElementById('lobbyInfo').style.display = 'block';
        }

        // Envoi immédiat des infos d'identité
        const idData = {
            type: 'identity',
            id: peer.id,
            pseudo: document.getElementById('playerName').value || "Anonyme",
            shape: activeParticle,
            color: customColors[activePlayerColor].value || currentTheme.player,
            partColor: customColors[activeParticleColor].value || currentTheme.player,
            isReady: isReady,
            isAlive: true
        };
        c.send(idData);

        updateLobbyUI();
    });

    c.on('data', (data) => {
        if (data.type === 'init-game') {
            startGame(data.theme);
        }
        if (data.type === 'identity') {
            players[data.id] = {
                ...players[data.id],
                pseudo: data.pseudo,
                shape: data.shape,
                color: data.color,
                partColor: data.partColor,
                isReady: data.isReady,
                trail: []
            };
            updateLobbyUI();
        }
        if (data.type === 'sync') {
            if (!players[data.id]) players[data.id] = { trail: [] };
            Object.assign(players[data.id], data);

            // On gère un petit trail local pour les autres joueurs
            if (data.isAlive !== false) {
                if (!players[data.id].trail) players[data.id].trail = [];
                players[data.id].trail.unshift({ x: CONFIG.playerX, y: data.y });
                if (players[data.id].trail.length > CONFIG.trailMax) players[data.id].trail.pop();

                // Création de particules pour les autres joueurs (visuel local)
                if (gameActive && Math.random() > 0.5) {
                    createParticle(CONFIG.playerX, data.y + CONFIG.playerSize / 2, -Math.random() * 2 - 1, (Math.random() - 0.5) * 2, data.partColor || data.color, Math.random() * 4 + 1);
                }
            } else if (isHost) {
                // Si quelqu'un est mort, l'hôte vérifie si tout le monde est mort pour rentrer au salon
                checkAutoReturnToLobby();
            }
        }
        if (data.type === 'back-to-lobby') {
            returnToLobby();
        }
        if (data.type === 'ready-status') {
            if (players[data.id]) {
                players[data.id].isReady = data.isReady;
                updateLobbyUI();
            }
        }
        if (data.type === 'obstacle-spawn') {
            if (!isHost) {
                obstacles.push(data.obstacle);
            }
        }
        if (data.type === 'speed-sync') {
            if (!isHost) {
                gameSpeed = data.speed;
            }
        }
    });

    c.on('close', () => {
        if (isHost) {
            connections = connections.filter(conn => conn !== c);
        } else {
            conn = null;
        }
        updateLobbyUI();
    });
}

function updateLobbyUI() {
    const count = isHost ? connections.length + 1 : (conn ? 2 : 1);
    document.getElementById('playerCount').innerText = count;
    document.getElementById('lobbyInfo').style.display = 'block';

    // Mise à jour de la liste des statuts
    const statusList = document.getElementById('playerStatusList');
    statusList.innerHTML = '';

    // Soi-même
    addPlayerStatusItem(
        document.getElementById('playerName').value || "Moi",
        isReady,
        statusList
    );

    // Les autres
    Object.keys(players).forEach(id => {
        addPlayerStatusItem(
            players[id].pseudo || "Anonyme",
            players[id].isReady,
            statusList
        );
    });

    const everyoneReady = checkEveryoneReady();

    if (isHost) {
        document.getElementById('hostControls').style.display = 'block';
        document.getElementById('waitMessage').style.display = 'none';

        // Activer/Désactiver les boutons de lancement selon si tout le monde est prêt
        const startButtons = document.querySelectorAll('#hostControls .btn-level-sm');
        startButtons.forEach(btn => {
            btn.disabled = !everyoneReady || connections.length === 0;
            btn.style.opacity = btn.disabled ? "0.5" : "1";
        });
    } else {
        document.getElementById('hostControls').style.display = 'none';
        document.getElementById('waitMessage').style.display = 'block';
        document.getElementById('waitMessage').innerText = everyoneReady ? "Tout le monde est prêt ! Le chef va lancer..." : "En attente des autres joueurs...";
    }
}

function addPlayerStatusItem(pseudo, ready, container) {
    const div = document.createElement('div');
    div.className = 'player-status-item';
    div.innerHTML = `
        <span>${pseudo}</span>
        <span class="status-indicator ${ready ? 'ready' : 'not-ready'}"></span>
    `;
    container.appendChild(div);
}

function toggleReady() {
    isReady = !isReady;
    const btn = document.getElementById('readyBtn');
    btn.innerText = isReady ? "PRÊT" : "PAS PRÊT";
    btn.classList.toggle('active', isReady);

    // Envoyer son statut aux autres
    const readyData = {
        type: 'ready-status',
        id: peer.id,
        isReady: isReady
    };

    if (isHost) {
        connections.forEach(c => c.open && c.send(readyData));
    } else if (conn && conn.open) {
        conn.send(readyData);
    }

    updateLobbyUI();
}

function checkEveryoneReady() {
    if (!isReady) return false;

    for (const id in players) {
        if (!players[id].isReady) return false;
    }

    return true;
}

function broadcastStart(themeKey) {
    if (!isHost) return;

    // 1. Envoyer l'ordre de départ à tous les connectés
    const startData = {
        type: 'init-game',
        theme: themeKey
    };

    connections.forEach(c => {
        if (c.open) c.send(startData);
    });

    // 2. Lancer sa propre partie
    startGame(themeKey);
}
function startMultiGame() {
    // Cette fonction est remplacée par broadcastStart mais on la garde pour assurer la compatibilité si appelée ailleurs
    broadcastStart('neon');
}
// -----------------------------

function update(dt) {
    if (!gameActive) return;
    const factor = dt / 16.67;
    score += factor;
    scoreElement.innerText = `Score: ${Math.floor(score)}`;

    // Sync réseau
    if (peer && (conn || connections.length > 0)) {
        const myData = {
            type: 'sync',
            id: peer.id,
            y: player.y,
            pseudo: document.getElementById('playerName').value || "Anonyme",
            shape: activeParticle,
            color: customColors[activePlayerColor].value || currentTheme.player,
            partColor: customColors[activeParticleColor].value || currentTheme.player,
            isAlive: gameActive && !isSpectating
        };

        if (isHost) {
            connections.forEach(c => c.send(myData));

            // Sync de la vitesse par l'hôte occasionnellement
            if (Math.floor(score) % 50 === 0) {
                connections.forEach(c => {
                    if (c.open) c.send({ type: 'speed-sync', speed: gameSpeed });
                });
            }
        } else if (conn) {
            conn.send(myData);
        }
    }

    if (shakeAmount > 0) shakeAmount *= 0.9;
    if (shakeAmount < 0.1) shakeAmount = 0;

    if (isSpectating) {
        // En mode spectateur, on ne gère que les éléments visuels
        backgroundLayers.forEach(layer => layer.forEach(s => {
            s.x -= gameSpeed * s.speed * factor;
            if (s.x < -20) s.x = 800 + 20;
            if (s.y < -20) s.y = 400 + 20; // Wrapping Y
            if (s.y > 400 + 20) s.y = -20;
        }));

        obstacles.forEach((o, i) => {
            o.x -= gameSpeed * factor;
            if (o.x + o.w < 0) obstacles.splice(i, 1);
        });

        coins.forEach((c, i) => {
            c.x -= gameSpeed * factor; c.pulse += 0.1 * factor;
            if (c.x + c.size < 0 || c.collected) coins.splice(i, 1);
        });

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx * factor; p.y += p.vy * factor; p.life -= 0.02 * factor;
            if (p.life <= 0) particles.splice(i, 1);
        }

        // En mode multi, les obstacles sont reçus de l'hôte
        // En mode solo, on les génère localement (mais isSpectating est normalement false en solo)
        if (!peer || (!conn && connections.length === 0)) {
            lastObstacleTime += dt;
            if (lastObstacleTime > Math.max(450, currentTheme.interval - (gameSpeed * 40))) {
                const isTop = Math.random() > 0.5;
                const h = 60 + Math.random() * 120;
                obstacles.push({ x: 800, y: isTop ? 0 : 400 - h, w: 35, h: h });
                lastObstacleTime = 0;
            }
        }

        lastCoinTime += dt;
        if (lastCoinTime > CONFIG.coinInterval) { createCoin(); lastCoinTime = 0; }

        return;
    }

    if (Math.floor(score) % 1000 < 2 && Math.floor(score) > 0) gameSpeed += currentTheme.increase;

    backgroundLayers.forEach(layer => layer.forEach(s => {
        s.x -= gameSpeed * s.speed * factor;
        if (s.x < -20) s.x = 800 + 20;
        if (s.y < -20) s.y = 400 + 20; // Wrapping Y
        if (s.y > 400 + 20) s.y = -20;
    }));

    player.velocity += (player.onCeiling ? -CONFIG.gravity : CONFIG.gravity) * factor;
    player.y += player.velocity * factor;
    player.y = Math.max(0, Math.min(400 - player.size, player.y));
    if (player.y === 0 || player.y === 400 - player.size) player.velocity = 0;

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
        // Seul le Host génère les obstacles en multi
        if (isHost || !peer || (!conn && connections.length === 0)) {
            const isTop = Math.random() > 0.5;
            const h = 60 + Math.random() * 120;
            const newObs = { x: 800, y: isTop ? 0 : 400 - h, w: 35, h: h };
            obstacles.push(newObs);
            lastObstacleTime = 0;

            // Broadcast de l'obstacle si on est Host
            if (isHost && connections.length > 0) {
                connections.forEach(c => {
                    if (c.open) c.send({ type: 'obstacle-spawn', obstacle: newObs });
                });
            }
        }
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
    ctx.clearRect(-100, -100, 800 + 200, 400 + 200);

    // Dessiner les autres joueurs
    Object.keys(players).forEach(id => {
        const p = players[id];
        if (id !== peer?.id && p.isAlive !== false && p.isAlive !== "false") {
            const otherStyle = particleStyles[p.shape] || particleStyles.square;
            const otherColor = p.color || "white";

            // Dessiner le trail de l'autre joueur
            if (p.trail) {
                p.trail.forEach((pos, index) => {
                    ctx.save();
                    ctx.globalAlpha = ((CONFIG.trailMax - index) / CONFIG.trailMax) * 0.2;
                    ctx.fillStyle = otherColor;
                    ctx.translate(pos.x + CONFIG.playerSize / 2, pos.y + CONFIG.playerSize / 2);
                    otherStyle.draw(ctx, 0, 0, CONFIG.playerSize);
                    ctx.restore();
                });
            }

            ctx.save();
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = otherColor;
            ctx.shadowBlur = 10;
            ctx.shadowColor = otherColor;

            ctx.translate(CONFIG.playerX + CONFIG.playerSize / 2, p.y + CONFIG.playerSize / 2);
            otherStyle.draw(ctx, 0, 0, CONFIG.playerSize);

            ctx.restore();

            // Pseudo
            ctx.fillStyle = "white";
            ctx.font = "bold 12px Rajdhani";
            ctx.textAlign = "center";
            ctx.fillText(p.pseudo, CONFIG.playerX + CONFIG.playerSize / 2, p.y - 12);
        }
    });


    backgroundLayers.forEach((layer, index) => {
        ctx.fillStyle = currentTheme.obs + (index === 0 ? "22" : index === 1 ? "44" : "66");
        layer.forEach(s => {
            if (activeThemeKey === 'neon') ctx.fillRect(s.x, s.y, s.size, s.size);
            else if (activeThemeKey === 'lava') { ctx.beginPath(); ctx.arc(s.x, s.y, s.size / 2, 0, Math.PI * 2); ctx.fill(); }
            else { ctx.beginPath(); ctx.moveTo(s.x, s.y - s.size); ctx.lineTo(s.x + s.size, s.y); ctx.lineTo(s.x, s.y + s.size); ctx.lineTo(s.x, s.y + s.size); ctx.closePath(); ctx.fill(); }
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

    style.draw(ctx, 0, 0, player.size);
    ctx.restore();

    ctx.save();
    ctx.translate(player.x + player.size / 2, player.y + player.size / 2);
    currentRotation += (targetRotation - currentRotation) * 0.15;
    ctx.rotate(currentRotation);
    ctx.shadowBlur = 15; ctx.shadowColor = pColor; ctx.fillStyle = pColor;
    if (isSpectating) ctx.globalAlpha = 0; // Masquer complètement si spectateur
    if (ctx.globalAlpha > 0) style.draw(ctx, 0, 0, player.size);
    ctx.restore();

    if (isSpectating) {
        ctx.fillStyle = "white";
        ctx.font = "bold 20px Rajdhani";
        ctx.textAlign = "center";
        ctx.fillText("MODE SPECTATEUR", 400, 40);

        // Bonus: Flèche au dessus du joueur suivi s'il y en a un qui est vivant
        const alivePlayers = Object.keys(players).filter(id => players[id].isAlive !== false);
        if (alivePlayers.length > 0) {
            const firstAlive = players[alivePlayers[0]];
            ctx.fillStyle = firstAlive.color;
            ctx.beginPath();
            ctx.moveTo(CONFIG.playerX + CONFIG.playerSize / 2, firstAlive.y - 25);
            ctx.lineTo(CONFIG.playerX + CONFIG.playerSize / 2 - 5, firstAlive.y - 35);
            ctx.lineTo(CONFIG.playerX + CONFIG.playerSize / 2 + 5, firstAlive.y - 35);
            ctx.fill();
        }
    }

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

function switchGravity() { if (gameActive && !isSpectating) { player.onCeiling = !player.onCeiling; targetRotation += Math.PI; } }

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

    // Si on est en multi, passage automatique en mode spectateur après un court délai
    if (peer && (conn || connections.length > 0)) {
        setTimeout(() => {
            if (!gameActive && !isSpectating) {
                startSpectating();
            }
        }, 3000); // 3 secondes pour voir ses points gagnés
    }

    updateNéonUI();
    checkAutoReturnToLobby();
}

document.getElementById('playerName').addEventListener('change', (e) => {
    localStorage.setItem('playerPseudo', e.target.value.trim());
});

function startSpectating() {
    isSpectating = true;
    showScreen('gameUI');
    gameActive = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
}

function backToMenu() {
    isSpectating = false;
    showScreen('menu');
    updateNéonUI();
}

// Système de retour au salon automatique
function checkAutoReturnToLobby() {
    if (!peer || (!conn && connections.length === 0)) return;

    // Seul l'hôte décide du retour pour tout le monde
    if (isHost) {
        const anyAliveLocal = gameActive && !isSpectating;
        const anyAliveRemote = Object.keys(players).some(id => players[id].isAlive === true || players[id].isAlive === "true");

        if (!anyAliveLocal && !anyAliveRemote) {
            // On attend un peu pour laisser voir le game over
            setTimeout(() => {
                // On revérifie au cas où
                const stillNoneAlive = !gameActive && Object.keys(players).every(id => players[id].isAlive === false || players[id].isAlive === "false");
                if (stillNoneAlive) {
                    connections.forEach(c => {
                        if (c.open) c.send({ type: 'back-to-lobby' });
                    });
                    returnToLobby();
                }
            }, 2000);
        }
    }
}

function returnToLobby() {
    gameActive = false;
    isSpectating = false;
    isReady = false; // Reset ready state
    const readyBtn = document.getElementById('readyBtn');
    if (readyBtn) {
        readyBtn.innerText = "PAS PRÊT";
        readyBtn.classList.remove('active');
    }

    showScreen('multiMenu');
    updateLobbyUI();
}
updateNéonUI();
// Initialiser le premier écran
showScreen('menu');
window.addEventListener('keydown', e => { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); switchGravity(); } });
canvas.addEventListener('mousedown', e => { e.preventDefault(); switchGravity(); });
canvas.addEventListener('touchstart', e => { e.preventDefault(); switchGravity(); }, { passive: false });