const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const menuCanvas = document.getElementById('menuCanvas');
const menuCtx = menuCanvas.getContext('2d');
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
let powerups = [];
let activePowerups = {}; // {type: timeLeft}
let particles = [];
let trail = [];
let backgroundLayers = [];
// Gestion de la mort et revive
let deathTimer = null;
let deathTimeLeft = 100; // Pourcentage
let reviveCost = 10;
let revivesInSession = 0;

const POWERUP_TYPES = {
    SHIELD: { id: 'shield', icon: '🛡️', color: '#00ffcc', duration: 10000 },
    MAGNET: { id: 'magnet', icon: '🧲', color: '#ffd700', duration: 8000 },
    SLOWMO: { id: 'slowmo', icon: '⏳', color: '#a855f7', duration: 5000 }
};

// Skin personnalisé
let customSkinURL = localStorage.getItem('customSkinURL') || null;
let customSkinImg = null;
if (customSkinURL) {
    customSkinImg = new Image();
    customSkinImg.src = customSkinURL;
}
let cropState = {
    img: null,
    x: 0,
    y: 0,
    zoom: 1,
    isDragging: false,
    startX: 0,
    startY: 0
};

// Paramètres (chargement depuis localStorage ou valeurs par défaut)
let settings = {
    volume: parseInt(localStorage.getItem('setting_volume')) ?? 50,
    particleDensity: localStorage.getItem('setting_particleDensity') || 'medium',
    autoRevive: localStorage.getItem('setting_autoRevive') === 'true'
};

let menuShapes = [];
function initMenuBackground() {
    menuShapes = [];
    for (let i = 0; i < 15; i++) {
        menuShapes.push({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            size: Math.random() * 100 + 50,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            color: Math.random() > 0.5 ? '#00ffcc' : '#a855f7',
            alpha: Math.random() * 0.1 + 0.05,
            rotation: Math.random() * Math.PI * 2,
            vrot: (Math.random() - 0.5) * 0.005,
            points: Math.floor(Math.random() * 3) + 3 // 3=triangle, 4=square, 5=pentagon
        });
    }
}
initMenuBackground();
// Gestion de la rotation
let targetRotation = 0;
let currentRotation = 0;
let activeThemeKey = 'neon';

// Système de Musique
const playlists = {
    neon: [
        "musiques/DLVrai.mp3",
        "musiques/LAYLOW - SPECIAL feat NEKFEU & FOUSHEÉ (paroles).mp3",
        "musiques/Ziak - Galerie (Prod. Devil).mp3"
    ],
    lava: [
        "musiques/GAZO - DIE (Visualizer).mp3",
        "musiques/H.mp3",
        "musiques/SCH - Autobahn (Audio Officiel) 2023.mp3"
    ],
    ice: [
        "musiques/Damso- smog.mp3",
        "musiques/Free YSL.mp3",
        "musiques/Freeze Raël.mp3"
    ]
};

let currentAudio = null;
let currentPlaylist = [];
let currentSongIndex = 0;

function playThemeMusic(themeKey) {
    stopMusic(); // Arrêter toute musique en cours

    // On récupère la playlist du thème et on la mélange (shuffle)
    currentPlaylist = [...playlists[themeKey]].sort(() => Math.random() - 0.5);
    currentSongIndex = 0;

    playNextSong();
}

function playNextSong() {
    if (!gameActive && !isSpectating) return;
    if (currentPlaylist.length === 0) return;

    const songPath = currentPlaylist[currentSongIndex];
    console.log("Lecture de :", songPath);

    // encodeURI est crucial pour les noms de fichiers avec des espaces ou des accents
    currentAudio = new Audio(encodeURI(songPath));
    currentAudio.volume = (settings.volume / 100) * 0.5; // Appliquer le volume des paramètres (avec un max de 0.5 pour l'équilibre)

    currentAudio.play().catch(e => {
        console.warn("La lecture automatique a été bloquée par le navigateur. Cliquez n'importe où pour activer le son.");
        // Tentative de relance au prochain clic si bloqué
        window.addEventListener('mousedown', () => {
            if (currentAudio && currentAudio.paused && (gameActive || isSpectating)) {
                currentAudio.play();
            }
        }, { once: true });
    });

    currentAudio.addEventListener('ended', () => {
        if (gameActive || isSpectating) {
            currentSongIndex = (currentSongIndex + 1) % currentPlaylist.length;
            playNextSong();
        }
    });
}

