const soundPath = 'assets/sound/';
const audioCache = new Map();
const btnMap = new Map();
let audioCtx = null;

function ensureAudioContext(){
  if (!audioCtx){
    try{ audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ audioCtx = null; }
  }
}

function getAudio(filename){
  // returns an object {el, gain, srcNode}
  if (audioCache.has(filename)) return audioCache.get(filename);
  const el = new Audio(soundPath + filename);
  el.preload = 'auto';
  let obj = { el, gain: null, src: null };
  // create AudioContext lazily on first user gesture
  try{
    ensureAudioContext();
    if (audioCtx){
      // Create a MediaElementSource and GainNode when audio context is available
      const src = audioCtx.createMediaElementSource(el);
      const gain = audioCtx.createGain();
      gain.gain.value = 1;
      src.connect(gain);
      gain.connect(audioCtx.destination);
      obj.gain = gain;
      obj.src = src;
    }
  }catch(e){
    // ignore; fallback to element-only playback
  }
  audioCache.set(filename, obj);
  return obj;
}

function toggleAudioForButton(btn){
  const file = btn.getAttribute('data-sound');
  const audio = getAudio(file);
  if (!audio) return;
  if (!audio.paused){
    audio.pause();
    audio.currentTime = 0;
    btn.classList.remove('playing');
  } else {
    audio.currentTime = 0;
    audio.play().then(()=>{
      btn.classList.add('playing');
    }).catch(err => console.log('Play failed:', err));
    audio.onended = () => btn.classList.remove('playing');
  }
}

// Click/dblclick behavior:
// - click on stopped button -> start playback immediately
// - click on playing button -> fade out and stop over 3s
// - dblclick on playing button -> stop immediately
function fadeOutAndStop(audioObj, btn, duration = 3000){
  if (!audioObj) return;
  const el = audioObj.el;
  // If we have a gain node, use it for smooth precise fading
  if (audioObj.gain && audioCtx){
    try{
      const now = audioCtx.currentTime;
      const gain = audioObj.gain.gain;
      gain.cancelScheduledValues(now);
      const current = gain.value;
      gain.setValueAtTime(current, now);
      gain.linearRampToValueAtTime(0, now + duration/1000);
      // schedule pause and reset after duration
      if (audioObj._fadeTimeout) clearTimeout(audioObj._fadeTimeout);
      audioObj._fadeTimeout = setTimeout(()=>{
        try{ el.pause(); }catch(e){}
        try{ el.currentTime = 0; }catch(e){}
        gain.cancelScheduledValues(audioCtx.currentTime);
        gain.setValueAtTime(1, audioCtx.currentTime);
        if (btn) btn.classList.remove('playing');
        delete audioObj._fadeTimeout;
      }, duration);
    }catch(e){
      // fallback to element fade if something fails
      fallbackElementFade(el, btn, duration);
    }
  } else {
    // fallback: element volume manipulation
    fallbackElementFade(el, btn, duration);
  }
}

function fallbackElementFade(el, btn, duration){
  if (!el) return;
  if (el._fadeInterval) return;
  const startVol = (typeof el.volume === 'number') ? el.volume : 1;
  const stepMs = 50;
  const steps = Math.max(1, Math.ceil(duration / stepMs));
  let step = 0;
  el._fadeInterval = setInterval(()=>{
    step++;
    const v = startVol * Math.max(0, 1 - step / steps);
    try{ el.volume = v; }catch(e){}
    if (step >= steps){
      clearInterval(el._fadeInterval);
      delete el._fadeInterval;
      try{ el.pause(); }catch(e){}
      try{ el.currentTime = 0; }catch(e){}
      try{ el.volume = startVol; }catch(e){}
      if (btn) btn.classList.remove('playing');
    }
  }, stepMs);
}

