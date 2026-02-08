const audio = new Audio();
audio.crossOrigin = "anonymous";
let playlist = [], currentIndex = 0;
let currentArt = "img/Technics_cover.png", currentMeta = "Technics - Master - Edition MKII";
let repeatMode = 0, isRandom = false, timeMode = 0, isVUOn = true;
let pointA = null, pointB = null, isPeakSearching = false;
let inputBuffer = "", inputTimeout = null, volDisplayTimeout = null;
let audioCtx, analyzer, dataArray, searchInterval = null;
let preMuteVolume = 0.02;
let isMuted = false;
let volRepeatInterval = null;
let vuMultiplier = 1.0;
let bassFilter, trebleFilter;
let bassLevel = 0;
let trebleLevel = 0;
let userPaused = false;
let isABLocked = false;
const vfdColors = ['#ffffff', '#a0a0a0', '#DBE9FF', '#B5B5B5'];

// CORRECTION 1 : Variable pour empêcher la double connexion audio
let isAudioConnected = false;

const gridWrapper = document.getElementById('grid-numbers-wrapper');
for (let i = 1; i <= 20; i++) {
    const s = document.createElement('span');
    s.className = 'grid-num';
    s.id = `gn-${i}`;
    s.innerText = i;
    gridWrapper.appendChild(s);
}

function showVolumeDisplay() {
    if (volDisplayTimeout) clearTimeout(volDisplayTimeout);
    const timeLabel = document.getElementById('time-label');
    const timeSep = document.getElementById('time-sep');

    if (isMuted) {
        timeLabel.innerText = "MUTE";
        document.getElementById('m-d1').innerText = " ";
        document.getElementById('m-d2').innerText = " ";
        document.getElementById('s-d1').innerText = "0";
        document.getElementById('s-d2').innerText = "0";
    } else {
        timeLabel.innerText = "VOLUME";
        let volPerc = Math.round(audio.volume * 100);
        if (volPerc > 99) volPerc = 99;
        const s = volPerc.toString().padStart(2, '0');
        document.getElementById('m-d1').innerText = " ";
        document.getElementById('m-d2').innerText = " ";
        document.getElementById('s-d1').innerText = s[0];
        document.getElementById('s-d2').innerText = s[1];
    }
    timeSep.style.opacity = "0";
}

function hideVolumeDisplay() {
    if (isMuted) return;
    if (volDisplayTimeout) clearTimeout(volDisplayTimeout);
    const timeLabel = document.getElementById('time-label');
    const timeSep = document.getElementById('time-sep');
    timeLabel.innerText = timeMode === 0 ? "Min : Sec" : "- Min : Sec";
    timeSep.style.opacity = "1";
    updateTimeDisplay();
}

const volUp = document.getElementById('vol-up-btn');
const volDown = document.getElementById('vol-down-btn');
const muteBtn = document.getElementById('mute-btn');

[volUp, volDown].forEach(btn => {
    btn.onmouseenter = showVolumeDisplay;
    btn.onmouseleave = () => {
        stopVolRepeat();
        hideVolumeDisplay();
    };
});

function startVolRepeat(dir) {
    stopVolRepeat();
    isMuted = false;
    const adjust = () => {
        let step = 0.01;
        let newVol = dir === 1 ? audio.volume + step : audio.volume - step;
        audio.volume = Math.max(0, Math.min(1, Math.round(newVol * 100) / 100));
        showVolumeDisplay();
    };
    adjust();
    volRepeatInterval = setInterval(adjust, 300);
}

function stopVolRepeat() {
    if (volRepeatInterval) {
        clearInterval(volRepeatInterval);
        volRepeatInterval = null;
    }
}

volUp.onmousedown = () => startVolRepeat(1);
volUp.onmouseup = stopVolRepeat;
volDown.onmousedown = () => startVolRepeat(-1);
volDown.onmouseup = stopVolRepeat;

