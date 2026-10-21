import { JOBS, ROLE_NAMES } from '/modules/catalog.mjs';
import { createView, identifyActions, isRotationDiagram } from '/modules/rotations.mjs';
import { buildRotation } from '/modules/planner.mjs';
import { actionHint, annotateCastSupport, gcdOptions, groupRotation, isGcdAttack, showWeaveAttacks } from '/modules/presentation.mjs';
import { pendingNotifications } from '/modules/updates.mjs';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const date = value => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not checked yet';
const descriptions = {
  PLD: 'Weaponskill combos and magic burst', WAR: 'Beast Gauge and Inner Release', DRK: 'Darkside, Blood Gauge, and Delirium', GNB: 'Cartridges and Continuation',
  WHM: 'DoT, damage spells, and lilies', SCH: 'DoT, Broil, and Aetherflow', AST: 'Combust, Malefic, and cards', SGE: 'Eukrasia, Phlegma, and Kardia',
  MNK: 'Forms, Beast Fury, and Blitzes', DRG: 'Alternating combo chains and jumps', NIN: 'Kazematoi, mudra, and burst', SAM: 'Sen, Iaijutsu, and Kenki', RPR: 'Soul Gauge and Enshroud', VPR: 'Vipersight and Reawaken',
  BRD: 'Songs, DoTs, and weaponskill procs', MCH: 'Tools, Heat, and Battery', DNC: 'Dance steps, procs, and Esprit',
  BLM: 'Astral Fire and Umbral Ice cycles', SMN: 'Demi-summons and elemental attunement', RDM: 'Dualcast and balanced mana', PCT: 'Color combos, motifs, and muses',
  BLU: 'Learned spells and equipped loadouts', BST: 'Familiars, TP, and instinctual combos',
};
let library = { jobs: [] };
let activeJob = null;
let currentView = null;
let currentRotation = null;
let conditions = {};
let search = '';
let filter = 'all';
let tab = 'rotations';
let mode = 'single';
let level = 100;
let playing = null;
let polling = null;
let toastTimer;
let lastChecked = null;
let shownUpdates = [];
let saved = {};
try { saved = JSON.parse(localStorage.getItem('eorzea-preferences') || '{}'); } catch {}
const initialScale = [1, 1.1, 1.25, 1.5].includes(saved.interfaceScale) ? saved.interfaceScale : 1.25;
document.documentElement.style.setProperty('--ui-scale', initialScale);
$('#ui-scale').value = String(initialScale);
const overviewSizes = [1, 1.1, 1.25, 1.5, 1.75, 2];
$('#overview-size').value = String(overviewSizes.includes(saved.overviewScale) ? saved.overviewScale : 1.25);

function save() {
  if (activeJob) saved[activeJob.id] = { level, mode, tab, conditions };
  try { localStorage.setItem('eorzea-preferences', JSON.stringify(saved)); } catch {}
}

function notify(text) {
  $('#toast').textContent = text;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5000);
}

function showUpdateNotice(force = false) {
  const all = pendingNotifications(library.jobs);
  const jobs = new Set(all.map(update => update.job));
  const button = $('#rotation-updates');
  button.hidden = !all.length;
  button.textContent = `Rotation updates · ${jobs.size}`;
  const pending = force ? all : pendingNotifications(library.jobs, saved.acknowledgedUpdates);
  if (!pending.length || document.querySelector('dialog[open]')) return;
  shownUpdates = pending;
  $('#updates-list').innerHTML = [...new Set(pending.map(update => update.job))].map(id => {
    const entries = pending.filter(update => update.job === id);
    return `<section class="update-job"><h3>${escape(entries[0].jobName)}</h3><ul>${entries.map(update => `<li><a href="${escape(update.url)}" target="_blank" rel="noreferrer">${escape(update.source)} ↗</a> · ${escape(update.summary)}<small>${update.published ? 'Publisher update ' + escape(update.published.slice(0, 10)) + ' · ' : ''}Detected ${escape(date(update.at))}</small>${update.changes.map(change => `<details class="rotation-change"><summary>${escape(change.section)} · compare changes</summary><strong>Previously</strong><p>${escape(change.before || 'Not present')}</p><strong>Now</strong><p>${escape(change.after || 'Removed')}</p></details>`).join('')}</li>`).join('')}</ul><button type="button" data-review-job="${escape(id)}">Open sources & updates</button></section>`;
  }).join('');
  $('#updates-dialog').showModal();
}

function imageError(event) {
  const image = event.target;
  if (image.tagName !== 'IMG' || image.dataset.failed) return;
  image.dataset.failed = 'true';
  image.classList.add('image-unavailable');
  image.alt = image.alt || 'Image temporarily unavailable';
  image.title = 'Image unavailable. Check your connection, then retry updates.';
}
document.addEventListener('error', imageError, true);

function jobIcon(job, className = '') {
  return `<img class="job-icon ${className}" src="${job.icon}" alt="" width="40" height="40" loading="lazy">`;
}

function matches(job) {
  return `${job.name} ${job.id} ${ROLE_NAMES[job.role]}`.toLowerCase().includes(search.toLowerCase());
}

function renderNav() {
  const jobs = library.jobs.length ? library.jobs : JOBS;
  $('#job-nav').innerHTML = Object.entries(ROLE_NAMES).map(([role, name]) => {
    const group = jobs.filter(job => job.role === role && matches(job));
    if (!group.length) return '';
    return `<div class="nav-group"><h2>${name}</h2>${group.map(job => `<a href="#/job/${job.id}" class="nav-job ${job.id === activeJob?.id ? 'selected' : ''}" ${job.id === activeJob?.id ? 'aria-current="page"' : ''}>${jobIcon(job)}<span>${job.name}</span></a>`).join('')}</div>`;
  }).join('') || '<p class="empty-search">No matching jobs.</p>';
  updateStatus();
}