function stopMusic() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
}
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
let gameEndingTimeout = null;

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
    menuCanvas.width = width * dpr;
    menuCanvas.height = height * dpr;

    // Centrage du canvas : on calcule les offsets
    const offsetX = (width - (virtualWidth * scaleFactor)) / 2;
    const offsetY = (height - (virtualHeight * scaleFactor)) / 2;

    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset
    ctx.scale(dpr, dpr);
    ctx.translate(offsetX, offsetY);
    ctx.scale(scaleFactor, scaleFactor);

    menuCtx.setTransform(1, 0, 0, 1, 0, 0);
    menuCtx.scale(dpr, dpr);

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
            // Cas spécial : on garde le HUD et le Canvas visibles si on est en train de mourir ou en game over
            if (id === 'gameUI' && (screenId === 'deathScreen' || screenId === 'gameOver')) {
                el.classList.add('screen-active');
            } else {
                el.classList.remove('screen-active');
            }
        }
    });

    // Gestion de l'overlay spectateur
    const spectatorQuitBtn = document.getElementById('spectatorQuitBtn');
    if (spectatorQuitBtn) {
        spectatorQuitBtn.style.display = (screenId === 'gameUI' && isSpectating) ? 'block' : 'none';
    }

    // Mise à jour de l'UI des paramètres si on ouvre cet écran
    if (screenId === 'settings') {
        updateSettingsUI();
    }
}

function updateSettingsUI() {
    const volumeSlider = document.getElementById('volumeSlider');
    const volumeValue = document.getElementById('volumeValue');
    const densitySelect = document.getElementById('particleDensity');
    const autoReviveToggle = document.getElementById('autoReviveToggle');
    const pseudoSettings = document.getElementById('playerPseudoSettings');

    volumeSlider.value = settings.volume;
    volumeValue.innerText = settings.volume;
    densitySelect.value = settings.particleDensity;
    autoReviveToggle.checked = settings.autoRevive;
    pseudoSettings.value = localStorage.getItem('playerPseudo') || "";
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

function startGame(themeKey, isMulti = false) {
    activeThemeKey = themeKey;
    currentTheme = themes[themeKey];
    showScreen('gameUI');
    canvas.style.backgroundColor = currentTheme.bg;
    bestElement.innerText = `Record: ${Math.floor(localStorage.getItem(`best_${themeKey}`) || 0)}`;

    isSpectating = false;
    spectatedPlayerId = null;

    // Si on lance en solo alors qu'on était en multi, on coupe les ponts pour éviter les interférences
    if (!isMulti && peer && (conn || connections.length > 0)) {
        console.log("Démarrage Solo : Nettoyage multijoueur...");
        if (conn) { conn.close(); conn = null; }
        connections.forEach(c => c.close());
        connections = [];
        players = {};
        updateLobbyUI();
    }

    powerups = [];
    activePowerups = {};
    const indicators = document.getElementById('powerup-indicators');
    if (indicators) indicators.innerHTML = '';

    resetStats();
    initBackground();
    gameActive = true; // Activer le jeu avant de lancer la musique
    playThemeMusic(themeKey);
    lastTime = performance.now();
}

function resetStats() {
    score = 0;
    gameSpeed = currentTheme.speed;
    obstacles = [];
    coins = [];
    powerups = [];
    activePowerups = {};
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
        if (tab === 'custom-image' && btn.innerText === 'IMAGE (SKIN)') btn.classList.add('active');
    });

    const grid = document.getElementById('shopGrid');
    const editor = document.getElementById('customSkinEditor');

    if (tab === 'custom-image') {
        grid.style.display = 'none';
        editor.style.display = 'flex';
        initCropEditor();
    } else {
        grid.style.display = 'grid';
        editor.style.display = 'none';
        renderShop();
    }
}

