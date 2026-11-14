// Full-screen black fade used between scenes. Lives outside #ui so scene changes don't remove it.

let el;
function layer() {
  if (!el) {
    el = document.createElement('div');
    el.className = 'fade';
    document.getElementById('app').appendChild(el);
  }
  return el;
}

/** Fade to `opacity` (0 = clear, 1 = black) over `ms`. */
export function fadeTo(opacity, ms = 600) {
  const f = layer();
  f.style.transition = `opacity ${ms}ms ease`;
  f.style.pointerEvents = opacity > 0 ? 'auto' : 'none';
  requestAnimationFrame(() => (f.style.opacity = opacity));
  return new Promise((r) => setTimeout(r, ms));
}

/** Fade out, switch scene, fade back in. */
export async function transition(manager, name, params, ms = 600) {
  await fadeTo(1, ms);
  manager.go(name, params);
  await fadeTo(0, ms);
}

/** White flash (impacts). */
export function flash(ms = 500) {
  const f = document.createElement('div');
  f.className = 'flash';
  document.getElementById('app').appendChild(f);
  f.animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: ms, easing: 'ease-out' }).onfinish = () => f.remove();
}