muteBtn.onclick = () => {
    if (!isMuted) {
        preMuteVolume = audio.volume;
        audio.volume = 0;
        isMuted = true;
        showVolumeDisplay();
    } else {
        audio.volume = preMuteVolume;
        isMuted = false;
        hideVolumeDisplay();
    }
};

function startSearch(dir) {
    if (isABActive() || checkLock()) return;
    if (!playlist.length || isPeakSearching) return;

    if (dir > 0) {
        // FWD : Accélération avec son
        audio.playbackRate = 4.0;
        if (audio.paused) audio.play();
    } else {
        // REW : Sauts en arrière (pas de son possible)
        audio.muted = true;
        searchInterval = setInterval(() => {
            audio.currentTime = Math.max(0, audio.currentTime - 2);
            updateTimeDisplay();
        }, 100);
    }
}

function stopSearch() {
    audio.playbackRate = 1.0;
    if (searchInterval) {
        clearInterval(searchInterval);
        searchInterval = null;
        audio.muted = false;
    }
}

document.getElementById('fwd-btn').onmousedown = () => startSearch(1);
document.getElementById('fwd-btn').onmouseup = stopSearch;
document.getElementById('rew-btn').onmousedown = () => startSearch(-1);
document.getElementById('rew-btn').onmouseup = stopSearch;

document.getElementById('plus-10-btn').onclick = () => {
    if (isABActive() || checkLock()) return;
    if (!playlist.length) return;
    audio.currentTime = Math.min(audio.duration, audio.currentTime + 10);
    updateTimeDisplay();
};

document.getElementById('minus-10-btn').onclick = () => {
    if (isABActive() || checkLock()) return;
    if (!playlist.length) return;
    audio.currentTime = Math.max(0, audio.currentTime - 10);
    updateTimeDisplay();
};

document.getElementById('peak-btn').onclick = async () => {
    if (!playlist.length || isPeakSearching) return;
    isPeakSearching = true; audio.pause();
    const timeLabel = document.getElementById('time-label');
    const originalLabel = timeLabel.innerText;
    timeLabel.innerText = "PEAK SEARCH";
    document.getElementById('main-time-display').classList.add('vfd-input-blink');
    let maxVal = 0, peakTime = 0;
    const step = audio.duration / 50;
    for (let i = 0; i < 50; i++) {
        audio.currentTime = i * step;
        await new Promise(r => setTimeout(r, 40));
        analyzer.getByteFrequencyData(dataArray);
        let currentMax = Math.max(...dataArray);
        if (currentMax > maxVal) { maxVal = currentMax; peakTime = audio.currentTime; }
    }
    audio.currentTime = peakTime;
    document.getElementById('main-time-display').classList.remove('vfd-input-blink');
    timeLabel.innerText = "PEAK FOUND";
    const simulatedVal = Math.floor((maxVal / 255) * 40);
    ['meter-L', 'meter-R'].forEach(id => {
        const el = document.getElementById(id);
        for (let i = 0; i < simulatedVal; i++) {
            if (i >= 30) {
                el.children[i].className = 'meter-segment on-red';
            } else if (i >= 20) {
                el.children[i].className = 'meter-segment on-orange';
            } else {
                el.children[i].className = 'meter-segment on-blue';
            }
        }
    });
    setTimeout(() => { timeLabel.innerText = originalLabel; isPeakSearching = false; updateTimeDisplay(); }, 2000);
};

document.getElementById('vu-btn').onclick = () => {
    isVUOn = !isVUOn;
    const labels = [document.getElementById('lbl-L'), document.getElementById('lbl-R')];
    const scale = document.querySelector('.vu-scale'); // Cible l'élément d'échelle

    if (!isVUOn) {
        // Désactiver les labels L/R
        labels.forEach(l => l.className = 'vu-label');

        // Cacher l'échelle (graduation)
        if (scale) scale.style.opacity = "0";

        // Éteindre tous les segments
        ['meter-L', 'meter-R'].forEach(id => {
            const el = document.getElementById(id);
            for (let i = 0; i < 40; i++) el.children[i].className = 'meter-segment';
        });
    } else {
        // Activer les labels L/R
        labels.forEach(l => l.className = 'vu-label on');

        // Afficher l'échelle
        if (scale) scale.style.opacity = "1";
    }
};

