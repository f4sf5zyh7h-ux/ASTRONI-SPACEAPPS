import { SceneManager } from './sceneManager.js';
import { state } from './state.js';
import { createFpsCounter } from './ui/fps.js';
import { preloadModels } from './render/models.js';
import { createTitleScene } from './scenes/title.js';
import { createMissionSelectScene } from './scenes/missionSelect.js';
import { createIntroScene } from './scenes/intro.js';
import { createShowroomScene } from './scenes/showroom.js';
import { createWorkshopScene } from './scenes/workshop.js';
import { createBoardingScene } from './scenes/boarding.js';
import { createLaunchScene } from './scenes/launch.js';

const manager = new SceneManager(
  document.getElementById('view'),
  document.getElementById('ui'),
);

manager.register('title', createTitleScene);
manager.register('missions', createMissionSelectScene);
manager.register('intro', createIntroScene);

manager.register('workshop', createWorkshopScene);
manager.register('boarding', createBoardingScene);
manager.register('launch', createLaunchScene);
manager.register('showroom', createShowroomScene);

if (import.meta.env.DEV) {
  manager.onFrame = createFpsCounter(document.getElementById('app'));
  window.__astroni = manager; // for debugging in the browser console
  window.__state = state;
}

// Models load in the background while the title screen shows (it doesn't need them);
// Continue waits for them. Dev shortcut ?scene=intro waits first, then jumps straight there.
const start = import.meta.env.DEV && new URLSearchParams(location.search).get('scene');
const loading = preloadModels();
if (start && manager.factories.has(start) && start !== 'title') await loading;
manager.go(start && manager.factories.has(start) ? start : 'title');
manager.start();