function initCropEditor() {
    const input = document.getElementById('skinImageInput');
    const canvas = document.getElementById('cropCanvas');
    const ctxCrop = canvas.getContext('2d');
    const area = document.getElementById('cropArea');
    const saveBtn = document.getElementById('saveCropBtn');
    const resetBtn = document.getElementById('resetSkinBtn');
    const zoomSlider = document.getElementById('cropZoomSlider');

    // On force la taille du canvas de prévisualisation
    canvas.width = 300;
    canvas.height = 300;

    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                cropState.img = img;
                area.style.display = 'block';
                saveBtn.style.display = 'block';

                // Calcul du zoom initial pour couvrir les 300px
                const minZoom = Math.max(300 / img.width, 300 / img.height);
                cropState.zoom = minZoom;
                zoomSlider.value = minZoom;
                zoomSlider.min = minZoom * 0.5;
                zoomSlider.max = minZoom * 5;

                // Centrer
                cropState.x = (300 - img.width * cropState.zoom) / 2;
                cropState.y = (300 - img.height * cropState.zoom) / 2;

                drawCrop();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    function drawCrop() {
        if (!cropState.img) return;
        ctxCrop.clearRect(0, 0, canvas.width, canvas.height);
        ctxCrop.save();
        ctxCrop.translate(cropState.x, cropState.y);
        ctxCrop.scale(cropState.zoom, cropState.zoom);
        ctxCrop.drawImage(cropState.img, 0, 0);
        ctxCrop.restore();

        // On redessine le sélecteur visuellement si besoin, mais ici il est en CSS (cropSelector)
        // Note: cropSelector est au milieu (100,100) et fait 100x100
    }

    zoomSlider.oninput = (e) => {
        const oldZoom = cropState.zoom;
        const newZoom = parseFloat(e.target.value);

        // Zoomer vers le centre du canvas (150, 150)
        const centerX = 150;
        const centerY = 150;
        cropState.x = centerX - (centerX - cropState.x) * (newZoom / oldZoom);
        cropState.y = centerY - (centerY - cropState.y) * (newZoom / oldZoom);

        cropState.zoom = newZoom;
        drawCrop();
    };

    area.onwheel = (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(parseFloat(zoomSlider.min), Math.min(parseFloat(zoomSlider.max), cropState.zoom * delta));

        const oldZoom = cropState.zoom;
        const centerX = e.offsetX;
        const centerY = e.offsetY;

        cropState.x = centerX - (centerX - cropState.x) * (newZoom / oldZoom);
        cropState.y = centerY - (centerY - cropState.y) * (newZoom / oldZoom);

        cropState.zoom = newZoom;
        zoomSlider.value = newZoom;
        drawCrop();
    };

    area.onmousedown = (e) => {
        cropState.isDragging = true;
        cropState.startX = e.clientX - cropState.x;
        cropState.startY = e.clientY - cropState.y;
    };

    window.onmousemove = (e) => {
        if (!cropState.isDragging) return;
        cropState.x = e.clientX - cropState.startX;
        cropState.y = e.clientY - cropState.startY;
        drawCrop();
    };

    window.onmouseup = () => {
        cropState.isDragging = false;
    };

    saveBtn.onclick = () => {
        const resultCanvas = document.createElement('canvas');
        resultCanvas.width = 128;
        resultCanvas.height = 128;
        const rCtx = resultCanvas.getContext('2d');

        // La zone de crop visuelle (le carré pointillé) est à 100,100 et fait 100x100 dans un espace de 300x300
        // On doit transformer ces coordonnées vers l'espace de l'image originale
        const visualCropX = 100;
        const visualCropY = 100;
        const visualCropSize = 100;

        const sourceX = (visualCropX - cropState.x) / cropState.zoom;
        const sourceY = (visualCropY - cropState.y) / cropState.zoom;
        const sourceSize = visualCropSize / cropState.zoom;

        rCtx.drawImage(cropState.img, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 128, 128);

        customSkinURL = resultCanvas.toDataURL('image/jpeg', 0.8);
        localStorage.setItem('customSkinURL', customSkinURL);
        customSkinImg = new Image();
        customSkinImg.src = customSkinURL;
        alert("Skin personnalisé enregistré !");
    };

    resetBtn.onclick = () => {
        customSkinURL = null;
        customSkinImg = null;
        localStorage.removeItem('customSkinURL');
        area.style.display = 'none';
        saveBtn.style.display = 'none';
        alert("Skin réinitialisé (couleurs classiques).");
    };
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
    // Filtrage selon la densité de particules
    if (settings.particleDensity === 'low' && Math.random() > 0.3) return;
    if (settings.particleDensity === 'medium' && Math.random() > 0.7) return;
    // 'high' laisse tout passer

    particles.push({ x, y, vx, vy, life: 1.0, size, style: activeParticle, color });
}