function failedGuideCount() {
  return library.jobs.reduce((count, job) => count + (job.guides || []).filter(guide => guide.contentError).length, 0);
}

function updateStatus() {
  const status = $('#update-status');
  const button = $('#sync');
  button.disabled = Boolean(library.updating);
  button.innerHTML = `<span aria-hidden="true" class="${library.updating ? 'spin' : ''}">↻</span> ${library.updating ? 'Updating library…' : 'Check for updates'}`;
  const incomplete = library.jobs.filter(job => job.status !== 'current').length;
  const failedGuides = failedGuideCount();
  status.textContent = library.updating ? `${library.progress?.completed || 0} / 23 jobs checked` : library.error ? 'Update failed · cached data kept' : library.icyVeins?.error ? 'Icy Veins monitoring unavailable' : incomplete ? `${incomplete} sources need attention` : failedGuides ? `${failedGuides} guides could not refresh · saved copies kept` : `Checked ${date(library.checkedAt)}`;
  $('.connection-dot').classList.toggle('warning', Boolean(library.error || library.icyVeins?.error || incomplete || failedGuides));
}

function renderHome() {
  stopPlayback();
  const jobs = (library.jobs.length ? library.jobs : JOBS).filter(matches);
  $('#main').innerHTML = `
    <div class="index-heading"><h1>Job rotations</h1><p>Choose a job, then set your level and target count.</p></div>
    ${library.error ? `<div class="notice warning-notice">${escape(library.error)}. Your previous library is still available.</div>` : ''}
    <div class="library-toolbar"><div class="role-filters" role="group" aria-label="Filter jobs by role"><button data-role="all" class="${filter === 'all' ? 'active' : ''}">All jobs</button>${Object.entries(ROLE_NAMES).map(([role, name]) => `<button data-role="${role}" class="${filter === role ? 'active' : ''}">${name}</button>`).join('')}</div></div>
    <div id="job-grid">${Object.entries(ROLE_NAMES).map(([role, name]) => {
      const group = jobs.filter(job => job.role === role && (filter === 'all' || filter === role));
      if (!group.length) return '';
      return `<section class="job-group role-${role}"><h2>${name}<small>${group.length}</small></h2><div class="job-list">${group.map(job => `<a href="#/job/${job.id}" class="job-index-row">${jobIcon(job)}<span class="job-row-name">${job.name}</span><span class="job-row-level">Lv. 1–${job.cap}</span><span class="row-open" aria-hidden="true">›</span></a>`).join('')}</div></section>`;
    }).join('') || '<div class="empty-state">No jobs match your search.</div>'}</div>
    <footer class="page-footer"><span>${library.jobs.reduce((count, job) => count + (job.actions?.length || 0), 0)} actions · 23 jobs · PvE</span><div class="footer-links"><span>FFXIV © SQUARE ENIX</span><button type="button" data-credits>Credits</button></div></footer>`;
}

function actionButton(action, count = 1, note = '', index = '', flowId = '', priority = '', completed = false, start = false, example = false, gcd = false, slot = '') {
  return `<button type="button" class="action-tile${completed ? ' completed-action' : ''}${start ? ' flow-start' : ''}${example ? ' gcd-example' : ''}" data-action="${escape(action.id)}" ${completed ? 'data-completed="true"' : ''} ${example ? 'data-gcd-example="true"' : ''} ${gcd || example ? `data-gcd-action="true" data-gcd-row="${escape(priority)}" data-gcd-index="${slot}"` : ''} ${flowId ? `data-flow="${flowId}" data-step="${index}"` : ''} title="${escape(action.name)} · ${completed ? escape('Already done: ' + note) : 'Lv. ' + action.level} — view action details"><span class="action-status"${!completed && !start ? ' aria-hidden="true"' : ''}>${completed ? 'Skip' : start ? 'Start here' : ''}</span><span class="action-image"><img src="${escape(action.icon)}" alt="" width="48" height="48" loading="lazy">${count > 1 ? `<span class="repeat">×${count}</span>` : ''}</span><span class="action-name">${escape(action.name)}</span><span class="action-level">${completed ? '✓ Already done' : escape(actionHint(action, note, priority))}</span></button>`;
}

function conditionChoices(overview = false) {
  const render = control => {
    const id = `${overview ? 'overview-' : ''}condition-${control.key}`;
    const help = control.disabledReason || control.help;
    const attributes = `id="${id}" data-condition="${control.key}" ${control.disabled ? 'disabled' : ''} ${help ? `aria-describedby="${id}-help"` : ''}`;
    const hint = help ? `<small id="${id}-help">${escape(help)}</small>` : '';
    return control.type === 'checkbox'
      ? `<label class="condition-check ${control.disabled ? 'is-disabled' : ''}" for="${id}"><input type="checkbox" ${attributes} ${control.value ? 'checked' : ''}><span><strong>${escape(control.label)}</strong>${hint}</span></label>`
      : `<label class="condition-select ${control.disabled ? 'is-disabled' : ''}" for="${id}"><span>${escape(control.label)}</span><select ${attributes}>${control.options.map(option => `<option value="${escape(option.value)}" ${control.value === option.value ? 'selected' : ''}>${escape(option.label)}</option>`).join('')}</select>${hint}</label>`;
  };
  const selectors = currentRotation.controls.filter(control => control.type === 'select' && !control.hidden);
  const checks = currentRotation.controls.filter(control => control.type === 'checkbox');
  const displayId = `${overview ? 'overview-' : ''}display-gcds`;
  return `${selectors.length ? `<div class="condition-grid condition-selectors">${selectors.map(render).join('')}</div>` : ''}${checks.length ? `<div class="condition-grid condition-checkboxes">${checks.map(render).join('')}</div>` : ''}${!currentRotation.controls.length ? '<p>Your first weaponskill or spell is available at this level. More conditions unlock as you level up.</p>' : ''}<div class="rotation-display"><label class="condition-check" for="${displayId}"><input id="${displayId}" type="checkbox" data-display-gcds aria-describedby="${displayId}-help" ${saved.showGcds === false ? '' : 'checked'}><span><strong>Show attacks between weaves</strong><small id="${displayId}-help">Adds named weaponskill and spell examples between abilities. Continue your current combo or phase; examples are not a fixed opener. Hiding examples keeps required combo and spell steps. Saved for all jobs.</small></span></label></div>`;
}