document.getElementById('ab-btn').onclick = () => {
    if (playlist.length === 0) return;
    const abVfd = document.getElementById('vfd-ab');
    const abLockVfd = document.getElementById('vfd-ab-lock');
    if (pointA === null) {
        pointA = audio.currentTime;
        abVfd.classList.add('active', 'vfd-input-blink');
    } else if (pointB === null) {
        if (audio.currentTime > pointA) {
            pointB = audio.currentTime;
            abVfd.classList.remove('vfd-input-blink');
            abVfd.classList.add('active');
            isABLocked = true;
            if (abLockVfd) abLockVfd.classList.add('active');
            audio.currentTime = pointA;
        }
    } else {
        pointA = null; pointB = null; isABLocked = false;
        abVfd.classList.remove('active', 'vfd-input-blink');
        if (abLockVfd) abLockVfd.classList.remove('active');
    }
};

function isABActive() { return pointA !== null; }

document.getElementById('power-reset-btn').onclick = () => {
    // On affiche simplement la modale personnalisée
    document.getElementById('power-modal').style.display = 'flex';
};

document.getElementById('play-btn').onclick = () => {
    if (checkLock()) return;
    if (!playlist.length || isPeakSearching) return;
    const timeDisplay = document.getElementById('main-time-display');
    if (audio.paused) { audio.play(); timeDisplay.classList.remove('vfd-blink-pause'); }
    else { audio.pause(); timeDisplay.classList.add('vfd-blink-pause'); }
};

document.getElementById('stop-btn').onclick = () => {
    if (checkLock()) return;
    audio.pause(); audio.currentTime = 0;
    document.getElementById('main-time-display').classList.remove('vfd-blink-pause');
    updateTimeDisplay();
};

function updateDig(prefix, val) {
    const s = Math.floor(Math.abs(val)).toString().padStart(2, '0');
    document.getElementById(`${prefix}-d1`).innerText = s[s.length - 2] || "0";
    document.getElementById(`${prefix}-d2`).innerText = s[s.length - 1] || "0";
}

function updateTimeDisplay() {
    const timeLabel = document.getElementById('time-label');
    const mainTimeDisplay = document.getElementById('main-time-display');

    if (timeLabel.innerText === "VOLUME" || timeLabel.innerText === "MUTE" || timeLabel.innerText === "VU SENSE" || timeLabel.innerText === "BASS" ||
        timeLabel.innerText === "TREBLE" || isPeakSearching) return;

    let d = timeMode === 0 ? audio.currentTime : (audio.duration || 0) - audio.currentTime;
    const mins = Math.floor(d / 60).toString().padStart(2, '0');
    const secs = Math.floor(d % 60).toString().padStart(2, '0');

    document.getElementById('m-d1').innerText = mins[mins.length - 2] || "0";
    document.getElementById('m-d2').innerText = mins[mins.length - 1] || "0";
    document.getElementById('s-d1').innerText = secs[secs.length - 2] || "0";
    document.getElementById('s-d2').innerText = secs[secs.length - 1] || "0";

    // Ajouter une classe pour afficher le "-"
    if (timeMode === 1) {
        mainTimeDisplay.classList.add('time-inverse');
    } else {
        mainTimeDisplay.classList.remove('time-inverse');
    }
}

