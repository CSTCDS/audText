const soundPath = 'assets/sound/';
const audioCache = new Map();

function getAudio(filename){
  if (audioCache.has(filename)) return audioCache.get(filename);
  const a = new Audio(soundPath + filename);
  a.preload = 'auto';
  audioCache.set(filename, a);
  return a;
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-sound]');
  if (!btn) return;
  const file = btn.getAttribute('data-sound');
  const audio = getAudio(file);
  // Stop previous playback of same audio
  audio.currentTime = 0;
  audio.play().catch(err => console.log('Play failed:', err));
});

// Optional: warm-up on first user interaction to satisfy autoplay restrictions
let warmed = false;
window.addEventListener('pointerdown', () => {
  if (warmed) return; warmed = true;
  // create a silent unlocked buffer for browsers needing user gesture
  const a = new Audio();
  a.src = '';
});
