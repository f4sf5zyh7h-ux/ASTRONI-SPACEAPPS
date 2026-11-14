import { SceneManager } from './sceneManager.js';
import { createFpsCounter } from './ui/fps.js';
import { preloadModels } from './render/models.js';
import { createShowroomScene } from './scenes/showroom.js';

const manager = new SceneManager(
  document.getElementById('view'),
  document.getElementById('ui'),
);

manager.register('showroom', createShowroomScene);

if (import.meta.env.DEV) {
  manager.onFrame = createFpsCounter(document.getElementById('app'));
}

// Use any GLB models dropped into /public/models/, primitives for the rest.
await preloadModels();

manager.go('showroom');
manager.start();