function conditionControls(overview = false) {
  const content = `<div class="condition-content" role="group" aria-label="Rotation conditions"><p>Choose resources, ready actions, and complete setups. Greyed options explain what prevents their use.</p>${overview ? `<div class="overview-encounter"><label for="overview-level">Level <input id="overview-level" type="number" min="1" max="${activeJob.cap}" value="${level}"></label><label for="overview-mode">Encounter <select id="overview-mode"><option value="single" ${mode === 'single' ? 'selected' : ''}>Single target</option><option value="aoe" ${mode === 'aoe' ? 'selected' : ''}>Enemy pack</option></select></label></div>` : ''}<div class="condition-choices">${conditionChoices(overview)}</div><div class="condition-footer"><span>Saved for this job and encounter type.</span><button type="button" data-reset-conditions>Reset conditions</button></div></div>`;
  return overview ? content : `<details class="rotation-conditions" ${saved.conditionsCollapsed ? '' : 'open'}><summary>Your conditions <small>Show / hide settings</small></summary>${content}</details>`;
}

function prerequisiteActions(row) {
  const actions = (row.prerequisites || []).map((item, i) => (i ? '<span class="flow-arrow prerequisite-arrow" aria-hidden="true">→</span>' : '') + actionButton(item.action, item.count, item.note, '', '', row.id, true)).join('');
  return actions ? actions + '<span class="flow-divider" aria-hidden="true">│</span>' : '';
}

function priorityRows(flowId, compact = false) {
  let position = 0;
  const shown = saved.showGcds === false ? currentRotation.rows : showWeaveAttacks(activeJob, level, mode, currentRotation);
  const rows = annotateCastSupport(shown, level);
  return groupRotation(activeJob.id, rows).map(group => {
    const sections = group.sections.map(row => {
      const actions = prerequisiteActions(row) + row.steps.map((item, i) => {
        const start = position === 0;
        const gcd = isGcdAttack(item.action) && (row.type !== 'weave' || item.entry);
        const note = row.type === 'weave' && !gcd && !item.example && item.action.category !== 'Ability' ? item.note || 'Weave' : item.note;
        return `${i ? `<span class="flow-arrow" aria-hidden="true">${row.type === 'weave' && !row.weaveExample ? '·' : '→'}</span>` : ''}${actionButton(item.action, item.count, note, position++, flowId, row.id, false, start, item.example, gcd, i)}`;
      }).join('');
      const context = row.startingState ? `<p class="starting-state"><strong>Starting state:</strong> ${escape(row.startingState)}</p>` : '';
      const repeat = row.repeat > 1 ? `<p class="sequence-repeat" title="${escape(row.repeatNote)}">Repeat ×${row.repeat}${row.id === 'reawaken-free' ? ' · First free, then 50 Offering' : row.id === 'coils' ? ' · One coil per combo' : ' · Complete combo each time'}</p>` : '';
      return `<section class="priority-segment" data-priority="${escape(row.id)}" aria-label="${escape(row.title)}">${group.sections.length > 1 ? `<h4 title="${escape(row.reason)}">${escape(row.title)}</h4>` : ''}${activeJob.id === 'BLM' ? context : ''}<div class="action-flow">${actions}</div>${row.weaveExample ? '<p class="weave-example-label">Weaving example · keep your current combo or phase running</p>' : ''}${activeJob.id === 'BLM' ? '' : context}${repeat}</section>`;
    }).join('');
    const details = compact ? '' : `<div class="priority-explanations">${group.sections.map(row => `<div class="priority-explanation"><p class="priority-reason">${group.sections.length > 1 ? `<strong>${escape(row.title)}:</strong> ` : ''}${escape(row.reason)}</p>${row.prerequisiteNote ? `<p class="prerequisite-note">${escape(row.prerequisiteNote)}.</p>` : ''}</div>`).join('')}</div>`;
    return `<li class="priority-row"><div class="priority-heading"><h3>${escape(group.title)}</h3></div><div class="priority-segments">${sections}</div>${details}</li>`;
  }).join('');
}

function rotationCredits() {
  const references = currentRotation.references.map((reference, index) => '<a href="' + escape(reference.url) + '" target="_blank" rel="noreferrer" aria-label="Reference ' + (index + 1) + ': ' + escape(reference.publisher) + '" title="' + escape(reference.publisher) + '">' + (index + 1) + ' ↗</a>').join(' · ');
  const reviewed = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(currentRotation.rulesReviewedAt));
  return '<div class="rotation-credit"><p>Reference links: ' + references + '</p><p>Last rotation review: <time datetime="' + escape(currentRotation.rulesReviewedAt) + '">' + escape(reviewed) + '</time>. Update your conditions as buffs, cooldowns, and resources change.</p></div>';
}

