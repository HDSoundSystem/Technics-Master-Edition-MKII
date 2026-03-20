const audio = new Audio();
audio.crossOrigin = "anonymous";
let playlist = [], currentIndex = 0, playlistMeta = [];
let currentArt = "assets/img/Technics_cover.png", currentMeta = "Technics - Master - Edition MKII";
let repeatMode = 0, isRandom = false, timeMode = 0, isVUOn = true;
let pointA = null, pointB = null, isPeakSearching = false;
let inputBuffer = "", inputTimeout = null, volDisplayTimeout = null;
let audioCtx, analyzerL, analyzerR, dataArrayL, dataArrayR, searchInterval = null;
let preMuteVolume = 0.02;
let isMuted = false;
let volRepeatInterval = null;
let vuMultiplier = 1.0;
let bassFilter, trebleFilter;
let bassLevel = 0;
let trebleLevel = 0;
let userPaused = false;
let isABLocked = false;
let isDisplayLocked = false;
let currentRotation = 0;


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

function peekKnobDisplay(type) {
    if (toneKnobInterval || toneKnobDelayTimeout) return;
    if (volDisplayTimeout) clearTimeout(volDisplayTimeout);
    volDisplayTimeout = null;
    if (type === 'volume') {
        showVolumeDisplay();
    } else if (type === 'bass') {
        showToneDisplay('BASS', bassLevel, true);
    } else if (type === 'treble') {
        showToneDisplay('TREBLE', trebleLevel, true);
    } else if (type === 'balance') {
        showBalanceDisplay();
    }
}

function startKnobPeekTimeout() {
    if (activeToneKnobType) return;
    if (volDisplayTimeout) clearTimeout(volDisplayTimeout);
    volDisplayTimeout = setTimeout(hideVolumeDisplay, 800);
}

const muteBtn = document.getElementById('mute-btn');
if (muteBtn) {
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
}

function startSearch(dir) {
    if (isABActive() || checkLock()) return;
    if (!playlist.length || isPeakSearching) return;

    if (audio.paused) audio.play();

    searchInterval = setInterval(() => {
        const step = dir > 0 ? 0.4 : -0.4;
        audio.currentTime = Math.min(audio.duration, Math.max(0, audio.currentTime + step));
        updateTimeDisplay();
        if (audio.currentTime <= 0 || audio.currentTime >= audio.duration) stopSearch();
    }, 30);
}

function stopSearch() {
    audio.playbackRate = 1.0;
    if (searchInterval) {
        clearInterval(searchInterval);
        searchInterval = null;
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
    isPeakSearching = true;
    audio.pause();

    const timeLabel = document.getElementById('time-label');
    const timeSep = document.getElementById('time-sep');
    const originalLabel = timeLabel.innerText;
    timeLabel.innerText = 'PEAK SEARCH';
    timeSep.style.opacity = '0';
    document.getElementById('main-time-display').classList.add('vfd-input-blink');

    try {
        // Lire le fichier source en ArrayBuffer
        const file = playlist[currentIndex];
        const arrayBuffer = await file.arrayBuffer();

        // Décoder via un contexte offline pour accéder aux samples bruts
        const offlineCtx = new OfflineAudioContext(2, 1, 44100);
        const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);

        const duration = audioBuffer.duration;
        const sampleRate = audioBuffer.sampleRate;
        const nChannels = audioBuffer.numberOfChannels;

        // Diviser en 200 fenêtres, calculer le RMS de chaque fenêtre
        const windowCount = 200;
        const samplesPerWindow = Math.floor(audioBuffer.length / windowCount);
        let maxRms = 0;
        let peakWindow = 0;

        for (let w = 0; w < windowCount; w++) {
            let sum = 0, count = 0;
            const start = w * samplesPerWindow;
            const end = Math.min(start + samplesPerWindow, audioBuffer.length);
            for (let ch = 0; ch < nChannels; ch++) {
                const data = audioBuffer.getChannelData(ch);
                for (let s = start; s < end; s++) {
                    sum += data[s] * data[s];
                    count++;
                }
            }
            const rms = Math.sqrt(sum / count);
            if (rms > maxRms) { maxRms = rms; peakWindow = w; }
        }

        const peakTime = (peakWindow / windowCount) * duration;
        audio.currentTime = peakTime;

        document.getElementById('main-time-display').classList.remove('vfd-input-blink');
        timeLabel.innerText = 'PEAK FOUND';

        // Afficher le niveau sur les VU mètres
        const simulatedVal = Math.floor(Math.min(1, maxRms * 4) * 40);
        ['meter-L', 'meter-R'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            for (let i = 0; i < 40; i++) {
                if (i < simulatedVal) {
                    el.children[i].className = i >= 30 ? 'meter-segment on-red'
                        : i >= 20 ? 'meter-segment on-orange'
                        : 'meter-segment on-blue';
                } else {
                    el.children[i].className = 'meter-segment';
                }
            }
        });

    } catch (err) {
        console.error('Peak search error:', err);
        document.getElementById('main-time-display').classList.remove('vfd-input-blink');
        timeLabel.innerText = 'PEAK ERROR';
    }

    setTimeout(() => {
        timeLabel.innerText = originalLabel;
        timeSep.style.opacity = '1';
        isPeakSearching = false;
        updateTimeDisplay();
    }, 2000);
};

