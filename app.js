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
  const audioObj = getAudio(file);
  if (!audioObj) return;
  const audioEl = audioObj.el;
  // ensure AudioContext resumed on first user gesture
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});
  if (audioEl.paused){
    // stop all other playing sounds immediately
    for (const [fname, obj] of audioCache.entries()){
      if (fname === file) continue;
      try{
        if (obj && obj.el && !obj.el.paused){
          // stop abruptly
          const otherBtn = btnMap.get(fname);
          stopImmediately(obj, otherBtn);
        }
      }catch(e){}
    }
    // remove playing class from any other buttons
    document.querySelectorAll('button.sound-btn.playing').forEach(b=>{ if (b !== btn) b.classList.remove('playing'); });
    // play clicked sound
    if (audioEl._fadeInterval){ clearInterval(audioEl._fadeInterval); delete audioEl._fadeInterval; }
    if (audioObj._fadeTimeout){ clearTimeout(audioObj._fadeTimeout); delete audioObj._fadeTimeout; }
    audioEl.currentTime = 0;
    try{ audioEl.volume = 1; }catch(e){}
    audioEl.play().then(()=>{
      btn.classList.add('playing');
    }).catch(err => console.log('Play failed:', err));
    audioEl.onended = () => btn.classList.remove('playing');
  } else {
    // single click on a playing sound -> fade out over 4s
    fadeOutAndStop(audioObj, btn, 4000);
  }
});

document.addEventListener('dblclick', (e) => {
  const btn = e.target.closest('button.sound-btn');
  if (!btn) return;
  const file = btn.getAttribute('data-sound');
  const audio = getAudio(file);
  if (!audio) return;
  // double-click -> stop immediately
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
const TEXT_UI = !!textArea;

async function loadTextList(){
  if (!TEXT_UI) return; // text UI removed, skip
  try{
    const res = await fetch(textListUrl);
    if (!res.ok) throw new Error('No list');
    textFiles = await res.json();
    if (!Array.isArray(textFiles) || textFiles.length===0){ textFiles = []; if (textArea) textArea.innerHTML = 'Aucun fichier texte.'; return; }
    // ensure sorted by filename (numeric-aware)
    textFiles.sort(numericFilenameCompare);
    textIndex = 0;
    await loadText(textIndex);
  }catch(e){
    if (textArea) textArea.innerHTML = 'Pas de fichiers texte trouvés.';
  }
}

async function loadText(i){
  if (!TEXT_UI) return;
  if (!textFiles || textFiles.length===0) return;
  const file = textFiles[i];
  try{
    const res = await fetch('assets/txt/'+file);
    if (!res.ok) throw new Error('fetch fail');
    const html = await res.text();
    // set header title from filename
    const titleEl = document.getElementById('text-title');
    if (titleEl){
      const nameNoExt = file.replace(/\.html$/i,'');
      titleEl.textContent = smartSplit(nameNoExt);
    }
    if (textArea) textArea.innerHTML = html;
  }catch(e){
    if (textArea) textArea.innerHTML = 'Erreur chargement: '+file;
  }
}

function showNext(){ textIndex = (textIndex+1)%textFiles.length; loadText(textIndex); }
function showPrev(){ textIndex = (textIndex-1+textFiles.length)%textFiles.length; loadText(textIndex); }

// Swipe handling on textArea
let touchStartX = null;
if (textArea){
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
}

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
      // try API first (for node backend), fallback to static JSON for PHP hosting
      try{
        const res = await fetch(soundListUrl);
        if (res.ok) {
          soundFiles = await res.json();
        } else {
          throw new Error('API unavailable');
        }
      }catch(e){
        // fallback to static list bundled with the app
        try{
          const res2 = await fetch(soundPath + 'list.json');
          if (res2.ok) soundFiles = await res2.json();
          else throw new Error('No static list');
        }catch(e2){
          console.log('Fallback failed:', e2);
          soundFiles = [];
        }
      }
    }
    if (!Array.isArray(soundFiles) || soundFiles.length===0){ soundFiles = []; console.log('No sounds'); return; }
    // sort filenames (case-insensitive, numeric-aware)
    soundFiles.sort((a,b)=> a.localeCompare(b, undefined, {numeric:true, sensitivity:'base'}));
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
    // label should be the full filename (keep extension), without any path
    const parts = name.split('/');
    const filename = parts[parts.length - 1];
    // make label breakable: prefer break before extension, then after underscores
    const escapeHtml = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    const makeBreakable = s => {
      // insert a break opportunity before the last dot (extension)
      const withExt = s.replace(/\.([^.]*)$/,'<wbr>.$1');
      // allow breaks after underscores
      return withExt.replace(/_/g, '_<wbr>');
    };
    const labelHtml = makeBreakable(escapeHtml(filename));
    b.innerHTML = labelHtml;
    // right-click to rename
    b.addEventListener('contextmenu', async (ev) => {
      ev.preventDefault();
      const fullName = name; // may include path
      const currentBasename = filename;
      const newName = prompt('Nouveau nom (avec extension):', currentBasename);
      if (!newName || newName === currentBasename) return;
      // preserve path if present
      const dirPath = fullName.includes('/') ? fullName.replace(/\/[^/]+$/, '') : '';
      const newRel = dirPath ? (dirPath + '/' + newName) : newName;
      try{
        // Try primary endpoint, if it returns non-JSON or 404, fallback to /api/rename.php
        let res = await fetch('api/sounds/rename.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ old: fullName, new: newRel })
        });
        let text = await res.text();
        if (res.status === 404 || /<html|<!doctype/i.test(text)){
          // try fallback
          res = await fetch('api/rename.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ old: fullName, new: newRel })
          });
          text = await res.text();
        }
        let j = null;
        try{ j = JSON.parse(text); }catch(e){
          // show raw response to help debugging
          alert('Serveur répond invalide JSON:\n' + text);
          return;
        }
        if (!res.ok) throw new Error(j.message || 'Erreur serveur');
        if (j.success){
          // update button and data attribute
          b.setAttribute('data-sound', newRel);
          b.textContent = newName;
          // update cached audio mapping (keyed by fullName)
          if (audioCache.has(fullName)){
            const v = audioCache.get(fullName);
            audioCache.delete(fullName);
            audioCache.set(newRel, v);
          }
          alert('Fichier renommé en ' + newName);
          // reload page after user dismisses the alert
          try{ location.reload(); }catch(e){}
        } else {
          alert('Erreur: ' + (j.message || 'unknown'));
        }
      }catch(err){
        alert('Erreur: ' + err.message);
      }
    });
    return b;
  });
  arrangeButtons(currentButtons);
  // Preload audio files (skip those starting with xx or XX)
  try{
    list.forEach(fname => {
      try{
        const parts = fname.split('/');
        const basename = parts[parts.length - 1];
        if (/^xx/i.test(basename)) return; // skip files starting with xx
        const ao = getAudio(fname);
        if (ao && ao.el){
          ao.el.preload = 'auto';
          try{ ao.el.load(); }catch(e){}
        }
      }catch(e){ }
    });
  }catch(e){ }
}

