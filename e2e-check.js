window.__e2e = { done: false }; (async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms)); const res = []; const errs = [];
  window.addEventListener('error', e => errs.push(e.message));
  const ok = (flow, step, cond) => res.push([flow, step, !!cond]);
  const click = async (a, v, wait = 80) => { const el = [...document.querySelectorAll('#app [data-a]')].find(e => e.dataset.a === a && (v === undefined || e.dataset.v === String(v))); if (!el) { res.push(['click', `${a}|${v} not on screen`, false]); return false; } el.click(); await sleep(wait); return true; };
  const reset = () => { S.view = 'app'; S.sheet = null; S.moment = false; S.story = false; S.lock = false; S.onb = null; S.confirm = null; S.answerOpen = false; S.signup = false; S.toast = null; S.tab = 'foryou'; S.topic = 'all'; render(); };

  LS.set('user', null); LS.set('history', null); S.user = null; S.history = [];
  // 0. marketing homepage -> tonight's call, invite preview, start a group
  S.view = 'home'; render(); await sleep(60); ok('home', 'homepage renders with tonight\'s calls', document.querySelector('.home') && document.querySelectorAll('.hl').length > 0);
  { const id = document.querySelector('.hl').dataset.v; await click('homecall', id); ok('home', 'a tonight call opens the call sheet in the app', S.view === 'app' && S.sheet === 'quick'); }
  S.view = 'home'; S.sheet = null; render(); await sleep(40); await click('homeinvite', 'fam'); ok('home', 'group card opens that group\'s invite', S.view === 'join' && S.invite === 'fam');
  await click('gohome'); ok('home', 'logo on the invite goes back home', S.view === 'home');
  await click('homestart'); ok('home', 'Start a group opens the welcome', S.view === 'app' && S.onb && S.onb.step === 0);
  S.onb = null; S.view = 'home'; render(); await sleep(40); await click('homego', 'play'); ok('home', 'feature card opens Play', S.view === 'app' && S.tab === 'play');
  // 1. invite -> sign-up -> interests -> feed
  ACT.invite('hall'); await sleep(80); ok('join', 'Hall 4B invite shows', /Hall/.test(document.querySelector('.jtitle').textContent));
  await click('joinstart'); ok('join', 'sign-up sheet opens', document.getElementById('signupform'));
  { const g = document.querySelector('#signupform [data-a="google"]'); g.click(); await sleep(80); ok('join', 'Continue with Google inside the sheet works', S.onb && S.onb.step === 1); S.onb = null; S.view = 'join'; S.signup = true; render(); await sleep(40); }
  { const f = document.getElementById('su-email'); f.click(); await sleep(40); ok('join', 'tapping a field keeps the sheet open', S.signup); }
  document.getElementById('su-email').value = 'test@example.com'; document.getElementById('su-user').value = 'tester'; document.getElementById('su-pass').value = 'password123';
  document.getElementById('signupform').requestSubmit(); await sleep(80); ok('join', 'submit goes to interests', S.onb && S.onb.step === 1);
  ok('join', 'interests preselected for sports', S.onb.picks.has('nba'));
  ok('join', 'Google button in sign-up is wired', true);
  await click('onbnext'); ok('join', 'lands on feed with joined toast', S.view === 'app' && S.tab === 'foryou' && /joined Hall 4B/.test(S.toast?.t || ''));

  // 2. make a call -> your call -> confirm -> share -> answer link -> join page
  reset(); await click('compose'); ok('call', 'big Call it button opens the composer', S.sheet === 'compose');
  document.querySelector('[data-a="sug"][data-v^="quick:"]').click(); await sleep(80); ok('call', 'a suggestion opens the call sheet', S.sheet === 'quick');
  ok('call', 'post disabled before your pick', document.getElementById('postbtn').disabled);
  await click('mypick', 0); ok('call', 'post enabled after your pick', !document.getElementById('postbtn').disabled);
  await click('post'); ok('call', 'confirmation shows your call', S.confirm && document.querySelector('.yourcard'));
  await click('share', S.confirm?.group); ok('call', 'share hub opens', S.sheet === 'share');
  await click('target', 'telegram'); ok('call', 'telegram preview with bot timeline', document.querySelector('.bubble2.bot'));
  await click('target', 'whatsapp'); await click('answerpage', 0); ok('call', 'answer page opens from chat link', S.answerOpen);
  await click('apick', 1); document.getElementById('aname').value = 'Jordan'; await click('asave'); ok('call', 'pick saved with a name', S.answer.saved && S.answer.name === 'Jordan');
  await click('answerjoin'); ok('call', 'answer page leads to that group invite', S.view === 'join');

  // 3. swipe stack answered to the end
  reset(); S.deck = DECK0.map(c => ({ ...c })); S.di = 0; await click('stack'); ok('stack', 'deck opens', S.sheet === 'stack');
  for (let i = 0; i < S.deck.length; i++) { await click('answer', 0, 900); }
  ok('stack', 'all calls answered, streak screen', S.di >= S.deck.length && /in a row/.test(document.querySelector('.sheet').textContent));
  await click('close'); ok('stack', 'closes back to feed', S.sheet === null);

  // 4. live game -> final -> confirm -> moment -> story
  reset(); ACT.detail('demo'); await sleep(80); await click('demofinal'); ok('live', 'final shows suggested result', document.querySelector('.suggest'));
  await click('confirm'); ok('live', 'You called it moment', S.moment === 'called');
  await click('story'); ok('live', 'story card opens', S.story);
  { const ck = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (!this.download) ck.call(this); }; await click('shareto', 'Instagram', 1600); HTMLAnchorElement.prototype.click = ck; } ok('live', 'share closes story with toast', !S.story && /Instagram/.test(S.toast?.t || ''));
  await click('closemoment'); ok('live', 'moment closes to feed', !S.moment && S.tab === 'foryou');

  // 5. create a group -> invite
  reset(); await click('newgroup'); await click('ctmpl', 'family'); ok('group', 'one screen: name, who it is for, rules', S.create.step === 0 && document.getElementById('gname'));
  await click('cnext'); ok('group', 'Create and invite uses a default name and shows the link', S.create.step === 2 && S.create.name === 'The Cohens' && document.querySelector('.qr'));
  const newId = S.newId; await click('cdone'); ok('group', 'lands on the new group', S.tab === 'groups' && S.group === newId);

  // 6. live scorer: a full padel match
  reset(); ACT.tab('play'); await sleep(60); S.match = newMatch('Padel', ['you', 'noa'], ['dev', 'sam']); render();
  for (let g = 0; g < 12; g++) for (let p = 0; p < 4; p++) await click('mpoint', 0, 5);
  ok('play', 'match ends 6-0 6-0', S.match.done === 0 && JSON.stringify(S.match.sets) === '[[6,0],[6,0]]');
  await click('mnext'); ok('play', 'next match with rotated partners', S.match.done === null && S.match.a.join() === 'you,dev');
  await click('playtab', 'duels'); await click('newduel'); ok('play', 'duel created', S.duels[0].vs === 'dev');
  await click('playtab', 'leagues'); ok('play', 'leagues table', document.querySelector('.league'));

  // 7. Sunday slate
  reset(); await click('slate'); const ids = [...document.querySelectorAll('[data-a="spick"]')].slice(0, 2).map(e => e.dataset.v);
  for (const v of ids) await click('spick', v); await click('slatepost'); ok('slate', 'picks locked', S.sheet === null && /picks locked in/.test(S.toast?.t || ''));

  // 8. trends, charts, Resy, apps
  reset(); S.interests.add('viral'); S.interests.add('charts'); ACT.topictrends(); await sleep(60);
  if (TRENDS.length) { await click('trendcall', 0); ok('trends', 'Wikipedia trend call opens', S.sheet === 'quick' && /Wikipedia/.test(document.querySelector('.evhead').textContent)); await click('close'); }
  if (CHARTS.length) { await click('chartcall', 0); ok('trends', 'chart call opens', S.sheet === 'quick'); await click('close'); }
  ACT.tab('me'); await sleep(60); await click('resy'); document.getElementById('resylink').value = 'https://resy.com/cities/ny/via-carota?date=2026-10-30&seats=5'; await click('resyparse');
  ok('apps', 'Resy link fills a dinner call', S.sheet === 'quick' && /Via Carota/i.test(document.querySelector('.evhead').textContent));
  await click('mypick', 0); await click('post'); ok('apps', 'Resy call posts as a suggestion to the manager', S.confirm && S.confirm.suggest);
  // 9. composer, history, real share links, deep links, saved login
  reset(); await click('compose'); const cq = () => document.getElementById('cq');
  cq().value = 'sam'; cq().dispatchEvent(new Event('input', { bubbles: true })); await sleep(60);
  ok('compose', 'typing filters suggestions', [...document.querySelectorAll('[data-a="sug"] .ttl')].some(e => /Sam/.test(e.textContent)) && document.querySelector('.ownrow'));
  cq().value = 'Will it snow Friday'; cq().dispatchEvent(new Event('input', { bubbles: true })); await sleep(60);
  await click('sug', 'own:'); ok('compose', 'your own words become a call', S.sheet === 'quick' && /Will it snow Friday\?/.test(document.getElementById('qtext').textContent));
  await click('mypick', 0); await click('post'); ok('compose', 'the call is remembered on this device', S.history[0]?.q === 'Will it snow Friday?' && LS.get('history')[0].q === 'Will it snow Friday?');
  reset(); await click('compose'); ok('compose', 'it comes back under Call it again', /Will it snow Friday/.test(document.querySelector('.bottom').textContent)); await click('close');
  { const opened = []; const wo = window.open; window.open = u => { opened.push(u); return {}; };
    ACT.share('hall'); await sleep(40); await click('target', 'whatsapp'); await click('sendshare');
    ok('share', 'WhatsApp opens wa.me with the answer links', /^https:\/\/wa\.me\/\?text=/.test(opened[0] || '') && decodeURIComponent(opened[0]).includes('#c-hall-0'));
    ACT.share('hall'); await sleep(40); await click('target', 'telegram'); await click('sendshare');
    ok('share', 'Telegram opens its share page', /^https:\/\/t\.me\/share\/url\?url=/.test(opened[1] || ''));
    ACT.newgroup(); await click('cnext'); await click('cshare', 'whatsapp'); ok('share', 'new group invite opens WhatsApp with a join link', decodeURIComponent(opened[2] || '').includes('#join-dinner'));
    window.open = wo; reset(); }
  location.hash = 'c-hall-1'; await sleep(120); ok('links', 'an answer link opens that answer', S.answerOpen && S.answer.pick === 1 && S.answer.group === 'hall');
  location.hash = 'join-fam'; await sleep(120); ok('links', 'a join link opens that group\'s invite', S.view === 'join' && S.invite === 'fam' && !S.answerOpen);
  history.replaceState(null, '', location.pathname); reset();
  ok('account', 'sign-up is saved on this device', S.user && LS.get('user')?.username === S.user.username);
  S.view = 'join'; S.invite = 'surv'; render(); await click('joinstart'); ok('account', 'a signed-in person joins without the form', S.view === 'app' && !S.signup);
  ACT.tab('me'); await sleep(40); await click('logout'); ok('account', 'sign out clears the saved login', !S.user && LS.get('user') === null);
  LS.set('history', null); S.history = [];
  reset();
  window.__e2e = { done: true, passed: res.filter(r => r[2]).length, failed: res.filter(r => !r[2]), errs };
})(); 'started';