function updateGrid() {
    const overArrow = document.getElementById('over-arrow');
    const hasMoreThan20 = playlist.length > 20;
    const isCurrentTrackOver20 = (currentIndex + 1) > 20;
    if (overArrow) {
        overArrow.classList.toggle('active', hasMoreThan20);
        overArrow.classList.toggle('vfd-input-blink', isCurrentTrackOver20);
    }
    for (let i = 1; i <= 20; i++) {
        const el = document.getElementById(`gn-${i}`);
        if (el) {
            el.classList.toggle('loaded', i <= playlist.length);
            el.classList.toggle('active-track', i === currentIndex + 1 && playlist.length > 0);
        }
    }
}

function updateMediaSession() {
    if ('mediaSession' in navigator && playlist.length > 0) {
        const currentFile = playlist[currentIndex];
        navigator.mediaSession.metadata = new MediaMetadata({
            title: currentFile.name.replace(/\.[^/.]+$/, ""),
            artist: "Technics Master Edition MKII",
            album: "no album",
            artwork: [{ src: currentArt, sizes: '512x512', type: 'image/png' }]
        });
    }
}

function loadTrack(idx, forcePlay = false) {
    if (!playlist.length) return;
    const timeDisplay = document.getElementById('main-time-display');
    const isAfterReset = (audio.src === "" || !audio.getAttribute('src'));
    const wasPlaying = !audio.paused && !timeDisplay.classList.contains('vfd-blink-pause');
    if (isRandom && idx !== currentIndex) { idx = Math.floor(Math.random() * playlist.length); }
    currentIndex = (idx + playlist.length) % playlist.length;
    const currentFile = playlist[currentIndex];
    if (audio.src) URL.revokeObjectURL(audio.src);
    audio.src = URL.createObjectURL(currentFile);
    const formatDisplay = document.getElementById('file-format-display');
    if (formatDisplay && currentFile.name) { formatDisplay.innerText = currentFile.name.split('.').pop().toUpperCase(); }
    updateDig('t', currentIndex + 1);
    updateGrid();
    if (forcePlay || isAfterReset || wasPlaying) {
        audio.play().then(() => { timeDisplay.classList.remove('vfd-blink-pause'); }).catch(e => console.log("Playback error:", e));
    } else {
        audio.pause(); audio.currentTime = 0;
        timeDisplay.classList.add('vfd-blink-pause');
        updateTimeDisplay();
    }
    updateMediaSession();
    setupAudio();
    extractMetadata(playlist[currentIndex]);
}

if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => document.getElementById('play-btn').click());
    navigator.mediaSession.setActionHandler('pause', () => document.getElementById('play-btn').click());
    navigator.mediaSession.setActionHandler('previoustrack', () => loadTrack(currentIndex - 1));
    navigator.mediaSession.setActionHandler('nexttrack', () => loadTrack(currentIndex + 1));
    navigator.mediaSession.setActionHandler('stop', () => document.getElementById('stop-btn').click());
}

audio.onended = () => {
    if (isABActive()) return;
    if (repeatMode === 1) { audio.play(); }
    else if (repeatMode === 2 || isRandom || currentIndex < playlist.length - 1) { loadTrack(currentIndex + 1, true); }
    else { audio.pause(); audio.currentTime = 0; updateTimeDisplay(); }
};

audio.ontimeupdate = () => {
    if (pointA !== null && pointB !== null && audio.currentTime >= pointB) audio.currentTime = pointA;
    updateTimeDisplay();
};

function handleNumKey(num) {
    if (checkLock()) return;
    if (!playlist.length) return;
    const tDisplay = document.getElementById('t-d1').parentElement;
    if (inputTimeout) { clearTimeout(inputTimeout); inputTimeout = null; }
    if (isABActive()) {
        updateDig('t', currentIndex + 1);
        tDisplay.classList.add('vfd-input-blink');
        setTimeout(() => tDisplay.classList.remove('vfd-input-blink'), 800);
        inputBuffer = ""; return;
    }
    inputBuffer += num;
    tDisplay.classList.add('vfd-input-blink');
    updateDig('t', parseInt(inputBuffer));
    if (inputBuffer.length >= 2) executeJump();
    else inputTimeout = setTimeout(() => executeJump(), 2000);
}