// Heuristic word segmentation to split concatenated filenames into readable words
function smartSplit(s){
  // replace separators first
  let base = s.replace(/[_-]+/g, ' ');
  if (base.indexOf(' ') >= 0) return base.replace(/\s+/g,' ').trim();
  // if camelCase, split before capitals
  if (/[A-Z]/.test(s)){
    return s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g,' ').trim();
  }
  const str = s.toLowerCase();

  const dict = new Set([
    'le','la','les','de','des','du','et','en','un','une','pour','avec','sans','sur','dans','a','au','aux',
    'mon','ton','son','fort','boyard','theme','thème','applaudissements','applaudissement','applaudir','applaudis',
    'oh','rires','rire','laugh','laughs','applause','cheer','cheers','sound','son','sons','audio','music','musique',
    'intro','outro','bg','background','ambient','ding','beep','click','clicks','clap','claps','oh','hey','yeah',
    'main','theme','track','track1','track2','voice','voix','sample','demo','test','note','tone'
  ]);

  // DP segmentation: minimize cost; known word cost = 1, unknown word cost = len^2
  const n = str.length;
  const best = Array(n+1).fill(null);
  best[0] = {cost:0, words:[]};
  for (let i=0;i<n;i++){
    if (best[i] === null) continue;
    for (let j=i+1;j<=n;j++){
      const w = str.slice(i,j);
      let cost = 0;
      if (dict.has(w)) cost = 1;
      else cost = (w.length)*(w.length);
      const candCost = best[i].cost + cost;
      if (best[j] === null || candCost < best[j].cost){
        best[j] = {cost:candCost, words: best[i].words.concat([w])};
      }
    }
  }
  let words = null;
  if (best[n]) words = best[n].words;
  if (!words){
    // fallback: split roughly into chunks of 4
    const out = [];
    for (let i=0;i<n;i+=4) out.push(str.slice(i,i+4));
    return out.join(' ');
  }
  // Rejoin words but try to merge single-letter fragments with neighbors
  const merged = [];
  for (let i=0;i<words.length;i++){
    const w = words[i];
    if (w.length === 1 && merged.length>0){
      merged[merged.length-1] = merged[merged.length-1] + w;
    } else {
      merged.push(w);
    }
  }
  // Capitalize first letters optionally
  return merged.map(x => x).join(' ').replace(/\b([a-z])/g, (m,p)=>p).trim();
}

// Compare filenames numerically when possible (e.g., "2.html" < "10.html")
function numericFilenameCompare(a,b){
  // try extract leading integer
  const na = a.match(/^(\d+)/);
  const nb = b.match(/^(\d+)/);
  if (na && nb){
    const ia = parseInt(na[1],10);
    const ib = parseInt(nb[1],10);
    if (ia !== ib) return ia - ib;
    // if same leading number, fallback to full string compare
  }
  return a.localeCompare(b);
}

// arrange buttons into rows of max 3, set widths/heights per row
function arrangeButtons(buttons){
  const container = document.querySelector('.buttons-grid');
  const GAP = 12; // matches CSS gap
  // clear container
  container.innerHTML = '';
  if (!buttons || buttons.length===0) return;
  // compute number of columns (4 when wide screens, else 3)
  const COLS = (window.innerWidth > 1200) ? 4 : 3;
  // compute number of rows
  const numRows = Math.ceil(buttons.length / COLS);
  // prepare empty rows (top-to-bottom)
  const rows = new Array(numRows).fill(0).map(()=>[]);
  // fill rows starting from top to bottom (first items appear at the top)
  let idx = 0;
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < COLS && idx < buttons.length; c++){
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
    textFiles.sort(numericFilenameCompare);
    textIndex = 0;
    await loadText(textIndex);
  } else {
    await loadTextList();
  }
}

init();
