import { applyLang, initApp } from './app.js';
import { initGrinder } from './grinder.js';
import { initRender, render } from './render.js';
import { initTimer } from './timer.js';
import { initNotify } from './notify.js';
import { initShare } from './share.js';
import { initDiary, renderDiary, startDiary } from './diary.js';
import { initUnits } from './units.js';
import { initInsights } from './insights.js';
import './sw-register.js';

async function start() {
  await startDiary();   // il diario (IndexedDB) va caricato prima del primo render
  initApp();
  initGrinder();
  initRender();
  initTimer();
  initNotify();
  initShare();
  initDiary();
  initUnits();
  initInsights();
  renderDiary();
  render();
  applyLang();
  document.documentElement.dataset.ready = '1';
}
start();