function createCoin() {
    const obs = obstacles.find(o => o.x > CONFIG.baseWidth - 120);
    let yPos = obs ? (obs.y === 0 ? CONFIG.baseHeight - 80 - Math.random() * 40 : 40 + Math.random() * 40) : (CONFIG.baseHeight / 2 - 10) + (Math.random() - 0.5) * 160;
    coins.push({ x: CONFIG.baseWidth, y: yPos, size: CONFIG.coinSize, collected: false, pulse: 0 });

    // Spawn rare de Power-up
    if (Math.random() > 0.85) {
        const types = Object.keys(POWERUP_TYPES);
        const typeKey = types[Math.floor(Math.random() * types.length)];
        powerups.push({
            x: CONFIG.baseWidth + 50,
            y: (CONFIG.baseHeight / 2) + (Math.random() - 0.5) * 200,
            type: POWERUP_TYPES[typeKey],
            size: 25,
            pulse: 0
        });
    }
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
            startGame(data.theme, true); // true = Multi
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
        if (data.type === 'show-game-over') {
            confirmDeath();
        }
    });

    c.on('close', () => {
        if (isHost) {
            connections = connections.filter(conn => conn !== c);
        } else {
            conn = null;
        }
        delete players[c.peer];
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
    startGame(themeKey, true); // true = Multi
}
function startMultiGame() {
    // Cette fonction est remplacée par broadcastStart mais on la garde pour assurer la compatibilité si appelée ailleurs
    broadcastStart('neon');
}
// -----------------------------

function update(dt) {
    const factor = dt / 16.67;

    // Sync réseau - Déplacé avant le check gameActive pour envoyer les etats de mort
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
            if (gameActive && Math.floor(score) % 50 === 0) {
                connections.forEach(c => {
                    if (c.open) c.send({ type: 'speed-sync', speed: gameSpeed });
                });
            }
        } else if (conn) {
            conn.send(myData);
        }
    }

    if (!gameActive) return;

    if (!isSpectating) {
        score += factor * (activePowerups.slowmo ? 0.5 : 1); // Score un peu moins vite en slowmo
        scoreElement.innerText = `Score: ${Math.floor(score)}`;
        if (Math.floor(score) % 1000 < 2 && Math.floor(score) > 0) gameSpeed += currentTheme.increase;
    }

    const effectiveSpeed = gameSpeed * (activePowerups.slowmo ? 0.5 : 1);

    if (shakeAmount > 0) shakeAmount *= 0.9;
    if (shakeAmount < 0.1) shakeAmount = 0;

    // Mise à jour des Power-ups actifs
    const indicators = document.getElementById('powerup-indicators');
    if (indicators) indicators.innerHTML = '';

    Object.keys(activePowerups).forEach(type => {
        activePowerups[type] -= dt;
        if (activePowerups[type] <= 0) {
            delete activePowerups[type];
        } else {
            // Rendu de l'indicateur HUD
            const pwr = Object.values(POWERUP_TYPES).find(p => p.id === type);
            if (pwr && indicators) {
                const percent = (activePowerups[type] / pwr.duration) * 100;
                const div = document.createElement('div');
                div.className = 'powerup-bar';
                if (activePowerups[type] < 2000) div.classList.add('pwr-warning'); // Flash à la fin

                div.innerHTML = `
                    <div class="pwr-progress" style="background: conic-gradient(${pwr.color} ${percent}%, rgba(255,255,255,0.1) 0)"></div>
                    <div class="pwr-icon">${pwr.icon}</div>
                `;
                indicators.appendChild(div);
            }
        }
    });

    // --- MISE À JOUR VISUELLE COMMUNE (Joueur ou Spectateur) ---
    backgroundLayers.forEach(layer => layer.forEach(s => {
        s.x -= effectiveSpeed * s.speed * factor;
        if (s.x < -20) s.x = 800 + 20;
    }));

    obstacles.forEach((o, i) => {
        o.x -= effectiveSpeed * factor;
        if (o.vy) {
            o.y += o.vy * factor;
            if (o.y <= 0 || o.y + o.h >= 400) o.vy *= -1;
        }

        if (!isSpectating && checkCollision(player, o)) {
            endGame();
        }
        if (o.x + o.w < 0) obstacles.splice(i, 1);
    });

    coins.forEach((c, i) => {
        c.x -= effectiveSpeed * factor; c.pulse += 0.1 * factor;

        // Effet Aimant
        if (activePowerups.magnet && !c.collected) {
            const dx = (player.x + player.size / 2) - c.x;
            const dy = (player.y + player.size / 2) - c.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 600) {
                c.x += (dx / dist) * 8 * factor;
                c.y += (dy / dist) * 8 * factor;
            }
        }

        if (!isSpectating && !c.collected && checkCollision(player, { x: c.x - 2, y: c.y - 2, w: c.size + 4, h: c.size + 4 })) {
            c.collected = true; currentSessionNéons += currentTheme.reward; updateNéonUI();
            for (let j = 0; j < 8; j++) createParticle(c.x, c.y, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, "#ffd700", Math.random() * 4 + 2);
        }
        if (c.x + c.size < 0 || c.collected) coins.splice(i, 1);
    });

    powerups.forEach((p, i) => {
        p.x -= effectiveSpeed * factor;
        p.pulse += 0.05 * factor;
        if (!isSpectating && checkCollision(player, { x: p.x, y: p.y, w: p.size, h: p.size })) {
            activePowerups[p.type.id] = p.type.duration;
            powerups.splice(i, 1);
            // Particules de collecte
            for (let j = 0; j < 15; j++) createParticle(p.x, p.y, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, p.type.color, Math.random() * 5 + 3);
        } else if (p.x + p.size < 0) {
            powerups.splice(i, 1);
        }
    });

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * factor; p.y += p.vy * factor; p.life -= 0.02 * factor;
        if (p.life <= 0) particles.splice(i, 1);
    }

    // Spawn des obstacles (Host uniquement en multi)
    lastObstacleTime += dt;
    if (lastObstacleTime > Math.max(450, currentTheme.interval - (gameSpeed * 40))) {
        if (isHost || !peer || (!conn && connections.length === 0)) {
            const isTop = Math.random() > 0.5;
            const h = 60 + Math.random() * 120;
            let newObs = { x: 800, y: isTop ? 0 : 400 - h, w: 35, h: h };

            // Variété d'obstacles
            const rand = Math.random();
            if (activeThemeKey === 'lava' && rand > 0.7) {
                newObs.vy = (Math.random() - 0.5) * 4; // Cube mobile
            }

            obstacles.push(newObs);
            lastObstacleTime = 0;

            if (isHost && connections.length > 0) {
                connections.forEach(c => {
                    if (c.open) c.send({ type: 'obstacle-spawn', obstacle: newObs });
                });
            }
        }
    }

    lastCoinTime += dt;
    if (lastCoinTime > CONFIG.coinInterval) { createCoin(); lastCoinTime = 0; }

    // --- LOGIQUE JOUEUR ALIVE UNIQUEMENT ---
    if (!isSpectating) {
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
    }
}