document.getElementById('vu-btn').onclick = () => {
    isVUOn = !isVUOn;
    const labels = [document.getElementById('lbl-L'), document.getElementById('lbl-R')];
    const scale = document.querySelector('.vu-scale');

    if (!isVUOn) {
        labels.forEach(l => l && (l.className = 'vu-label'));
        if (scale) scale.style.opacity = "0";
        ['meter-L', 'meter-R'].forEach(id => {
            const el = document.getElementById(id);
            for (let i = 0; i < 40; i++) el.children[i].className = 'meter-segment';
        });
    } else {
        labels.forEach(l => l && (l.className = 'vu-label on'));
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
    const d1 = document.getElementById(`${prefix}-d1`);
    const d2 = document.getElementById(`${prefix}-d2`);
    if (d1) d1.innerText = s[s.length - 2] || "0";
    if (d2) d2.innerText = s[s.length - 1] || "0";
}

function updateTimeDisplay() {
    if (isDisplayLocked) return;
    const timeLabel = document.getElementById('time-label');
    const mainTimeDisplay = document.getElementById('main-time-display');
    if (["VOLUME", "MUTE", "VU SENSE", "BASS", "TREBLE", "BALANCE"].includes(timeLabel.innerText) || isPeakSearching) return;

    let d = timeMode === 0 ? audio.currentTime : (audio.duration || 0) - audio.currentTime;
    const mins = Math.floor(d / 60).toString().padStart(2, '0');
    const secs = Math.floor(d % 60).toString().padStart(2, '0');

    document.getElementById('m-d1').innerText = mins[0];
    document.getElementById('m-d2').innerText = mins[1];
    document.getElementById('s-d1').innerText = secs[0];
    document.getElementById('s-d2').innerText = secs[1];

    if (timeMode === 1) mainTimeDisplay.classList.add('time-inverse');
    else mainTimeDisplay.classList.remove('time-inverse');
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
    extractMetadata(playlist[currentIndex], currentIndex);
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

function extractMetadata(file, idx) {
    // Initialise avec des valeurs par défaut
    if (!playlistMeta[idx]) {
        playlistMeta[idx] = { artist: 'Unknown Artist', album: 'Unknown Album', title: file.name, cover: 'img/Technics_cover.png' };
    }
    if (typeof jsmediatags === "undefined") return;
    jsmediatags.read(file, {
        onSuccess: (tag) => {
            const t = tag.tags;
            const artist = t.artist || 'Unknown Artist';
            const album = t.album || 'Unknown Album';
            const title = t.title || file.name;
            let cover = 'img/Technics_cover.png';
            const p = t.picture;
            if (p) {
                let b64 = "";
                for (let i = 0; i < p.data.length; i++) b64 += String.fromCharCode(p.data[i]);
                cover = `data:${p.format};base64,${window.btoa(b64)}`;
            }
            playlistMeta[idx] = { artist, album, title, cover };
            // Si c'est la piste courante, mettre à jour currentArt/currentMeta
            if (idx === currentIndex) {
                currentArt = cover;
                currentMeta = `${artist} - ${album} - ${title}`;
                updateMediaSession();
            }
            // Rafraîchir la playlist si elle est ouverte
            const modal = document.getElementById('playlist-modal');
            if (modal.style.display !== 'none') refreshPlaylistItem(idx);
        }
    });
}

function buildTrackItem(idx) {
    const file = playlist[idx];
    const meta = playlistMeta[idx] || { artist: '', album: '', title: file.name, cover: 'img/Technics_cover.png' };
    const item = document.createElement('div');
    item.className = 'track-item' + (idx === currentIndex ? ' active' : '');
    item.id = `track-item-${idx}`;

    const cover = document.createElement('img');
    cover.className = 'track-item-cover';
    cover.src = meta.cover;
    cover.alt = '';

    const info = document.createElement('div');
    info.className = 'track-item-info';
    info.innerHTML = `
        <div class="track-item-artist">${meta.artist}</div>
        <div class="track-item-album">${meta.album}</div>
        <div class="track-item-title">${idx + 1 < 10 ? '0' + (idx + 1) : idx + 1}. ${meta.title}</div>
    `;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'track-remove-btn';
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeBtn.title = 'Retirer de la playlist';
    removeBtn.onclick = (e) => {
        e.stopPropagation();
        removeTrack(idx);
    };

    // Clic sur la piste : lance sans fermer la modale
    item.onclick = () => {
        loadTrack(idx);
        // Met à jour l'état actif sans fermer
        document.querySelectorAll('.track-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
    };

    item.appendChild(cover);
    item.appendChild(info);
    item.appendChild(removeBtn);
    return item;
}

function refreshPlaylistItem(idx) {
    const existing = document.getElementById(`track-item-${idx}`);
    if (!existing) return;
    const newItem = buildTrackItem(idx);
    existing.replaceWith(newItem);
}

function removeTrack(idx) {
    playlist.splice(idx, 1);
    playlistMeta.splice(idx, 1);
    if (playlist.length === 0) {
        document.getElementById('playlist-modal').style.display = 'none';
        audio.pause();
        audio.src = '';
        return;
    }
    if (idx < currentIndex) currentIndex--;
    else if (idx === currentIndex) {
        currentIndex = Math.min(currentIndex, playlist.length - 1);
        loadTrack(currentIndex);
    }
    updateGrid();
    openPlaylist(); // Rafraîchit la liste
}

function openPlaylist() {
    if (playlist.length === 0) return;
    const container = document.getElementById('track-list-container');
    container.innerHTML = '';
    playlist.forEach((file, idx) => {
        container.appendChild(buildTrackItem(idx));
    });
    document.getElementById('playlist-modal').style.display = 'flex';
}

document.getElementById('file-input').onchange = (e) => {
    const newFiles = Array.from(e.target.files);
    e.target.value = '';
    if (!newFiles.length) return;
    const startIndex = playlist.length;
    playlist = playlist.concat(newFiles);
    // Pré-extraire les métadonnées de tous les nouveaux fichiers
    newFiles.forEach((file, i) => extractMetadata(file, startIndex + i));
    document.getElementById('tray-front').classList.remove('open');
    loadTrack(startIndex === 0 ? 0 : startIndex);
    updateGrid();
};

document.getElementById('next-btn').onclick = () => {
    if (checkLock() || isABActive()) return;
    loadTrack(currentIndex + 1);
};

document.getElementById('prev-btn').onclick = () => {
    if (checkLock() || isABActive()) return;
    loadTrack(currentIndex - 1);
};

document.getElementById('eject-btn').onclick = () => {
    const tray = document.getElementById('tray-front');
    const isOpen = tray.classList.contains('open');
    if (!isOpen) {
        tray.classList.add('open');
        setTimeout(() => {
            document.getElementById('file-input').click();
            // Détecte le retour de focus (annulation ou sélection)
            const onFocus = () => {
                setTimeout(() => {
                    document.getElementById('tray-front').classList.remove('open');
                }, 300);
                window.removeEventListener('focus', onFocus);
            };
            window.addEventListener('focus', onFocus);
        }, 600);
    } else {
        tray.classList.remove('open');
    }
};

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

function setupAudio() {
    if (audioCtx && audioCtx.state === "suspended") { audioCtx.resume(); return; }
    if (audioCtx && audioCtx.state === "closed") { isAudioConnected = false; }
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

    const splitter = audioCtx.createChannelSplitter(2);
    const merger = audioCtx.createChannelMerger(2);

    analyzerL = audioCtx.createAnalyser();
    analyzerL.fftSize = 256;
    dataArrayL = new Float32Array(analyzerL.fftSize);

    analyzerR = audioCtx.createAnalyser();
    analyzerR.fftSize = 256;
    dataArrayR = new Float32Array(analyzerR.fftSize);

    src.connect(bassFilter);
    bassFilter.connect(trebleFilter);

    pannerNode = audioCtx.createStereoPanner();
    pannerNode.pan.value = balanceLevel;
    trebleFilter.connect(pannerNode);
    pannerNode.connect(splitter);

    splitter.connect(analyzerL, 0);
    splitter.connect(analyzerR, 1);

    splitter.connect(merger, 0, 0);
    splitter.connect(merger, 1, 1);
    merger.connect(audioCtx.destination);

    isAudioConnected = true;
    renderVU();
}

function renderVU() {
    requestAnimationFrame(renderVU);
    if (!analyzerL || !analyzerR || !isVUOn || isPeakSearching) return;

    analyzerL.getFloatTimeDomainData(dataArrayL);
    analyzerR.getFloatTimeDomainData(dataArrayR);

    function rms(arr) {
        let sum = 0;
        for (let i = 0; i < arr.length; i++) sum += arr[i] * arr[i];
        return Math.sqrt(sum / arr.length);
    }

    const rmsL = rms(dataArrayL);
    const rmsR = rms(dataArrayR);

    [['meter-L', rmsL], ['meter-R', rmsR]].forEach(([id, level]) => {
        const el = document.getElementById(id);
        if (!el) return;
        const val = Math.floor(Math.min(1, level * vuMultiplier * 6) * 40);
        for (let i = 0; i < 40; i++) {
            if (i < val) {
                if (i >= 30) el.children[i].className = 'meter-segment on-red';
                else if (i >= 20) el.children[i].className = 'meter-segment on-orange';
                else el.children[i].className = 'meter-segment on-blue';
            } else {
                el.children[i].className = 'meter-segment';
            }
        }
    });
}

['meter-L', 'meter-R'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        for (let i = 0; i < 40; i++) el.appendChild(document.createElement('div')).className = 'meter-segment';
    }
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

function showToneDisplay(label, value, noTimeout = false) {
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
    if (!noTimeout) volDisplayTimeout = setTimeout(hideVolumeDisplay, 1500);
}

function checkLock(e) {
    if (isABLocked) {
        const lockIndicator = document.getElementById('vfd-ab-lock');
        if (lockIndicator) {
            lockIndicator.classList.add('vfd-input-blink');
            setTimeout(() => lockIndicator.classList.remove('vfd-input-blink'), 500);
        }
        if (e) e.stopPropagation();
        return true;
    }
    return false;
}

function adjustVolume(change) {
    // On annule le mute si on touche au volume
    isMuted = false;

    // Calcul du nouveau volume (entre 0 et 1)
    let newVol = audio.volume + change;
    audio.volume = Math.max(0, Math.min(1, Math.round(newVol * 100) / 100));

    // Mise à jour de l'affichage VFD (le texte bleu)
    showVolumeDisplay();

    // On cache l'affichage après 1.5 seconde d'inactivité
    if (volDisplayTimeout) clearTimeout(volDisplayTimeout);
    volDisplayTimeout = setTimeout(hideVolumeDisplay, 1500);
}

let knobInterval = null;
let knobDelayTimeout = null;

function handleKnobMouseDown(event) {
    const knob = event.currentTarget;
    const rect = knob.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const middle = rect.width / 2;
    const direction = clickX < middle ? -1 : 1;

    // 1. Action immédiate au clic
    applyKnobAction(direction);

    // 2. Attendre 300ms avant de commencer la répétition (comme un vrai bouton)
    knobDelayTimeout = setTimeout(() => {
        knobInterval = setInterval(() => {
            applyKnobAction(direction);
        }, 80); // Vitesse de défilement (80ms pour plus de fluidité)
    }, 300);
}

function applyKnobAction(direction) {
    // On utilise un pas de 0.01 pour la précision
    const step = 0.01;
    adjustVolume(direction * step);

    // Rotation visuelle : 3 degrés par pas
    rotateKnob(direction * 3);
}

function stopKnobInterval() {
    // On nettoie le délai et l'intervalle
    if (knobDelayTimeout) clearTimeout(knobDelayTimeout);
    if (knobInterval) clearInterval(knobInterval);
    knobInterval = null;
    knobDelayTimeout = null;
}

function rotateKnob(deg) {
    currentRotation += deg;
    // Limites de rotation (Physique d'un vrai bouton Technics)
    if (currentRotation < -150) currentRotation = -150;
    if (currentRotation > 150) currentRotation = 150;

    const knobEl = document.getElementById('volume-knob');
    if (knobEl) {
        knobEl.style.transform = `rotate(${currentRotation}deg)`;
    }
}

// --- Tone knobs (Bass / Treble / Balance) ---
let toneKnobInterval = null;
let toneKnobDelayTimeout = null;
let bassRotation = 0;
let trebleRotation = 0;
let balanceRotation = 0;
let balanceLevel = 0; // -1 (full left) → 0 (center) → 1 (full right)
let pannerNode = null;

function getOrCreatePanner() {
    return pannerNode;
}

function adjustBalance(change) {
    balanceLevel = Math.max(-1, Math.min(1, Math.round((balanceLevel + change * 0.1) * 100) / 100));
    const panner = getOrCreatePanner();
    if (panner) panner.pan.setTargetAtTime(balanceLevel, audioCtx.currentTime, 0.01);
    showBalanceDisplay();
}

function showBalanceDisplay() {
    if (volDisplayTimeout) clearTimeout(volDisplayTimeout);
    const timeLabel = document.getElementById('time-label');
    const timeSep = document.getElementById('time-sep');
    timeLabel.innerText = 'BALANCE';
    timeSep.style.opacity = '0';
    const side = balanceLevel < -0.01 ? 'L' : balanceLevel > 0.01 ? 'R' : 'C';
    const val = Math.round(Math.abs(balanceLevel) * 10).toString().padStart(2, '0');
    document.getElementById('m-d1').innerText = side;
    document.getElementById('m-d2').innerText = ' ';
    document.getElementById('s-d1').innerText = val[0];
    document.getElementById('s-d2').innerText = val[1];
    // Le timer est lancé uniquement depuis stopToneKnobInterval quand c'est balance
}

let activeToneKnobType = null;

function handleToneKnobMouseDown(event, type) {
    const knob = event.currentTarget;
    const rect = knob.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const direction = clickX < rect.width / 2 ? -1 : 1;
    activeToneKnobType = type;

    // Annule tout timer d'effacement pendant l'interaction
    if (volDisplayTimeout) clearTimeout(volDisplayTimeout);

    applyToneKnobAction(direction, type);

    toneKnobDelayTimeout = setTimeout(() => {
        toneKnobInterval = setInterval(() => {
            applyToneKnobAction(direction, type);
        }, 80);
    }, 300);
}

function applyToneKnobAction(direction, type) {
    if (type === 'bass') {
        adjustBass(direction);
        bassRotation = Math.max(-150, Math.min(150, bassRotation + direction * 15));
        const el = document.getElementById('bass-knob');
        if (el) el.style.transform = `rotate(${bassRotation}deg)`;
    } else if (type === 'treble') {
        adjustTreble(direction);
        trebleRotation = Math.max(-150, Math.min(150, trebleRotation + direction * 15));
        const el = document.getElementById('treble-knob');
        if (el) el.style.transform = `rotate(${trebleRotation}deg)`;
    } else if (type === 'balance') {
        adjustBalance(direction);
        balanceRotation = Math.max(-150, Math.min(150, balanceRotation + direction * 15));
        const el = document.getElementById('balance-knob');
        if (el) el.style.transform = `rotate(${balanceRotation}deg)`;
    }
}

function stopToneKnobInterval() {
    if (toneKnobDelayTimeout) clearTimeout(toneKnobDelayTimeout);
    if (toneKnobInterval) clearInterval(toneKnobInterval);
    toneKnobInterval = null;
    toneKnobDelayTimeout = null;
    // Lance le timer d'effacement seulement au relâchement
    if (activeToneKnobType === 'balance') {
        if (volDisplayTimeout) clearTimeout(volDisplayTimeout);
        volDisplayTimeout = setTimeout(hideVolumeDisplay, 2500);
    }
    activeToneKnobType = null;
}