function rotationList() {
  const instruction = currentRotation.presentation === 'sequence' ? 'Start at the highlighted first action. The starting-state note explains your phase; skip dimmed icons marked Already done.' : 'Use the highest available priority, then recheck your state. Skip dimmed Already done icons; Start here marks the next action after completed setup.';
  const weaving = saved.showGcds !== false && currentRotation.presentation !== 'sequence' ? '<p class="weaving-help">Blue GCD examples show named attacks between weaves. Continue your current combo or phase and recheck conditions after each action; these are weaving examples, not a fixed opener. Auto-attacks happen automatically.</p>' : '';
  return `<section class="your-rotation" aria-labelledby="your-rotation-title"><div class="rotation-result-heading"><div><h2 id="your-rotation-title">Your rotation <span>Lv. ${level} · ${mode === 'aoe' ? 'Enemy pack' : 'Single target'}</span></h2><p>${instruction}</p>${weaving}</div><div class="play-controls"><button class="fit-rotation" data-fit-rotation>Full view</button><button data-next="your-rotation" aria-label="Highlight next action" title="Highlight next action">Next action →</button><button data-reset="your-rotation" aria-label="Clear action highlight" title="Clear action highlight">↺</button></div></div><ol class="priority-list">${priorityRows('your-rotation')}</ol>${currentRotation.notes.length ? `<div class="rotation-notes">${currentRotation.notes.map(note => `<p>${escape(note)}</p>`).join('')}</div>` : ''}${rotationCredits()}</section>`;
}

function fitOverview() {
  if (!$('#rotation-overview').open) return;
  const viewport = $('#overview-viewport');
  const list = $('#overview-list');
  const width = viewport.clientWidth - 2;
  const height = viewport.clientHeight - 2;
  const requested = Number($('#overview-size').value);
  const rows = [...list.children];
  let best = { scale: 0, columns: 1 };
  const fits = (scale, columns) => {
    list.style.width = `${width / scale}px`;
    rows.forEach((row, index) => {
      row.style.gridColumn = String(index % columns + 1);
      row.style.gridRow = 'auto';
    });
    const nextRows = Array(columns).fill(1);
    rows.forEach((row, index) => {
      const column = index % columns;
      const span = row.offsetHeight + 8;
      row.style.gridRow = `${nextRows[column]} / span ${span}`;
      nextRows[column] += span;
    });
    return list.scrollHeight * scale <= height && list.scrollWidth * scale <= width + 1;
  };
  for (let columns = 1; columns <= Math.min(3, rows.length); columns++) {
    list.style.setProperty('--overview-columns', columns);
    if (fits(requested, columns)) { best = { scale: requested, columns }; break; }
    let low = 0.05, high = requested;
    for (let pass = 0; pass < 11; pass++) {
      const scale = (low + high) / 2;
      if (fits(scale, columns)) low = scale;
      else high = scale;
    }
    if (low > best.scale) best = { scale: low, columns };
  }
  list.style.setProperty('--overview-columns', best.columns);
  fits(best.scale, best.columns);
  list.style.setProperty('--overview-scale', best.scale);
  $('#overview-fit').textContent = best.scale < requested - 0.005
    ? `Shown at ${Math.floor(best.scale * 100)}% to keep all rows visible`
    : `${Math.round(requested * 100)}% · All rows visible`;
  positionOverviewConditions();
}

function positionOverviewConditions() {
  const menu = $('#overview-conditions');
  if (!menu.open) return;
  const panel = $('#overview-condition-content');
  const anchor = menu.querySelector('summary').getBoundingClientRect();
  panel.style.left = `${Math.max(24, Math.min(anchor.right - panel.offsetWidth, window.innerWidth - panel.offsetWidth - 24))}px`;
  panel.style.top = `${anchor.bottom + 8}px`;
  panel.style.maxHeight = `${Math.max(80, Math.min(window.innerHeight * 0.65, window.innerHeight - anchor.bottom - 32))}px`;
}

function renderOverview() {
  $('#overview-title').textContent = `${activeJob.name} · Lv. ${level} · ${mode === 'aoe' ? 'Enemy pack' : 'Single target'}`;
  $('#overview-list').innerHTML = priorityRows('overview', true);
  $('#overview-references').innerHTML = rotationCredits();
  const choices = $('#overview-condition-content .condition-choices');
  if (choices) {
    choices.innerHTML = conditionChoices(true);
    $('#overview-level').max = String(activeJob.cap);
    $('#overview-level').value = String(level);
    $('#overview-mode').value = mode;
  } else $('#overview-condition-content').innerHTML = conditionControls(true);
  fitOverview();
}

function showOverview() {
  if (!currentRotation) return;
  stopPlayback();
  $('#overview-conditions').open = false;
  renderOverview();
  $('#rotation-overview').showModal();
  fitOverview();
}

function updateLevel(value) {
  if (!activeJob || !Number.isFinite(Number(value))) return;
  const next = Math.min(activeJob.cap, Math.max(1, Math.round(Number(value))));
  if (next === level) return;
  level = next;
  stopPlayback();
  currentView = activeJob.actions.length ? createView(activeJob, level, mode) : { references: [], sequences: [], guideSections: [], actions: [] };
  $('#level').value = String(level);
  $('#level-output').textContent = level;
  document.querySelectorAll('[data-level]').forEach(button => button.classList.toggle('active', Number(button.dataset.level) === level));
  $('#tab-actions span').textContent = currentView.actions.length;
  $('#job-content').innerHTML = tab === 'rotations' ? rotationContent() : tab === 'actions' ? actionContent() : sourcesContent();
  if ($('#rotation-overview').open) renderOverview();
  save();
}

function linkActions(text) {
  const hits = identifyActions(text, activeJob?.actions || []);
  let cursor = 0;
  let result = '';
  for (const hit of hits) {
    result += escape(text.slice(cursor, hit.index));
    result += `<button type="button" class="inline-action" data-action="${escape(hit.action.id)}"><img src="${escape(hit.action.icon)}" alt="" width="18" height="18" loading="lazy">${escape(text.slice(hit.index, hit.end))}</button>`;
    cursor = hit.end;
  }
  return result + escape(text.slice(cursor));
}

