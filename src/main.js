import { SceneManager } from './sceneManager.js';
import { createFpsCounter } from './ui/fps.js';
import { createTestbedScene } from './scenes/testbed.js';

const manager = new SceneManager(
  document.getElementById('view'),
  document.getElementById('ui'),
);

manager.register('testbed', createTestbedScene);

if (import.meta.env.DEV) {
  manager.onFrame = createFpsCounter(document.getElementById('app'));
}

manager.go('testbed');
manager.start();