function checkCollision(p, o) {
    const pad = 4;
    return p.x + pad < o.x + o.w && p.x + p.size - pad > o.x && p.y + pad < o.y + o.h && p.y + p.size - pad > o.y;
}

function draw() {
    ctx.save();
    if (shakeAmount > 0.1) {
        ctx.translate((Math.random() - 0.5) * shakeAmount, (Math.random() - 0.5) * shakeAmount);
    }
    ctx.clearRect(-100, -100, 800 + 200, 400 + 200);

    // Dessiner les autres joueurs
    Object.keys(players).forEach(id => {
        const p = players[id];
        // On vérifie strictement que le joueur est en vie et que son y est défini
        if (id !== peer?.id && (p.isAlive === true || p.isAlive === "true") && typeof p.y === 'number') {
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

    const isCustomSkinActive = customSkinImg && customSkinImg.complete && customSkinImg.naturalWidth !== 0;

    trail.forEach((pos, index) => {
        // En multi, on cache aussi la traînée si on est mort
        if (peer && (conn || connections.length > 0) && isSpectating) return;

        ctx.globalAlpha = ((CONFIG.trailMax - index) / CONFIG.trailMax) * 0.3;
        ctx.save();
        ctx.translate(pos.x + player.size / 2, pos.y + player.size / 2);
        ctx.rotate(pos.rotation);

        if (isCustomSkinActive) {
            ctx.drawImage(customSkinImg, -player.size / 2, -player.size / 2, player.size, player.size);
        } else {
            ctx.fillStyle = pColor;
            style.draw(ctx, 0, 0, player.size);
        }
        ctx.restore();
    });

    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color || partColor;
        (particleStyles[p.style] || style).draw(ctx, p.x, p.y, p.size);
    });
    ctx.globalAlpha = 1;

    // Joueur local
    if (gameActive) {
        // En multi, on ne dessine plus le joueur local s'il est mort/spectateur pour qu'il "disparaisse"
        const isMulti = peer && (conn || connections.length > 0);
        if (!isMulti || !isSpectating) {
            ctx.save();
            ctx.translate(player.x + player.size / 2, player.y + player.size / 2);

            if (isSpectating) {
                ctx.globalAlpha = 0.4; // Semi-transparent si spectateur (solo uniquement maintenant)
            } else {
                currentRotation += (targetRotation - currentRotation) * 0.15;
            }

            ctx.rotate(currentRotation);
            ctx.shadowBlur = 15;
            ctx.shadowColor = pColor;
            ctx.fillStyle = pColor;

            if (customSkinImg && customSkinImg.complete && customSkinImg.naturalWidth !== 0) {
                ctx.drawImage(customSkinImg, -player.size / 2, -player.size / 2, player.size, player.size);
            } else {
                style.draw(ctx, 0, 0, player.size);
            }

            // Effets visuels des Power-ups sur le joueur
            let ringRadius = player.size / 2 + 6;
            Object.keys(activePowerups).forEach(type => {
                const pwr = Object.values(POWERUP_TYPES).find(p => p.id === type);
                if (pwr) {
                    const ratio = activePowerups[type] / pwr.duration;
                    ctx.beginPath();
                    ctx.arc(0, 0, ringRadius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * ratio));
                    ctx.strokeStyle = pwr.color;
                    ctx.lineWidth = 3;
                    ctx.lineCap = 'round';
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = pwr.color;
                    ctx.stroke();
                    ringRadius += 6;
                }
            });

            ctx.restore();
        }
    }

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
    obstacles.forEach(o => {
        ctx.fillRect(o.x, o.y, o.w, o.h);
    });

    ctx.shadowBlur = 15; ctx.shadowColor = "#ffd700"; ctx.fillStyle = "#ffd700"; ctx.strokeStyle = "white"; ctx.lineWidth = 2;
    coins.forEach(c => {
        const ps = Math.sin(c.pulse) * 4;
        ctx.beginPath(); ctx.moveTo(c.x + c.size / 2, c.y - ps); ctx.lineTo(c.x + c.size + ps, c.y + c.size / 2); ctx.lineTo(c.x + c.size / 2, c.y + c.size + ps); ctx.lineTo(c.x - ps, c.y + c.size / 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    });

    // Power-ups
    powerups.forEach(p => {
        ctx.shadowBlur = 20; ctx.shadowColor = p.type.color; ctx.fillStyle = p.type.color;
        const ps = Math.sin(p.pulse) * 5;
        ctx.font = `${p.size + ps}px Arial`;
        ctx.textAlign = "center";
        ctx.fillText(p.type.icon, p.x + p.size / 2, p.y + p.size);
    });

    ctx.restore();
}

function loop(timestamp) {
    // La boucle tourne TOUJOURS pour le fond
    if (!lastTime) lastTime = timestamp;
    const dt = Math.min(100, timestamp - lastTime);
    lastTime = timestamp;

    drawMenuBackground();

    if (gameActive) {
        update(dt);
        draw();
    }

    requestAnimationFrame(loop);
}

function drawMenuBackground() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    menuCtx.clearRect(0, 0, width, height);

    // Grid animée
    const gridSize = 60;
    const time = performance.now() * 0.001;
    const offsetX = (gameActive ? score * 5 : time * 15) % gridSize;

    menuCtx.lineWidth = 1;
    menuCtx.strokeStyle = 'rgba(255, 255, 255, 0.04)';

    for (let x = -offsetX; x < width; x += gridSize) {
        menuCtx.beginPath();
        menuCtx.moveTo(x, 0);
        menuCtx.lineTo(x, height);
        menuCtx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
        menuCtx.beginPath();
        menuCtx.moveTo(0, y);
        menuCtx.lineTo(width, y);
        menuCtx.stroke();
    }

    // Formes flottantes
    menuShapes.forEach(s => {
        s.x += s.vx;
        s.y += s.vy;
        s.rotation += s.vrot;

        if (s.x < -s.size) s.x = width + s.size;
        if (s.x > width + s.size) s.x = -s.size;
        if (s.y < -s.size) s.y = height + s.size;
        if (s.y > height + s.size) s.y = -s.size;

        menuCtx.save();
        menuCtx.translate(s.x, s.y);
        menuCtx.rotate(s.rotation);
        menuCtx.globalAlpha = s.alpha;
        menuCtx.strokeStyle = s.color;
        menuCtx.lineWidth = 2;
        menuCtx.shadowBlur = 15;
        menuCtx.shadowColor = s.color;

        menuCtx.beginPath();
        for (let i = 0; i < s.points; i++) {
            const angle = (i / s.points) * Math.PI * 2;
            const px = Math.cos(angle) * s.size;
            const py = Math.sin(angle) * s.size;
            if (i === 0) menuCtx.moveTo(px, py);
            else menuCtx.lineTo(px, py);
        }
        menuCtx.closePath();
        menuCtx.stroke();
        menuCtx.restore();
    });
}