function renderDetail() {
  stopPlayback();
  if (!activeJob) return;
  const missing = !activeJob.actions?.length;
  currentView = missing ? { references: [], sequences: [], guideSections: [], actions: [] } : createView(activeJob, level, mode);
  const levels = [...new Set([1, 30, 50, 60, 70, 80, 90, 100].filter(value => value <= activeJob.cap))];
  $('#main').innerHTML = `
    <a class="back-link" href="#/">← All jobs</a>
    <section class="job-heading role-${activeJob.role}"><div class="job-emblem">${jobIcon(activeJob)}</div><div><div class="eyebrow">${ROLE_NAMES[activeJob.role]} ${activeJob.role === 'limited' ? '· LIMITED JOB' : ''}</div><h1>${activeJob.name}</h1><p>${descriptions[activeJob.id]}</p></div><a class="official-link" href="${activeJob.official}" target="_blank" rel="noreferrer">Official job guide ↗</a></section>
    <div class="settings-panel"><div class="level-setting"><label for="level">LEVEL <output id="level-output">${level}</output></label><input id="level" type="range" min="1" max="${activeJob.cap}" value="${level}" aria-label="Job level"><div class="level-shortcuts">${levels.map(value => `<button data-level="${value}" class="${level === value ? 'active' : ''}">${value}</button>`).join('')}</div></div><div class="target-setting"><span class="setting-label">ENCOUNTER</span><div class="segmented" role="group" aria-label="Encounter type"><button data-mode="single" aria-pressed="${mode === 'single'}">◎ Single target</button><button data-mode="aoe" aria-pressed="${mode === 'aoe'}">◉ Area of effect</button></div></div></div>
    ${activeJob.role === 'limited' ? `<div class="notice limited-notice">${activeJob.id === 'BLU' ? 'Select only spells you have learned and equipped. Action levels do not indicate when you learn them.' : 'Set your familiar, player TP, and previous instinctual affinity below. Familiar TP is tracked separately in game.'}</div>` : ''}
    ${activeJob.status !== 'current' ? `<div class="notice warning-notice">Some sources could not be refreshed. ${missing ? 'Job data is not yet available. Use Check for updates to retry.' : 'Showing saved data. Open Sources & updates for details.'}</div>` : ''}
    ${activeJob.referenceNeedsReview ? '<div class="notice warning-notice">The source guide changed. This job’s rotation rules need review; check the updated guide before relying on the priorities below.</div>' : ''}
    <div class="detail-tabs" role="tablist" aria-label="Job information">${[['rotations', 'Rotations'], ['actions', 'Action library'], ['sources', 'Sources & updates']].map(([id, name]) => `<button role="tab" id="tab-${id}" data-tab="${id}" aria-controls="job-content" aria-selected="${tab === id}">${name}${id === 'actions' ? ` <span>${currentView.actions.length}</span>` : ''}</button>`).join('')}<span class="detail-freshness">${activeJob.checkedAt ? 'Checked ' + date(activeJob.checkedAt) : 'Awaiting first update'}</span></div>
    <section id="job-content" role="tabpanel" aria-labelledby="tab-${tab}">${tab === 'rotations' ? rotationContent() : tab === 'actions' ? actionContent() : sourcesContent()}</section>
    <footer class="page-footer"><div class="footer-hints"><span>Click any action for details</span><span>Conditions describe the situation you select</span></div><div class="footer-links"><span>FFXIV © SQUARE ENIX</span><button type="button" data-credits>Credits</button></div></footer>`;
}

function rotationContent() {
  if (!currentView.actions.length) return '<div class="empty-state">Downloading this job’s data. Check for updates if it remains unavailable.</div>';
  currentRotation = buildRotation(activeJob, level, mode, conditions[mode] || {});
  const images = [];
  const seen = new Set();
  for (const section of currentView.guideSections) for (const image of section.images || []) {
    if (seen.has(image.id) || !isRotationDiagram(image)) continue;
    seen.add(image.id);
    images.push({ ...image, source: section.source });
  }
  const matching = currentView.guideSections.filter(section => section.blocks.length && /rotation|damage|filler|combo|level|gcd|single|multi|aoe|burst|form|song|palette|sen|mudra|chakra/i.test(section.title) && !/healing|gear|role|unlock|materia|stat/i.test(section.title));
  const sources = [...new Set(matching.map(section => section.source))].map(source => matching.filter(section => section.source === source));
  const relevant = Array.from({ length: Math.max(0, ...sources.map(sections => sections.length)) }, (_, index) => sources.map(sections => sections[index]).filter(Boolean)).flat();
  return `${conditionControls()}${rotationList()}
    ${relevant.length ? `<details class="supporting-guides"><summary>Guide notes & explanations <small>Supporting reference</small></summary><div class="live-guidance">${relevant.slice(0, 16).map(section => `<details class="guide-section"><summary><span>${escape(section.title)}</span><small>${escape(section.publisher || 'The Balance')} · ${section.guideType.includes('leveling') ? 'Leveling guide' : 'Rotation guide'}</small></summary><div>${section.blocks.slice(0, 12).map(block => `<p>${linkActions(block.text)}</p>`).join('')}<a class="source-link" href="${escape(section.source)}" target="_blank" rel="noreferrer">Read full source ↗</a></div></details>`).join('')}</div></details>` : ''}
    ${activeJob.role === 'limited' ? `<p class="limited-source">For current familiar or learned-spell rules, <a href="${activeJob.official}" target="_blank" rel="noreferrer">open the official ${activeJob.name} guide ↗</a>.</p>` : ''}
    ${images.length ? `<details class="published-diagrams supporting-guides"><summary>Guide diagrams <small>Optional · check diagram patch</small></summary><div class="diagram-grid">${images.slice(0, 16).map(image => `<div class="diagram-entry"><button class="diagram-card" data-diagram="${escape(image.id)}" data-title="${escape(image.title)}"><img src="/api/icons/${image.id}.png?v=${encodeURIComponent(library.checkedAt || '')}" alt="${escape(image.title)}" loading="lazy"><span>${escape(image.title)} <span aria-hidden="true">⤢</span></span></button><a href="${escape(image.source)}" target="_blank" rel="noreferrer">Original guide ↗</a></div>`).join('')}</div></details>` : ''}`;
}

