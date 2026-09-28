const container = document.getElementById('asciinema-demo');
const fallback = document.getElementById('demo-fallback');
const tabs = document.querySelectorAll('.demo-tab');
let player;

function showFallback() {
  container.hidden = true;
  fallback.hidden = false;
}

function play(cast) {
  if (!window.AsciinemaPlayer) {
    showFallback();
    return;
  }
  try {
    player?.dispose();
    container.replaceChildren();
    container.hidden = false;
    fallback.hidden = true;
    player = window.AsciinemaPlayer.create(cast, container, {
      autoPlay: false,
      theme: 'monokai',
      fit: 'width',
    });
    player.addEventListener('error', showFallback);
  } catch {
    showFallback();
  }
}

for (const tab of tabs) {
  tab.addEventListener('click', () => {
    for (const item of tabs) {
      const active = item === tab;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    }
    play(tab.dataset.cast);
  });
}

play('casts/cli.cast');