function executeJump() {
    const tDisplay = document.getElementById('t-d1').parentElement;
    tDisplay.classList.remove('vfd-input-blink');
    let trackNum = parseInt(inputBuffer);
    if (inputTimeout) { clearTimeout(inputTimeout); inputTimeout = null; }
    inputBuffer = "";
    if (isABActive()) { updateDig('t', currentIndex + 1); return; }
    if (!isNaN(trackNum) && trackNum > 0 && trackNum <= playlist.length) loadTrack(trackNum - 1);
    else updateDig('t', currentIndex + 1);
}

function extractMetadata(file) {
    if (typeof jsmediatags === "undefined") return;
    jsmediatags.read(file, {
        onSuccess: (tag) => {
            const t = tag.tags;
            currentMeta = `${t.artist || "Unknown Artist"} - ${t.album || "Unknown Album"} - ${t.title || file.name}`;
            const p = t.picture;
            if (p) {
                let b64 = ""; for (let i = 0; i < p.data.length; i++) b64 += String.fromCharCode(p.data[i]);
                currentArt = `data:${p.format};base64,${window.btoa(b64)}`;
            } else currentArt = "img/Technics_cover.png";
            updateMediaSession();
        }
    });
}

function openPlaylist() {
    if (playlist.length === 0) return;
    const container = document.getElementById('track-list-container');
    container.innerHTML = "";
    playlist.forEach((file, idx) => {
        const item = document.createElement('div');
        item.className = 'track-item' + (idx === currentIndex ? ' active' : '');
        item.innerText = `${(idx + 1).toString().padStart(2, '0')}. ${file.name}`;
        item.onclick = () => { loadTrack(idx); document.getElementById('playlist-modal').style.display = 'none'; };
        container.appendChild(item);
    });
    document.getElementById('playlist-modal').style.display = 'flex';
}

document.getElementById('file-input').onchange = (e) => {
    playlist = Array.from(e.target.files);
    if (playlist.length) {
        document.getElementById('tray-front').classList.remove('open');
        loadTrack(0);
        updateGrid();
    }
};

document.getElementById('next-btn').onclick = () => {
    if (checkLock() || isABActive()) return;
    loadTrack(currentIndex + 1);
};

document.getElementById('prev-btn').onclick = () => {
    if (checkLock() || isABActive()) return;
    loadTrack(currentIndex - 1);
};

// CORRECTION 2 : Correction de l'ID du tiroir pour correspondre au HTML
document.getElementById('eject-btn').onclick = () => document.getElementById('tray-front').classList.toggle('open');

document.getElementById('random-btn').onclick = () => {
    isRandom = !isRandom;
    document.getElementById('vfd-random').classList.toggle('active', isRandom);
};
document.getElementById('repeat-btn').onclick = () => {
    repeatMode = (repeatMode + 1) % 3;
    document.getElementById('vfd-repeat-1').classList.toggle('active', repeatMode === 1);
    document.getElementById('vfd-repeat-all').classList.toggle('active', repeatMode === 2);
};

document.getElementById('time-btn').onclick = () => {
    timeMode = (timeMode + 1) % 2;
    const label = document.getElementById('time-label');
    label.innerText = (timeMode === 0) ? "Min : Sec" : "- Min : Sec";
    updateTimeDisplay();
};

function openArt() {
    document.getElementById('art-image').src = currentArt;
    document.getElementById('art-info').innerText = currentMeta;
    document.getElementById('art-modal').style.display = 'flex';
}