function actionContent() {
  return `<div class="content-heading"><h2>Actions at level ${level}</h2><p>${activeJob.id === 'BLU' ? 'Only learned and equipped spells are available in game.' : 'Job quest and combo prerequisites still apply.'} Select any action to inspect it.</p></div><label class="action-search-label" for="action-search">Search actions</label><input type="search" id="action-search" class="action-search" placeholder="Action name or effect…"><div class="actions-grid">${currentView.actions.map(action => `<button class="action-row" data-action="${escape(action.id)}" data-search="${escape(`${action.name} ${action.description}`.toLowerCase())}"><img src="${escape(action.icon)}" alt="" width="40" height="40" loading="lazy"><span><strong>${escape(action.name)}</strong><small>${escape(action.category)} · Lv. ${action.level}</small></span><span class="action-row-time">${escape(action.cast || 'Instant')}</span></button>`).join('')}</div><p id="no-actions" class="empty-state" hidden>No matching actions.</p>`;
}

function sourcesContent() {
  return `<div class="content-heading"><h2>Sources & updates</h2><p>Source dates, update health, and saved changes.</p></div>${library.icyVeins?.error ? `<div class="notice warning-notice">Icy Veins update dates could not be checked: ${escape(library.icyVeins.error)}. Saved publisher dates are retained.</div>` : ''}<div class="update-explainer"><h3>How updates work</h3><p>Checks run every six hours while the app is running. Select <strong>Check for updates</strong> to check now.</p><p>A popup shows changed rotation text, published diagrams, or leveling publisher dates from The Balance and Icy Veins. Date-only notices ask for source review; they do not confirm changed rotation instructions. The library’s rotation rules are reviewed manually.</p><p>Saved guides stay available offline or when downloads fail.</p></div><div class="source-cards"><article class="source-card"><span class="card-kicker">ACTION DATA</span><h3>Official job guide${activeJob.role === 'limited' ? ' + XIVAPI' : ''}</h3><p>${activeJob.actions.length} actions · ${activeJob.status === 'current' ? 'Last check succeeded' : 'Check details below'}</p><a href="${activeJob.official}" target="_blank" rel="noreferrer">View official source ↗</a>${activeJob.apiVersion ? `<small>Game-data version ${escape(activeJob.apiVersion)}</small>` : ''}</article>${activeJob.guides.map(guide => `<article class="source-card"><span class="card-kicker">ROTATION GUIDANCE</span><h3>${escape(guide.publisher || 'The Balance')} · ${guide.type.includes('leveling') ? 'Leveling' : 'Rotation guide'}</h3><p>${guide.externalLeveling ? guide.metadataStale ? 'Publisher date check unavailable' : 'Updates monitored · use original level selector' : guide.contentError ? guide.lastModified && !guide.metadataStale ? 'Publisher updates monitored · article download blocked' : 'Saved copy · source check failed' : guide.stale ? 'Saved copy · last update failed' : guide.contentSource === 'browser' ? 'Guide content refreshed through browser' : 'Guide content synchronized'}</p><a href="${escape(guide.url)}" target="_blank" rel="noreferrer">Read original guide ↗</a><small>${guide.updated ? 'Publisher date ' + escape(guide.updated.slice(0, 10)) : 'Publisher date not available'}${guide.patch ? ' · Patch ' + escape(guide.patch) : ''}</small>${guide.contentCheckedAt ? `<small>Guide cached ${escape(date(guide.contentCheckedAt))}</small>` : ''}${guide.lastModified ? `<small>Publisher reported update ${escape(guide.lastModified.slice(0, 10))}</small>` : ''}${guide.contentError ? `<small>${escape(guide.contentError)}. Cached notes stay available; open the original guide for current content.</small>` : ''}</article>`).join('')}</div>${activeJob.failures?.length ? `<div class="notice warning-notice"><strong>Source checks that need attention</strong>${activeJob.failures.map(failure => `<p>${escape(failure.source)}<br>${escape(failure.error)}</p>`).join('')}</div>` : ''}<section class="change-history"><h3>Saved changes</h3>${library.changes?.filter(change => change.job === activeJob.id).map(change => `<p><time>${date(change.at)}</time> ${escape(change.text)}</p>`).join('') || '<p>No changes detected since this library’s first download.</p>'}</section>`;
}

