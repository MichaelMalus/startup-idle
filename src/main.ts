import './style.css';
import { Game, fmt } from './game';
import { UI } from './ui';
import { DAYS_PER_SECOND } from './data';

const game = Game.load();
const away = game.catchUp();
if (away > 60) game.log(`While you were away (${fmt(away / 60)} min), the startup carried on without you.`);
const ui = new UI(game, document.getElementById('app')!);

let last = performance.now();
setInterval(() => {
  const now = performance.now();
  game.tick(Math.min((now - last) / 1000, 60) * DAYS_PER_SECOND);
  last = now;
  ui.render();
}, 200);
setInterval(() => game.save(), 10000);
addEventListener('beforeunload', () => game.save());
ui.render();
(window as unknown as { game: Game }).game = game;
