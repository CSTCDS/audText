const soundPath = 'assets/sound/';
const audioCache = new Map();
const btnMap = new Map();

function getAudio(filename){
  if (audioCache.has(filename)) return audioCache.get(filename);
  const a = new Audio(soundPath + filename);
  a.preload = 'auto';
  audioCache.set(filename, a);
  return a;
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

document.addEventListener('click', (e) => {
  const btn = e.target.closest('button.sound-btn');
  if (!btn) return;
  toggleAudioForButton(btn);
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

// init
// arrange buttons into rows of max 3, set widths/heights per row
function arrangeButtons(){
  const container = document.querySelector('.buttons-grid');
  const buttons = Array.from(container.querySelectorAll('.sound-btn'));
  const GAP = 12; // matches CSS gap
  // clear container
  container.innerHTML = '';
  // group into rows up to 3
  for (let i=0;i<buttons.length;i+=3){
    const rowBtns = buttons.slice(i,i+3);
    const row = document.createElement('div');
    row.className = 'btn-row';
    // append buttons to row
    rowBtns.forEach(b=> row.appendChild(b));
    container.appendChild(row);
    // set heights: first row 250px, others 150px
    const h = (i===0)?250:150;
    // compute width per button: available container width minus gaps
    // use clientWidth of container to compute pixel widths
    const containerWidth = Math.min(container.clientWidth || window.innerWidth, 1200);
    const count = rowBtns.length;
    const totalGap = GAP * (count - 1);
    let btnWidth = Math.floor((containerWidth - totalGap) / count);
    // cap width to reasonable max
    const maxWidth = (i===0)?250:250;
    if (btnWidth > maxWidth) btnWidth = maxWidth;
    // responsive reduction for small screens
    if (window.innerWidth < 420) {
      const smallMax = (i===0)?160:160;
      if (btnWidth > smallMax) btnWidth = smallMax;
    } else if (window.innerWidth < 820) {
      const medMax = (i===0)?200:200;
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

window.addEventListener('resize', () => arrangeButtons());
document.addEventListener('DOMContentLoaded', () => arrangeButtons());

loadTextList();