function showAction(id, slot = null) {
  const action = activeJob?.actions.find(item => item.id === id);
  if (!action) return;
  let choices = '';
  if (slot && saved.showGcds !== false) {
    const rotation = buildRotation(activeJob, level, mode, conditions[mode] || {});
    const rows = annotateCastSupport(showWeaveAttacks(activeJob, level, mode, rotation), level);
    const groups = gcdOptions(activeJob, level, mode, rotation, rows, slot);
    choices = `<section class="gcd-options" aria-labelledby="gcd-options-title"><h3 id="gcd-options-title">Your GCD options</h3><p>Only viable attacks at the clicked point, using your selected conditions and the preceding actions. Later combo steps and unprepared actions are hidden.</p>${groups.map(group => `<div class="gcd-option-group"><h4 title="${escape(group.reason)}">${escape(group.title)}</h4><div class="gcd-option-list">${group.options.map(option => `<button type="button" data-action="${escape(option.action.id)}" data-gcd-action="true" data-gcd-row="${escape(slot.row)}" data-gcd-index="${slot.index}" data-gcd-option ${option.action.id === id ? 'aria-current="true"' : ''}><img src="${escape(option.action.icon)}" alt="" width="32" height="32"><span><strong>${escape(option.action.name)}</strong><small>${escape(option.condition)}</small>${option.action.id === id ? '<small class="gcd-viewing">Viewing details</small>' : ''}</span></button>`).join('')}</div></div>`).join('') || '<p>No replacement is ready at this point with the selected conditions.</p>'}<p>Click an option to inspect it. Choices stay anchored to the original slot; the rotation is unchanged.</p></section>`;
  }
  $('#action-content').innerHTML = `<div class="action-dialog-heading"><img src="${escape(action.icon)}" alt="" width="64" height="64"><div><span class="card-kicker">${escape(action.category)} · LEVEL ${action.level}</span><h2 id="action-title" tabindex="-1">${escape(action.name)}</h2></div></div><div class="action-facts"><span><small>CAST</small>${escape(action.cast || 'Instant')}</span><span><small>RECAST</small>${escape(action.recast || '—')}</span>${action.cost ? `<span><small>COST</small>${escape(action.cost)}</span>` : ''}</div>${choices}<p class="action-description">${escape(action.description)}</p><a class="source-link" href="${escape(action.source)}" target="_blank" rel="noreferrer">View official source ↗</a>`;
  if (!$('#action-dialog').open) $('#action-dialog').showModal();
  $('#action-dialog').scrollTop = 0;
  $('#action-title').focus({ preventScroll: true });
}

function stopPlayback() {
  playing = null;
}

function nextStep(id) {
  if (playing?.id !== id) { stopPlayback(); playing = { id, step: -1 }; }
  const tiles = [...document.querySelectorAll(`[data-flow="${id}"]`)];
  if (!tiles.length) return;
  playing.step = (playing.step + 1) % tiles.length;
  document.querySelectorAll('.action-tile.is-current').forEach(tile => tile.classList.remove('is-current'));
  tiles[playing.step].classList.add('is-current');
  tiles[playing.step].setAttribute('aria-current', 'step');
  tiles.filter((_, index) => index !== playing.step).forEach(tile => tile.removeAttribute('aria-current'));
}