function switchGravity() { if (gameActive && !isSpectating) { player.onCeiling = !player.onCeiling; targetRotation += Math.PI; } }

function endGame() {
    if (activePowerups.shield) {
        delete activePowerups.shield;
        shakeAmount = 10;
        // Effet de destruction du bouclier
        for (let j = 0; j < 20; j++) createParticle(player.x, player.y, (Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15, "#00ffcc", Math.random() * 6 + 2);
        // On ignore la mort et on continue
        obstacles = obstacles.filter(o => o.x > player.x + 200 || o.x < player.x - 50);
        return;
    }
    shakeAmount = 20;

    // Force sync immédiat pour informer les autres de la mort
    if (peer && (conn || connections.length > 0)) {
        isSpectating = true;
        gameActive = true;
        showScreen('gameUI');

        const myData = {
            type: 'sync',
            id: peer.id,
            y: player.y,
            pseudo: document.getElementById('playerName').value || "Anonyme",
            shape: activeParticle,
            color: customColors[activePlayerColor].value || currentTheme.player,
            partColor: customColors[activeParticleColor].value || currentTheme.player,
            isAlive: false
        };
        if (isHost) connections.forEach(c => c.send(myData));
        else if (conn) conn.send(myData);

        // En Multijoueur, on enregistre les scores silencieusement et on reste en jeu (Spectateur)
        const best = Math.floor(Math.max(score, localStorage.getItem(`best_${activeThemeKey}`) || 0));
        localStorage.setItem(`best_${activeThemeKey}`, best);
        totalNéons += currentSessionNéons;
        localStorage.setItem('totalNéons', totalNéons);

        // On n'appelle PAS confirmDeath immédiatement pour ne pas couper l'immersion
        // Seul le checkAutoReturnToLobby déclenchera la fin pour tout le monde
        checkAutoReturnToLobby();
    } else {
        gameActive = false;
        // En Solo, on garde le système de revive
        reviveCost = 10 + (revivesInSession * 15);
        reviveCostElement.innerText = reviveCost;

        if (totalNéons < reviveCost) {
            reviveBtn.disabled = true;
            reviveBtn.innerText = "PAS ASSEZ DE NÉONS";
        } else {
            reviveBtn.disabled = false;
            reviveBtn.innerText = "REVIVRE";

            // Auto-Revive automatique si activé
            if (settings.autoRevive) {
                setTimeout(revivePlayer, 500);
                return; // Sortir pour ne pas afficher l'écran de mort classique trop longtemps
            }
        }

        setTimeout(() => {
            showScreen('deathScreen');
            startDeathTimer();
        }, 500);
    }
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
        isSpectating = false; // Reset spectator state when reviving
        lastTime = performance.now();
        updateNéonUI();
    }
}

