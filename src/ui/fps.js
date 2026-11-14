/** Tiny FPS readout, refreshed twice a second. Lives outside #ui so scene changes don't remove it. */
export function createFpsCounter(parent) {
  const el = document.createElement('div');
  el.className = 'fps';
  parent.appendChild(el);

  let frames = 0;
  let elapsed = 0;

  return (dt) => {
    frames += 1;
    elapsed += dt;
    if (elapsed >= 0.5) {
      el.textContent = `${Math.round(frames / elapsed)} fps`;
      frames = 0;
      elapsed = 0;
    }
  };
}
