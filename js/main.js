import { applyLang, initApp } from './app.js';
import { initGrinder } from './grinder.js';
import { initRender, render } from './render.js';
import { initTimer } from './timer.js';
import { initNotify } from './notify.js';
import { initShare } from './share.js';
import { initDiary, renderDiary } from './diary.js';
import './sw-register.js';

initApp();
initGrinder();
initRender();
initTimer();
initNotify();
initShare();
initDiary();
renderDiary();
render();
applyLang();