function confirmDeath() {
    gameActive = false; // Stop the loop and sync
    isSpectating = false;
    if (gameEndingTimeout) { clearTimeout(gameEndingTimeout); gameEndingTimeout = null; }
    if (deathTimer) clearInterval(deathTimer);

    const best = Math.floor(Math.max(score, localStorage.getItem(`best_${activeThemeKey}`) || 0));
    localStorage.setItem(`best_${activeThemeKey}`, best);

    // Si on est déjà passé par endGame (multi), currentSessionNéons a déjà été ajouté
    // on évite de l'ajouter deux fois si confirmDeath est appelé manuellement
    if (!isSpectating && currentSessionNéons > 0 && !document.getElementById('gameOver').classList.contains('screen-active')) {
        totalNéons += currentSessionNéons;
        localStorage.setItem('totalNéons', totalNéons);
    }

    showScreen('gameOver');
    stopMusic();

    const isMulti = peer && (conn || connections.length > 0);
    const replayBtn = document.getElementById('replayBtnGameOver');
    if (replayBtn) replayBtn.style.display = isMulti ? 'none' : 'block';

    earnedNéonsElement.innerText = `+${currentSessionNéons}`;
    finalScoreElement.innerHTML = `<span style="color: ${currentTheme.player}">${currentTheme.name}</span><br>SCORE: ${Math.floor(score)}<br><span style="font-size: 0.8em; color: #ffd700;">RECORD: ${best}</span>`;

    updateNéonUI();
}