function route() {
  const id = location.hash.match(/^#\/job\/([A-Z]{3})$/)?.[1];
  const previousId = activeJob?.id;
  activeJob = library.jobs.find(job => job.id === id) || null;
  if (activeJob && id !== previousId) {
    level = Math.min(activeJob.cap, Math.max(1, saved[id]?.level || activeJob.cap));
    mode = saved[id]?.mode === 'aoe' ? 'aoe' : 'single';
    tab = ['rotations', 'actions', 'sources'].includes(saved[id]?.tab) ? saved[id].tab : 'rotations';
    conditions = saved[id]?.conditions && typeof saved[id].conditions === 'object' ? saved[id].conditions : {};
  }
  document.title = activeJob ? `${activeJob.name} — Eorzea Rotation Library` : 'Eorzea Rotation Library';
  renderNav();
  activeJob ? renderDetail() : renderHome();
}

async function load() {
  try {
    const response = await fetch('/api/library', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Library HTTP ${response.status}`);
    const data = await response.json();
    const wasUpdating = library.updating;
    const changed = data.checkedAt !== lastChecked;
    library = data;
    if (changed || !$('#main').dataset.loaded) {
      lastChecked = library.checkedAt;
      $('#main').dataset.loaded = 'true';
      route();
    } else updateStatus();
    showUpdateNotice();
    if (wasUpdating && !library.updating) notify(library.error ? `Update failed: ${library.error}` : library.icyVeins?.error ? 'Icy Veins update monitoring failed; saved data was kept.' : failedGuideCount() ? 'Some guides could not refresh; saved copies were kept.' : 'Source check finished. Changed guides appear in Rotation updates.');
    clearTimeout(polling);
    polling = setTimeout(load, library.updating ? 1500 : 30000);
  } catch (error) {
    $('#update-status').textContent = 'Local server disconnected';
    if (!library.jobs.length) $('#main').innerHTML = '<div class="empty-state"><h1>Local server is unavailable</h1><p>Close and reopen the app, then try again.</p></div>';
    clearTimeout(polling);
    polling = setTimeout(load, 5000);
  }
}

$('#rotation-updates').addEventListener('click', () => showUpdateNotice(true));
$('#updates-dialog').addEventListener('close', () => {
  saved.acknowledgedUpdates = [...new Set([...(saved.acknowledgedUpdates || []), ...shownUpdates.map(update => update.id)])].slice(-500);
  shownUpdates = [];
  save();
});
$('#search').addEventListener('input', event => { search = event.target.value; renderNav(); if (!activeJob) renderHome(); });
$('#sync').addEventListener('click', async () => {
  try {
    const response = await fetch('/api/sync', { method: 'POST', headers: { 'X-Eorzea-Client': 'library' } });
    if (!response.ok) throw new Error(`Update HTTP ${response.status}`);
    await load();
  } catch (error) { notify(error.message); }
});
document.addEventListener('click', event => {
  if (event.target.closest('[data-credits]')) { $('#credits-dialog').showModal(); return; }
  const review = event.target.closest('[data-review-job]');
  if (review) {
    const id = review.dataset.reviewJob;
    $('#updates-dialog').close();
    if (activeJob) save();
    saved[id] = { ...saved[id], tab: 'sources' };
    location.hash = '#/job/' + id;
    if (activeJob?.id === id) { tab = 'sources'; save(); renderDetail(); }
    return;
  }
  const action = event.target.closest('[data-action]');
  if (action) return showAction(action.dataset.action, action.dataset.gcdAction === 'true' ? { row: action.dataset.gcdRow, index: Number(action.dataset.gcdIndex) } : null);
  const role = event.target.closest('[data-role]');
  if (role) { filter = role.dataset.role; renderHome(); return; }
  const tabButton = event.target.closest('[data-tab]');
  if (tabButton) { tab = tabButton.dataset.tab; save(); renderDetail(); $(`#tab-${tab}`)?.focus(); return; }
  const levelButton = event.target.closest('[data-level]');
  if (levelButton) { updateLevel(levelButton.dataset.level); return; }
  const modeButton = event.target.closest('[data-mode]');
  if (modeButton) { mode = modeButton.dataset.mode; save(); renderDetail(); return; }
  const next = event.target.closest('[data-next]');
  if (next) { nextStep(next.dataset.next); return; }
  if (event.target.closest('[data-fit-rotation]')) { showOverview(); return; }
  const reset = event.target.closest('[data-reset]');
  if (reset) { stopPlayback(); document.querySelectorAll(`[data-flow="${reset.dataset.reset}"]`).forEach(tile => { tile.classList.remove('is-current'); tile.removeAttribute('aria-current'); }); return; }
  if (event.target.closest('[data-reset-conditions]')) {
    const overview = Boolean(event.target.closest('#overview-conditions'));
    conditions[mode] = {};
    save();
    stopPlayback();
    $('#job-content').innerHTML = rotationContent();
    if ($('#rotation-overview').open) renderOverview();
    $(`${overview ? '#overview-condition-content' : '#job-content'} [data-reset-conditions]`)?.focus();
    return;
  }
  const diagram = event.target.closest('[data-diagram]');
  if (diagram) {
    $('#diagram-image').src = `/api/icons/${diagram.dataset.diagram}.png?v=${encodeURIComponent(library.checkedAt || '')}`;
    $('#diagram-image').alt = diagram.dataset.title;
    $('#diagram-dialog').showModal();
  }
  if (event.target.closest('.dialog-close')) event.target.closest('dialog').close();
});
document.addEventListener('input', event => {
  if (event.target.id === 'level') updateLevel(event.target.value);
  if (event.target.id === 'overview-level' && event.target.value !== '') {
    updateLevel(event.target.value);
    $('#overview-level').focus({ preventScroll: true });
  }
  if (event.target.id === 'action-search') {
    const query = event.target.value.toLowerCase();
    let count = 0;
    document.querySelectorAll('.action-row').forEach(row => { row.hidden = !row.dataset.search.includes(query); if (!row.hidden) count++; });
    $('#no-actions').hidden = count > 0;
  }
});
document.addEventListener('change', event => {
  if (event.target.matches('[data-display-gcds]') && currentRotation) {
    const overview = Boolean(event.target.closest('#overview-conditions'));
    saved.showGcds = event.target.checked;
    save();
    stopPlayback();
    $('#job-content').innerHTML = rotationContent();
    if ($('#rotation-overview').open) renderOverview();
    $(`#${overview ? 'overview-' : ''}display-gcds`)?.focus({ preventScroll: true });
    return;
  }
  if (event.target.dataset.condition && currentRotation) {
    const key = event.target.dataset.condition;
    const overview = Boolean(event.target.closest('#overview-conditions'));
    conditions[mode] = { ...conditions[mode], [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value };
    for (const control of currentRotation.controls) if (control.parent === key) delete conditions[mode][control.key];
    save();
    stopPlayback();
    $('#job-content').innerHTML = rotationContent();
    if ($('#rotation-overview').open) renderOverview();
    const control = $(`#${overview ? 'overview-' : ''}condition-${key}`);
    (control && !control.disabled ? control : $('#overview-conditions > summary'))?.focus({ preventScroll: true });
  }
  if (event.target.id === 'level') updateLevel(event.target.value);
  if (event.target.id === 'overview-level') {
    updateLevel(event.target.value);
    $('#overview-level').focus({ preventScroll: true });
  }
  if (event.target.id === 'overview-mode') {
    mode = event.target.value;
    save();
    renderDetail();
    renderOverview();
    $('#overview-mode').focus();
  }
  if (event.target.id === 'overview-size') {
    const scale = Number(event.target.value);
    if (!overviewSizes.includes(scale)) return;
    saved.overviewScale = scale;
    save();
    fitOverview();
  }
  if (event.target.id === 'ui-scale') {
    const scale = Number(event.target.value);
    if (![1, 1.1, 1.25, 1.5].includes(scale)) return;
    saved.interfaceScale = scale;
    document.documentElement.style.setProperty('--ui-scale', scale);
    save();
  }
});
document.addEventListener('toggle', event => {
  if (event.target.id === 'overview-conditions') { positionOverviewConditions(); return; }
  if (!event.target.matches('.rotation-conditions')) return;
  saved.conditionsCollapsed = !event.target.open;
  save();
}, true);
document.addEventListener('click', event => {
  const menu = $('#overview-conditions');
  if (menu.open && !event.composedPath().includes(menu)) menu.open = false;
});
document.addEventListener('keydown', event => {
  const menu = $('#overview-conditions');
  if (event.key !== 'Escape' || !menu.open || !$('#rotation-overview').open) return;
  event.preventDefault();
  menu.open = false;
  menu.querySelector('summary').focus();
});
const overviewObserver = new ResizeObserver(fitOverview);
overviewObserver.observe($('#overview-viewport'));
overviewObserver.observe($('#overview-list'));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); }));
window.addEventListener('hashchange', () => { route(); $('#main').scrollTo({ top: 0 }); });
load();
