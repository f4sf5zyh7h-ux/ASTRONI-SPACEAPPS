import { SceneManager } from './sceneManager.js';
import { createFpsCounter } from './ui/fps.js';
import { preloadModels } from './render/models.js';
import { createTitleScene } from './scenes/title.js';
import { createMissionSelectScene } from './scenes/missionSelect.js';
import { createIntroScene } from './scenes/intro.js';
import { createShowroomScene } from './scenes/showroom.js';
import { createWorkshopScene } from './scenes/workshop.js';
import { createBoardingScene } from './scenes/boarding.js';

const manager = new SceneManager(
  document.getElementById('view'),
  document.getElementById('ui'),
);

manager.register('title', createTitleScene);
manager.register('missions', createMissionSelectScene);
manager.register('intro', createIntroScene);

manager.register('workshop', createWorkshopScene);
manager.register('boarding', createBoardingScene);
manager.register('showroom', createShowroomScene);

if (import.meta.env.DEV) {
  manager.onFrame = createFpsCounter(document.getElementById('app'));
  window.__astroni = manager; // for debugging in the browser console
}

// Use any GLB models dropped into /public/models/, primitives for the rest.
await preloadModels();

// Dev shortcut: ?scene=intro jumps straight to a scene.
const start = import.meta.env.DEV && new URLSearchParams(location.search).get('scene');
manager.go(start && manager.factories.has(start) ? start : 'title');
manager.start();