function stopImmediately(audioObj, btn){
  if (!audioObj) return;
  const el = audioObj.el;
  if (audioObj._fadeTimeout){ clearTimeout(audioObj._fadeTimeout); delete audioObj._fadeTimeout; }
  if (audioObj.gain && audioCtx){
    try{
      audioObj.gain.gain.cancelScheduledValues(audioCtx.currentTime);
      audioObj.gain.gain.setValueAtTime(1, audioCtx.currentTime);
    }catch(e){}
  }
  if (el._fadeInterval){ clearInterval(el._fadeInterval); delete el._fadeInterval; }
  try{ el.pause(); }catch(e){}
  try{ el.currentTime = 0; }catch(e){}
  try{ el.volume = 1; }catch(e){}
  if (btn) btn.classList.remove('playing');
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('button.sound-btn');
  if (!btn) return;
  const file = btn.getAttribute('data-sound');
  const audio = getAudio(file);
  if (!audio) return;
  const audioObj = getAudio(file);
  const audioEl = audioObj.el;
  // ensure AudioContext resumed on first user gesture
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});
  if (audioEl.paused){
    // start immediately
    if (audioEl._fadeInterval){ clearInterval(audioEl._fadeInterval); delete audioEl._fadeInterval; }
    if (audioObj._fadeTimeout){ clearTimeout(audioObj._fadeTimeout); delete audioObj._fadeTimeout; }
    audioEl.currentTime = 0;
    try{ audioEl.volume = 1; }catch(e){}
    audioEl.play().then(()=>{
      btn.classList.add('playing');
    }).catch(err => console.log('Play failed:', err));
    audioEl.onended = () => btn.classList.remove('playing');
  } else {
    // playing -> fade out over 3s using GainNode when available
    fadeOutAndStop(audioObj, btn, 3000);
  }
});

document.addEventListener('dblclick', (e) => {
  const btn = e.target.closest('button.sound-btn');
  if (!btn) return;
  const file = btn.getAttribute('data-sound');
  const audio = getAudio(file);
  if (!audio) return;
  stopImmediately(audio, btn);
});

// Warm-up audio on first user gesture to satisfy autoplay restrictions
let warmed = false;
window.addEventListener('pointerdown', () => {
  if (warmed) return; warmed = true;
  const a = new Audio();
  a.src = '';
});

// --- Text area with swipe navigation ---
const textListUrl = 'assets/txt/list.json';
let textFiles = [];
let textIndex = 0;
const textArea = document.getElementById('text-area');

async function loadTextList(){
  try{
    const res = await fetch(textListUrl);
    if (!res.ok) throw new Error('No list');
    textFiles = await res.json();
    if (!Array.isArray(textFiles) || textFiles.length===0){ textFiles = []; textArea.innerHTML = 'Aucun fichier texte.'; return; }
    textIndex = 0;
    await loadText(textIndex);
  }catch(e){
    textArea.innerHTML = 'Pas de fichiers texte trouvés.';
  }
}

async function loadText(i){
  if (!textFiles || textFiles.length===0) return;
  const file = textFiles[i];
  try{
    const res = await fetch('assets/txt/'+file);
    if (!res.ok) throw new Error('fetch fail');
    const html = await res.text();
    textArea.innerHTML = html;
  }catch(e){
    textArea.innerHTML = 'Erreur chargement: '+file;
  }
}

function showNext(){ textIndex = (textIndex+1)%textFiles.length; loadText(textIndex); }
function showPrev(){ textIndex = (textIndex-1+textFiles.length)%textFiles.length; loadText(textIndex); }

// Swipe handling on textArea
let touchStartX = null;
textArea.addEventListener('touchstart', (e)=>{ touchStartX = e.changedTouches[0].clientX; });
textArea.addEventListener('touchend', (e)=>{
  if (touchStartX === null) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) < 50) { touchStartX = null; return; }
  if (dx < 0) { // swipe left -> previous (spec demandé)
    showPrev();
  } else { // swipe right -> next
    showNext();
  }
  touchStartX = null;
});

// keyboard fallback
document.addEventListener('keydown', (e)=>{
  if (e.key === 'ArrowLeft') showPrev();
  if (e.key === 'ArrowRight') showNext();
});