// CORRECTION 3 : Vérification isAudioConnected pour éviter l'erreur de re-connexion
function setupAudio() {
    if (audioCtx && audioCtx.state === "suspended") { audioCtx.resume(); return; }
    if (isAudioConnected) return;

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = audioCtx.createMediaElementSource(audio);

    bassFilter = audioCtx.createBiquadFilter();
    bassFilter.type = "lowshelf";
    bassFilter.frequency.value = 200;
    bassFilter.gain.value = bassLevel;

    trebleFilter = audioCtx.createBiquadFilter();
    trebleFilter.type = "highshelf";
    trebleFilter.frequency.value = 3000;
    trebleFilter.gain.value = trebleLevel;

    analyzer = audioCtx.createAnalyser();
    analyzer.fftSize = 64;
    dataArray = new Uint8Array(analyzer.frequencyBinCount);

    src.connect(bassFilter);
    bassFilter.connect(trebleFilter);
    trebleFilter.connect(analyzer);
    analyzer.connect(audioCtx.destination);

    isAudioConnected = true;
    renderVU();
}

function renderVU() {
    requestAnimationFrame(renderVU);
    if (!analyzer || !isVUOn || isPeakSearching) return;
    analyzer.getByteFrequencyData(dataArray);
    ['meter-L', 'meter-R'].forEach((id, idx) => {
        const el = document.getElementById(id);
        let rawVal = dataArray[idx + 2] * vuMultiplier;
        const val = Math.floor((rawVal / 255) * 40);
        for (let i = 0; i < 40; i++) {
            if (i < val) {
                if (i >= 30) {
                    el.children[i].className = 'meter-segment on-red';
                } else if (i >= 20) {
                    el.children[i].className = 'meter-segment on-orange';
                } else {
                    el.children[i].className = 'meter-segment on-blue';
                }
            } else {
                el.children[i].className = 'meter-segment';
            }
        }
    });
}

['meter-L', 'meter-R'].forEach(id => {
    const el = document.getElementById(id);
    for (let i = 0; i < 40; i++) el.appendChild(document.createElement('div')).className = 'meter-segment';
});

audio.volume = 0.02;

function showVUSense() {
    if (volDisplayTimeout) clearTimeout(volDisplayTimeout);
    const timeLabel = document.getElementById('time-label');
    const timeSep = document.getElementById('time-sep');
    timeLabel.innerText = "VU SENSE";
    timeSep.style.opacity = "0";
    let displayVal = Math.round(vuMultiplier * 10).toString().padStart(2, '0');
    document.getElementById('m-d1').innerText = " ";
    document.getElementById('m-d2').innerText = " ";
    document.getElementById('s-d1').innerText = displayVal[0];
    document.getElementById('s-d2').innerText = displayVal[1];
}

function adjustVUSense(change) {
    vuMultiplier += change;
    vuMultiplier = Math.max(0.2, Math.min(8.0, vuMultiplier));
    showVUSense();
}

function startVUTimeout() {
    if (volDisplayTimeout) clearTimeout(volDisplayTimeout);
    volDisplayTimeout = setTimeout(hideVolumeDisplay, 1500);
}

function toggleVUHatch() {
    const hatch = document.getElementById('vu-hatch-block');
    hatch.classList.toggle('hatch-open');
    hatch.classList.toggle('hatch-closed');
}

function adjustBass(change) {
    bassLevel = Math.max(-10, Math.min(10, bassLevel + change));
    if (bassFilter) bassFilter.gain.setTargetAtTime(bassLevel, audioCtx.currentTime, 0.01);
    showToneDisplay("BASS", bassLevel);
}

function adjustTreble(change) {
    trebleLevel = Math.max(-10, Math.min(10, trebleLevel + change));
    if (trebleFilter) trebleFilter.gain.setTargetAtTime(trebleLevel, audioCtx.currentTime, 0.01);
    showToneDisplay("TREBLE", trebleLevel);
}

function showToneDisplay(label, value) {
    if (volDisplayTimeout) clearTimeout(volDisplayTimeout);
    const timeLabel = document.getElementById('time-label');
    const timeSep = document.getElementById('time-sep');
    timeLabel.innerText = label;
    timeSep.style.opacity = "0";
    const sign = value >= 0 ? "+" : "-";
    const valStr = Math.abs(value).toString().padStart(2, '0');
    document.getElementById('m-d1').innerText = sign;
    document.getElementById('m-d2').innerText = " ";
    document.getElementById('s-d1').innerText = valStr[0];
    document.getElementById('s-d2').innerText = valStr[1];
    volDisplayTimeout = setTimeout(hideVolumeDisplay, 1500);
}