document.getElementById('playerName').addEventListener('change', (e) => {
    localStorage.setItem('playerPseudo', e.target.value.trim());
});

function startSpectating() {
    // Si on est déjà revenu au menu ou si on n'est plus en multi, on ne fait rien
    const currentScreen = document.querySelector('.screen-active')?.id;
    if (currentScreen !== 'gameOver' && currentScreen !== 'deathScreen' && currentScreen !== 'gameUI') return;
    if (!peer || (!conn && connections.length === 0)) return;

    isSpectating = true;
    showScreen('gameUI');
    gameActive = true;
    lastTime = performance.now();
}

function quitSpectating() {
    quitLobby();
    isSpectating = false;
    gameActive = false;
    showScreen('menu');
    stopMusic();
    updateNéonUI();
}

function backToMenu() {
    gameActive = false;
    isSpectating = false;
    if (gameEndingTimeout) { clearTimeout(gameEndingTimeout); gameEndingTimeout = null; }

    if (peer && (conn || connections.length > 0)) {
        returnToLobby();
    } else {
        showScreen('menu');
        updateNéonUI();
    }
}

function replayGame() {
    if (activeThemeKey) {
        startGame(activeThemeKey);
    }
}

// Système de retour au salon automatique
function checkAutoReturnToLobby() {
    if (!peer || (!conn && connections.length === 0)) return;
    if (gameEndingTimeout) return; // Déjà en cours de fin

    // Seul l'hôte décide du moment où tout le monde a perdu
    if (isHost) {
        // Un joueur est en vie s'il n'est pas spectateur ET que la partie est active
        const localAlive = gameActive && !isSpectating;
        const othersAlive = Object.keys(players).some(id => players[id].isAlive === true || players[id].isAlive === "true");

        if (!localAlive && !othersAlive) {
            console.log("Tout le monde est mort, affichage des scores finaux...");
            gameEndingTimeout = setTimeout(() => {
                // On revérifie au cas où
                const stillNoneAlive = (!gameActive || isSpectating) &&
                    Object.keys(players).every(id => players[id].isAlive === false || players[id].isAlive === "false");

                if (stillNoneAlive) {
                    // On envoie le signal à tout le monde d'afficher son écran de score
                    connections.forEach(c => {
                        if (c.open) c.send({ type: 'show-game-over' });
                    });
                    confirmDeath();
                }
                gameEndingTimeout = null;
            }, 2000); // Délai pour laisser finir les dernières animations de mort
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

function quitLobby() {
    if (conn) {
        conn.close();
        conn = null;
    }
    if (isHost) {
        connections.forEach(c => c.close());
        connections = [];
    }
    players = {};
    isHost = false;
    isReady = false;

    // Reset UI
    document.getElementById('lobbyInfo').style.display = 'none';
    document.getElementById('groupCodeDisplay').innerText = "";
    document.getElementById('readyBtn').innerText = "PAS PRÊT";
    document.getElementById('readyBtn').classList.remove('active');

    if (peer) {
        peer.destroy();
        peer = null;
    }

    updateLobbyUI();
}
updateNéonUI();
// Initialiser le premier écran
showScreen('menu');
// Démarrer la boucle infinie pour le fond
requestAnimationFrame(loop);

window.addEventListener('keydown', e => { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); switchGravity(); } });
canvas.addEventListener('mousedown', e => { e.preventDefault(); switchGravity(); });
canvas.addEventListener('touchstart', e => { e.preventDefault(); switchGravity(); }, { passive: false });

// Écouteurs pour le menu Paramètres
document.getElementById('volumeSlider').addEventListener('input', (e) => {
    settings.volume = parseInt(e.target.value);
    document.getElementById('volumeValue').innerText = settings.volume;
    if (currentAudio) currentAudio.volume = settings.volume / 100;
    localStorage.setItem('setting_volume', settings.volume);
});

document.getElementById('particleDensity').addEventListener('change', (e) => {
    settings.particleDensity = e.target.value;
    localStorage.setItem('setting_particleDensity', settings.particleDensity);
});

document.getElementById('autoReviveToggle').addEventListener('change', (e) => {
    settings.autoRevive = e.target.checked;
    localStorage.setItem('setting_autoRevive', settings.autoRevive);
});

document.getElementById('playerPseudoSettings').addEventListener('input', (e) => {
    const pseudo = e.target.value.trim();
    localStorage.setItem('playerPseudo', pseudo);
    document.getElementById('playerName').value = pseudo;
});