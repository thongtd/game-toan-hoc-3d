import './styles/base.css';
import './styles/ui.css';
import './styles/game.css';
import './styles/hub.css';

import { App } from './app/App.ts';
import { isDebugEnabled } from './app/debug-bridge.ts';

const app = new App();

if (isDebugEnabled()) {
  app.installDebug();
}

void app.start();

/**
 * Release the WebGL context and audio buffers when the page goes away.
 *
 * Without this, a reload can leave the old context alive long enough for the
 * browser to refuse a new one ("context loss and was blocked"), which would
 * greet the player with the error screen instead of the game.
 */
window.addEventListener('pagehide', () => {
  app.dispose();
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    app.dispose();
  });
}