function toggleToneHatch() {
    const hatch = document.getElementById('tone-hatch-block');
    hatch.classList.toggle('hatch-open');
}

function checkLock(e) {
    if (isABLocked) {
        const lockIndicator = document.getElementById('vfd-ab-lock');
        lockIndicator.classList.add('vfd-input-blink');
        setTimeout(() => lockIndicator.classList.remove('vfd-input-blink'), 500);
        if (e) e.stopPropagation();
        return true;
    }
    return false;
}



let currentColorIndex = 0;

function setGlobalVFDColor(color) {
    const root = document.documentElement;
    root.style.setProperty('--vfd-blue', color);
    root.style.setProperty('--vfd-glow', color + '66');
    localStorage.setItem('technics-vfd-color', color);
}

window.addEventListener('DOMContentLoaded', () => {
    const savedColor = localStorage.getItem('technics-vfd-color');
    if (savedColor) {
        setGlobalVFDColor(savedColor);
        currentColorIndex = vfdColors.indexOf(savedColor);
        if (currentColorIndex === -1) currentColorIndex = 0;
    }
});

document.getElementById('vfd-color-trigger').onclick = (e) => {
    e.preventDefault();
    currentColorIndex = (currentColorIndex + 1) % vfdColors.length;
    setGlobalVFDColor(vfdColors[currentColorIndex]);
};

function resetToneDefault() {
    bassLevel = 0;
    trebleLevel = 0;

    // Application aux filtres audio
    if (bassFilter) bassFilter.gain.setTargetAtTime(0, audioCtx.currentTime, 0.01);
    if (trebleFilter) trebleFilter.gain.setTargetAtTime(0, audioCtx.currentTime, 0.01);

    // Affichage VFD temporaire
    showToneDisplay("DEFAULT", 0);
}

function changeBackgroundColor(color) {
    // Applique la couleur au fond de la page
    document.body.style.background = color;

    // Si vous avez une image de fond (métal brossé), on la retire pour voir la couleur
    document.body.style.backgroundImage = 'none';

    // Optionnel : Sauvegarder la préférence (comme demandé dans vos instructions)
    localStorage.setItem('user-bg-color', color);
}

// Au chargement de la page, restaurer la couleur si elle existe
window.addEventListener('load', () => {
    const savedColor = localStorage.getItem('user-bg-color');
    if (savedColor) {
        changeBackgroundColor(savedColor);
        document.getElementById('bg-color-picker').value = savedColor;
    }
});

const { ipcRenderer } = require('electron');

ipcRenderer.on('media-control', (event, action) => {
    // On vérifie si l'appareil est allumé
    if (!isPoweredOn) return;

    if (action === 'play-pause') {
        if (playlist.length > 0) {
            initEngine();
            if (audio.paused) {
                audio.play();
                updateStatusIcon('play');
            } else {
                audio.pause();
                updateStatusIcon('pause');
            }
        }
    }
    else if (action === 'next') {
        // On force le passage à la piste suivante directement
        if (isRandom && playlist.length > 1) {
            let n; do { n = Math.floor(Math.random() * playlist.length); } while (n === currentIndex);
            loadTrack(n);
        } else if (currentIndex < playlist.length - 1) {
            loadTrack(currentIndex + 1);
        } else if (repeatMode === 2) {
            loadTrack(0);
        }
    }
    else if (action === 'prev') {
        if (audio.currentTime > 3) {
            audio.currentTime = 0;
        } else if (currentIndex > 0) {
            loadTrack(currentIndex - 1);
        } else if (repeatMode === 2) {
            loadTrack(playlist.length - 1);
        }
    }
});