// dynamic building of sound buttons: prefer server-injected `window.SOUND_LIST`, fallback to API
const soundListUrl = '/api/sounds';
let soundFiles = [];
let currentButtons = [];

async function loadSoundList(){
  try{
    if (Array.isArray(window.SOUND_LIST) && window.SOUND_LIST.length>0){
      soundFiles = window.SOUND_LIST.slice();
    } else {
      const res = await fetch(soundListUrl);
      if (!res.ok) throw new Error('No sound list');
      soundFiles = await res.json();
    }
    if (!Array.isArray(soundFiles) || soundFiles.length===0){ soundFiles = []; console.log('No sounds'); return; }
    buildButtons(soundFiles);
  }catch(e){
    console.log('Pas de liste de sons:', e);
  }
}

function buildButtons(list){
  currentButtons = list.map(name => {
    const b = document.createElement('button');
    b.className = 'sound-btn';
    b.setAttribute('data-sound', name);
    // use a cleaned label from filename
    const label = name.replace(/[-_]/g,' ').replace(/\.mp3$/i,'');
    b.textContent = label;
    return b;
  });
  arrangeButtons(currentButtons);
}

// arrange buttons into rows of max 3, set widths/heights per row
function arrangeButtons(buttons){
  const container = document.querySelector('.buttons-grid');
  const GAP = 12; // matches CSS gap
  // clear container
  container.innerHTML = '';
  if (!buttons || buttons.length===0) return;
  // compute number of rows
  const numRows = Math.ceil(buttons.length / 3);
  // prepare empty rows (top-to-bottom)
  const rows = new Array(numRows).fill(0).map(()=>[]);
  // fill rows starting from bottom to top
  let idx = 0;
  for (let r = numRows - 1; r >= 0; r--) {
    for (let c = 0; c < 3 && idx < buttons.length; c++){
      rows[r].push(buttons[idx++]);
    }
  }

  // append rows top-to-bottom
  for (let ri = 0; ri < rows.length; ri++){
    const rowBtns = rows[ri];
    const row = document.createElement('div');
    row.className = 'btn-row';
    rowBtns.forEach(b => row.appendChild(b));
    container.appendChild(row);
    // determine height: bottom row = last index
    const isBottom = (ri === rows.length - 1);
    const h = isBottom ? 250 : 150;
    // compute width per button for this row
    const containerWidth = Math.min(container.clientWidth || window.innerWidth, 1200);
    const count = rowBtns.length || 1;
    const totalGap = GAP * (count - 1);
    let btnWidth = Math.floor((containerWidth - totalGap) / count);
    // cap width to reasonable max depending on responsive breakpoints
    const maxWidthDefault = isBottom ? 250 : 250;
    if (btnWidth > maxWidthDefault) btnWidth = maxWidthDefault;
    if (window.innerWidth < 420) {
      const smallMax = isBottom ? 160 : 160;
      if (btnWidth > smallMax) btnWidth = smallMax;
    } else if (window.innerWidth < 820) {
      const medMax = isBottom ? 200 : 200;
      if (btnWidth > medMax) btnWidth = medMax;
    }
    // apply styles
    rowBtns.forEach(b=>{
      b.style.width = btnWidth + 'px';
      b.style.height = h + 'px';
      b.style.flex = '0 0 ' + btnWidth + 'px';
    });
  }
}

window.addEventListener('resize', () => arrangeButtons(currentButtons));
document.addEventListener('DOMContentLoaded', () => arrangeButtons(currentButtons));

// init: load sounds then texts; prefer server-injected TEXT_LIST in loadTextList
async function init(){
  await loadSoundList();
  // if server injected TEXT_LIST, use it
  if (Array.isArray(window.TEXT_LIST) && window.TEXT_LIST.length>0){
    textFiles = window.TEXT_LIST.slice();
    textIndex = 0;
    await loadText(textIndex);
  } else {
    await loadTextList();
  }
}

init();
