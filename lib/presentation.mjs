import { normalize, pickAction, targetCount, pictomancerColors } from './catalog.mjs';

export const isGcdAttack = action => ['Weaponskill', 'Spell'].includes(action.category) || /Mudra Combination:/.test(action.description || '');

export function actionHint(action, note = '', priority = '') {
  const side = action.description?.match(/when executed from (?:a |the )?target['’]s (flank|rear)\b/i)?.[1];
  const positional = side ? side[0].toUpperCase() + side.slice(1).toLowerCase() : '';
  if (note) return [positional, note].filter(Boolean).join(' · ');
  if (/Mudra Combination:/.test(action.description || '')) return 'Ninjutsu · GCD';
  if (/Make the ritual mudra/.test(action.description || '')) return 'Mudra · do not weave';
  if (action.name === 'Reawaken' && priority === 'reawaken-free') return 'Free entry';
  if (action.name === 'Reawaken' && priority === 'reawaken') return '50 Offering';
  if (action.name === 'Apex Arrow' && priority === 'voice') return '80+ Soul Voice';
  const gauge = action.description?.match(/^([^\n:]+?) (?:Gauge )?Cost:\s*(\d+)\s*$/m);
  const cost = gauge ? `${gauge[2]} ${gauge[1].replace(/ Gauge$/, '').replace('Serpent Offerings', 'Offering')}` : action.cost && !/^[-—]$/.test(action.cost.trim()) ? action.cost : '';
  const timing = action.category === 'Ability' ? 'Weave' : action.cast && action.cast !== 'Instant' ? `${action.cast} cast` : /Combo Action:|Can only be executed after successfully landing/.test(action.description || '') ? 'Combo' : 'GCD';
  if (positional && action.category !== 'Ability') return positional;
  return [positional || cost.replace('Anguine Tribute', 'Tribute'), timing].filter(Boolean).join(' · ');
}

export function annotateCastSupport(rows, level = 100) {
  let swift = false;
  return rows.map(row => ({ ...row, steps: row.steps.flatMap(step => {
    if (step.action.name === 'Swiftcast') { swift = true; return [step]; }
    if (step.action.category !== 'Spell') return [step];
    const note = (step.note || '').replace(/Instant\s*·\s*Swiftcast(?:\s*·\s*)?/gi, '').trim();
    const cast = step.action.name === 'Foul' && level < 80 ? '2.5s' : step.action.name === 'Despair' && level < 100 ? '3s' : step.action.cast;
    const supported = /Instant|Firestarter|Dualcast|Triplecast/.test(note);
    if (swift && supported && !/Instant/.test(note)) return [{ ...step, note: ['Instant', note].filter(Boolean).join(' · ') }];
    if (swift && !Number.parseFloat(cast) && !supported) return [{ ...step, note: ['Instant', note].filter(Boolean).join(' · ') }];
    if (!swift || !Number.parseFloat(cast) || supported || /unaffected by Swiftcast|cannot be affected by Swiftcast/i.test(step.action.description || '')) return [{ ...step, note }];
    swift = false;
    const instant = { ...step, count: 1, note: ['Instant', 'Swiftcast', note].filter(Boolean).join(' · '), castSupport: 'Swiftcast' };
    return [instant, ...(step.count > 1 ? [{ ...step, count: step.count - 1, note }] : [])];
  }) }));
}

const comboFamilies = [
  ['True Thrust', 'Raiden Thrust'], ['Vorpal Thrust', 'Lance Barrage'], ['Disembowel', 'Spiral Blow'],
  ['Full Thrust', "Heavens' Thrust"], ['Chaos Thrust', 'Chaotic Spring'], ['Hakaze', 'Gyofu'], ['Fuga', 'Fuko'],
  ['Split Shot', 'Heated Split Shot'], ['Slug Shot', 'Heated Slug Shot'],
];
const comboFamily = name => comboFamilies.find(names => names.some(item => normalize(item) === normalize(name)))?.[0] || name;
const preservesCombo = new Set(['Hot Shot', 'Air Anchor', 'Drill', 'Bioblaster', 'Chain Saw', 'Excavator', 'Full Metal Field', 'Heat Blast', 'Blazing Shot', 'Auto Crossbow', 'Phantom Kamaitachi', 'Fleeting Raiju', 'Forked Raiju'].map(normalize));
const readyActions = [
  ['Goring Blade', 'goring'], ['Confiteor', 'confiteor'], ['Atonement', 'atonement'], ['Supplication', 'supplication'], ['Sepulchre', 'sepulchre'],
  ['Inner Chaos|Chaotic Cyclone', 'chaos'], ['Primal Rend', 'rend'], ['Primal Ruination', 'ruination'],
  ['Disesteem', 'scorn'], ['Scarlet Delirium|Comeuppance|Torcleaver|Impalement', 'delirium'], ['Sonic Break', 'break'], ['Reign of Beasts', 'reign'],
  ['Glare IV', 'sight'], ['Afflatus Misery', 'misery'], ['Toxikon|Toxikon II', 'addersting'],
  ["Wind's Reply", 'windReply'], ["Fire's Reply", 'fireReply'], ['Phantom Kamaitachi', 'phantom'], ['Fleeting Raiju|Forked Raiju', 'raiju'],
  ['Ogi Namikiri', 'ogi'], ['Kaeshi: Namikiri', 'kaeshiOgi'], ['Harvest Moon', 'soulsow'], ['Perfectio', 'perfectio'],
  ['Straight Shot|Refulgent Arrow|Wide Volley|Shadowbite', 'hawk'], ['Blast Arrow', 'blastArrow'], ['Radiant Encore', 'encore'], ['Resonant Arrow', 'resonant'], ['Full Metal Field', 'metal'], ['Excavator', 'excavator'],
  ['Reverse Cascade|Rising Windmill', 'symmetry'], ['Fountainfall|Bloodshower', 'flow'], ['Tillana', 'tillana'], ['Starfall Dance', 'starfall'],
  ['Last Dance', 'lastDance'], ['Finishing Move', 'finishing'], ['Dance of the Dawn', 'dawn'],
  ['Verfire', 'verfire'], ['Verstone', 'verstone'], ['Grand Impact', 'grandImpact'], ['Ruin IV', 'ruin4'], ['Star Prism', 'prism'],
].flatMap(([names, status]) => names.split('|').map(name => [normalize(name), status]));
const readiness = new Map(readyActions);
const gcdGrants = [
  ['Fight or Flight', { goring: 1 }], ['Requiescat|Imperator', { magic: 4, confiteor: 1 }], ['Atonement', { supplication: 1 }], ['Supplication', { sepulchre: 1 }],
  ['Royal Authority', { atonement: 1, divine: 1 }], ['Prominence', { divine: 1 }], ['Inner Release', { release: 3, rend: 1 }], ['Primal Rend', { ruination: 1 }],
  ['Delirium', { delirium: 3 }], ['Living Shadow', { scorn: 1 }], ['No Mercy', { break: 1 }], ['Bloodfest', { reign: 1 }], ['Presence of Mind', { sight: 3 }],
  ['Riddle of Wind', { windReply: 1 }], ['Riddle of Fire', { fireReply: 1 }], ['Bunshin', { phantom: 1 }], ['Raiton', { raiju: 1 }],
  ['Ikishoten', { ogi: 1 }], ['Ogi Namikiri', { kaeshiOgi: 1 }], ['Soulsow', { soulsow: 1 }], ['Barrage', { hawk: 1, resonant: 1 }],
  ['Radiant Finale', { encore: 1 }], ['Apex Arrow', { blastArrow: 1 }], ['Chain Saw', { excavator: 1 }], ['Barrel Stabilizer', { metal: 1 }],
  ['Standard Finish|Finishing Move', { lastDance: 1 }], ['Technical Finish', { tillana: 1, dawn: 1 }], ['Devilment', { starfall: 1 }],
  ['Flourish', { flow: 1, symmetry: 1, finishing: 1 }], ['Acceleration', { grandImpact: 1, acceleration: 1 }], ['Energy Drain|Energy Siphon', { ruin4: 1 }],
  ['Starry Muse', { prism: 1, hyperphantasia: 5 }], ['Manafication', { swordplay: 3 }], ['Perfect Balance', { balance: 3, beastChakra: 0 }], ['Meikyo Shisui', { meikyo: 3, tendo: 1 }],
].flatMap(([names, statuses]) => names.split('|').map(name => [normalize(name), statuses]));
const generatedReadiness = new Map(gcdGrants);

// Examples advance their own teaching branch; real priorities retain the planner's resource accounting.
function gcdSlotState(job, level, rotation, rows, targetRow, index) {
  const state = rotation.state;
  const current = targetRow.steps[index];
  const held = Object.fromEntries(Object.entries(state).map(([key, value]) => [key, value === true ? 1 : value === false ? 0 : value]));
  Object.assign(held, {
    previous: '', used: new Set(), hue: ({ none: 0, one: 1, two: 2 })[state.hues] || 0, subtractive: 0,
    hammer: state.hammer === 'active' ? 3 : 0, hammerStep: 0, whitePaint: Number(Boolean(state.white)), blackPaint: Number(Boolean(state.black)), monochrome: Boolean(state.black),
    confiteor: Number(Boolean(state.magic)), magic: state.magic ? 4 : 0, release: state.release ? 3 : 0, delirium: state.delirium ? 3 : 0,
    beast: 50 * (Number(Boolean(state.gauge)) + Number(Boolean(state.chaos))), blood: state.blood ? 50 : 0, cartridges: Number(state.cartridges || 0),
    offering: state.reawaken ? 50 : 0, freeReawaken: Number(Boolean(state.ready)), tribute: 0, coils: Number(Boolean(state.coils)),
    voice: state.voice ? 80 : 0, hawk: Number(Boolean(state.proc)), esprit: state.esprit ? 80 : state.finish === 'dawn' ? 50 : 0,
    soulsow: Number(Boolean(state.prepared)), reaver: state.reaver && state.reaver !== 'none' ? 1 : 0, enshroud: 0,
    form: state.form === 'none' ? 'opo' : state.form, blitz: state.blitz !== 'none', meikyo: state.meikyo ? 3 : 0,
    mana: state.melee ? 50 : 0, swordplay: 0, manaStacks: 0, dualcast: Boolean(state.dualcast), grandImpact: Number(Boolean(state.impact)), acceleration: 0, balance: 0, beastChakra: 0,
    attunement: ['ruby', 'topaz', 'emerald'].includes(state.phase) ? state.phase : '', attunementLeft: state.phase === 'ruby' ? 2 : 4,
    demiActive: state.phase === 'demi', overheat: 0, dance: '', excavator: state.reassemble && state.reassembleTarget === 'excavator' ? 1 : 0,
  });
  if (job.id === 'DNC' && state.finish !== 'none') held[({ last: 'lastDance', finishing: 'finishing', dawn: 'dawn' })[state.finish] || state.finish] = 1;
  const advance = step => {
    const name = step.action.name, key = normalize(name), is = names => names.split('|').some(item => normalize(item) === key);
    if (readiness.has(key)) held[readiness.get(key)] = Math.max(0, Number(held[readiness.get(key)] || 0) - 1);
    const color = ['Fire|Blizzard', 'Aero|Stone', 'Water|Thunder'].findIndex(pattern => new RegExp(`^(${pattern}) (II in|in) `).test(name));
    if (job.id === 'PCT') {
      if (color >= 0) { held.hue = (color + 1) % 3; if (held.subtractive) held.subtractive--; if (color === 2 && level >= 80) held.whitePaint = Math.min(5, held.whitePaint + 1); }
      if (is('Subtractive Palette')) { held.subtractive = 3; if (level >= 90) held.monochrome = true; }
      if (is('Striking Muse')) { held.hammer = 3; held.hammerStep = 0; }
      if (is('Hammer Stamp|Hammer Brush|Polishing Hammer')) { held.hammer--; held.hammerStep = (held.hammerStep + 1) % 3; }
      if (is('Holy in White')) held.whitePaint--;
      if (is('Comet in Black')) { held.blackPaint--; held.monochrome = false; }
      if (is('Rainbow Drip')) { held.rainbow = 0; held.whitePaint++; }
      if (held.hyperphantasia > 0 && /consumes a stack of Hyperphantasia/i.test(step.action.description)) { held.hyperphantasia--; if (!held.hyperphantasia && level >= 92) held.rainbow = 1; }
      if (held.monochrome && !held.blackPaint && held.whitePaint > 0) { held.whitePaint--; held.blackPaint++; }
    }
    if (is('Infuriate')) { held.beast += 50; held.chaos = level >= 72 ? 1 : 0; }
    if (is('Bloodfest')) held.cartridges += level >= 88 ? 3 : 2;
    if (is('Gnashing Fang|Burst Strike|Fated Circle')) held.cartridges--;
    if (is('Double Down')) held.cartridges -= 2;
    if (is('Solid Barrel|Demon Slaughter') && job.id === 'GNB') held.cartridges++;
    if (is('Inner Beast|Fell Cleave|Steel Cyclone|Decimate|Inner Chaos|Chaotic Cyclone')) { if (held.release && !is('Inner Chaos|Chaotic Cyclone')) held.release--; else held.beast -= 50; }
    if (is('Bloodspiller|Quietus')) { if (held.delirium) held.delirium--; else held.blood -= 50; }
    if (is('Holy Spirit|Holy Circle')) { if (held.divine) held.divine--; else if (held.magic) held.magic--; }
    if (is('Confiteor|Blade of Faith|Blade of Truth|Blade of Valor')) held.magic--;
    if (is('Eukrasia')) held.eukrasia = 1;
    if (/^Eukrasian /.test(name)) held.eukrasia = 0;
    if (job.id === 'MNK') {
      if (held.balance > 0 && /^(Bootshine|Leaping Opo|Dragon Kick|Arm of the Destroyer|Shadow of the Destroyer|True Strike|Rising Raptor|Twin Snakes|Four-point Fury|Snap Punch|Pouncing Coeurl|Demolish|Rockbreaker)$/.test(name)) { held.balance--; held.beastChakra++; if (!held.balance) held.blitz = true; }
      if (is('Bootshine|Leaping Opo|Dragon Kick|Arm of the Destroyer|Shadow of the Destroyer')) held.form = 'raptor';
      if (is('True Strike|Rising Raptor|Twin Snakes|Four-point Fury')) held.form = 'coeurl';
      if (is('Snap Punch|Pouncing Coeurl|Demolish|Rockbreaker')) held.form = 'opo';
      if (is("Fire's Reply|Elixir Field|Elixir Burst|Flint Strike|Rising Phoenix|Tornado Kick|Phantom Rush|Celestial Revolution")) { held.form = 'opo'; if (!is("Fire's Reply")) held.blitz = false; }
    }
    if (job.id === 'NIN' && step.action.category === 'Weaponskill' && !is('Fleeting Raiju|Forked Raiju')) held.raiju = 0;
    if (job.id === 'SAM') {
      if (is('Gekko|Mangetsu')) held.getsu = 1;
      if (is('Kasha|Oka')) held.ka = 1;
      if (is('Yukikaze')) held.setsu = 1;
      if (is('Higanbana|Tenka Goken|Tendo Goken|Midare Setsugekka|Tendo Setsugekka')) { held.setsu = held.getsu = held.ka = 0; held.kaeshi = name; }
      if (is('Shoha')) held.meditation = 0;
      if (level >= 80 && is('Higanbana|Tenka Goken|Tendo Goken|Midare Setsugekka|Tendo Setsugekka|Ogi Namikiri')) held.meditation = Number(held.meditation || 0) + 1;
      if (step.action.category === 'Weaponskill' && held.meikyo) held.meikyo--;
    }
    if (job.id === 'RPR') {
      if (is('Enshroud')) held.enshroud = 5;
      if (is('Void Reaping|Cross Reaping|Grim Reaping')) held.enshroud--;
      if (is('Communio')) { held.enshroud = 0; if (['harvest', 'prepare'].includes(state.shroud) && level >= 100) held.perfectio = 1; }
      if (is('Gluttony')) held.reaver = 2;
      if (is('Blood Stalk|Unveiled Gibbet|Unveiled Gallows|Grim Swathe')) held.reaver = 1;
      if (is('Gibbet|Gallows|Guillotine|Executioner’s Gibbet|Executioner’s Gallows|Executioner’s Guillotine')) held.reaver--;
    }
    if (job.id === 'VPR') {
      if (is('Serpent’s Ire')) { held.coils++; if (level >= 90) held.freeReawaken = 1; }
      if (is('Vicewinder|Vicepit') && level >= 82) held.coils++;
      if (is('Reawaken')) { if (held.freeReawaken) held.freeReawaken--; else held.offering -= 50; held.tribute = level >= 96 ? 5 : 4; }
      if (is('First Generation|Second Generation|Third Generation|Fourth Generation|Ouroboros')) held.tribute--;
      if (is('Uncoiled Fury')) held.coils--;
    }
    if (is('Apex Arrow')) held.voice -= 80;
    if (is('Hypercharge')) held.overheat = 5;
    if (is('Heat Blast|Blazing Shot|Auto Crossbow')) held.overheat--;
    if (job.id === 'DNC') {
      if (is('Standard Step|Technical Step')) held.dance = name;
      if (is('Standard Finish|Technical Finish')) held.dance = '';
      if (is('Saber Dance|Dance of the Dawn')) held.esprit -= 50;
      if (is('Tillana')) held.esprit += 50;
    }
    if (job.id === 'SMN') {
      if (is('Aethercharge|Dreadwyrm Trance|Summon Bahamut|Summon Phoenix|Summon Solar Bahamut')) held.demiActive = true;
      if (/^(Ruby|Topaz|Emerald) (Ruin|Rite|Outburst|Disaster|Catastrophe)/.test(name)) held.attunementLeft--;
    }
    if (job.id === 'RDM') {
      if (/^Enchanted /.test(name)) { if (held.swordplay) held.swordplay--; else held.mana -= /Riposte|^Enchanted Moulinet$/.test(name) ? 20 : 15; held.manaStacks++; held.dualcast = false; }
      if (is('Verflare|Verholy')) held.manaStacks = 0;
      if (step.action.category === 'Spell' && !is('Grand Impact')) {
        const accelerated = held.acceleration > 0 && /^(Verthunder|Veraero)( III)?$|^(Scatter|Impact)$/.test(name);
        held.dualcast = !accelerated && Number.parseFloat(step.action.cast) > 0 && !held.dualcast;
        if (accelerated) {
          held.acceleration = 0;
          if (/^Verthunder/.test(name)) held.verfire = 1;
          if (/^Veraero/.test(name)) held.verstone = 1;
        }
      }
    }
    if (job.id === 'BLU' && is("The Ram's Voice")) held.freeze = true;
    Object.assign(held, generatedReadiness.get(key));
    if (is('Acceleration') && level < 96) held.grandImpact = 0;
    if (['Weaponskill', 'Spell'].includes(step.action.category) && !preservesCombo.has(key) && !(job.id === 'SMN' && /^(Aethercharge|Dreadwyrm Trance|Summon)/.test(name))) held.previous = name;
    if (!step.example) held.used.add(step.action.id);
  };
  for (const row of rows) {
    const end = row === targetRow ? index : row.steps.length;
    for (const step of row.steps.slice(0, end)) {
      if (step.example && !current.example) {
        if (job.id === 'MNK') {
          if (/^(Bootshine|Leaping Opo|Dragon Kick|Arm of the Destroyer|Shadow of the Destroyer)$/.test(step.action.name)) held.form = 'raptor';
          if (/^(True Strike|Rising Raptor|Twin Snakes|Four-point Fury)$/.test(step.action.name)) held.form = 'coeurl';
          if (/^(Snap Punch|Pouncing Coeurl|Demolish|Rockbreaker)$/.test(step.action.name)) held.form = 'opo';
          held.previous = step.action.name;
        }
        if (job.id === 'PCT' && /^(Fire|Aero|Water) (II in|in) /.test(step.action.name)) held.hue = (/^Fire/.test(step.action.name) ? 1 : /^Aero/.test(step.action.name) ? 2 : 0);
        continue;
      }
      for (let cast = 0; cast < step.count; cast++) advance(step);
    }
    if (row === targetRow) break;
  }
  return held;
}

export function gcdOptions(job, level, mode, rotation, rows, slot) {
  const targetRow = rows.find(row => row.id === slot?.row);
  const current = targetRow?.steps[slot?.index];
  if (!current || !isGcdAttack(current.action)) return [];
  const held = gcdSlotState(job, level, rotation, rows, targetRow, slot.index);
  const currentName = current.action.name;
  const protectedRow = ['setup', 'prepull'].includes(targetRow.id) || {
    BLM: () => true,
    NIN: () => /Mudra Combination:/.test(current.action.description),
    SMN: () => held.demiActive || held.attunement && held.attunementLeft > 0 || /Crimson/.test(currentName),
    GNB: () => ['reign', 'gnashing'].includes(targetRow.id) && !/^(Reign of Beasts|Gnashing Fang)$/.test(currentName),
    PLD: () => /^(Blade of|Supplication|Sepulchre)/.test(currentName),
    DRK: () => /^(Comeuppance|Torcleaver)$/.test(currentName),
    RDM: () => targetRow.id === 'melee' && !/^(Enchanted Riposte|Enchanted Moulinet)$/.test(currentName),
    RPR: () => held.enshroud > 0 || held.reaver > 0,
    VPR: () => held.tribute > 0 || /^(Hunter|Swiftskin).*(Coil|Den)$/.test(currentName),
    DNC: () => Boolean(held.dance),
    SAM: () => /^Kaeshi:|^Tendo Kaeshi/.test(currentName),
    PCT: () => /^(Hammer Brush|Polishing Hammer)$/.test(currentName),
  }[job.id]?.() || false;
  const previousMatches = name => normalize(comboFamily(name)) === normalize(comboFamily(held.previous));
  const eligible = (row, step) => step.action.level <= level && isGcdAttack(step.action) && (row.type !== 'weave' || step.example || step.entry) && (!['setup', 'prepull'].includes(row.id) || step === current);
  const candidates = rows.flatMap(row => row.steps.filter(step => eligible(row, step)).map(step => ({ row, step })));
  const comboReady = action => action.description?.match(/Combo Action: ([^\n]+)/)?.[1]?.split(/ or /).some(previousMatches);
  const hasCombo = candidates.some(({ step }) => comboReady(step.action));
  const available = ({ row, step }) => {
    const action = step.action, name = action.name, key = normalize(name), same = action.id === current.action.id;
    const is = names => names.split('|').some(item => normalize(item) === key);
    if (protectedRow) return same;
    if (held.used.has(action.id) && Number.parseFloat(action.recast) > 5 && !same) return false;
    const ready = readiness.get(key);
    if (ready && !(Number(held[ready]) > 0)) return false;
    const combo = action.description?.match(/Combo Action: ([^\n]+)/)?.[1];
    if (combo && !comboReady(action) && !(job.id === 'SAM' && held.meikyo)) return false;
    const follows = action.description?.match(/Can only be executed after (?:successfully landing )?([^\.\n]+)/)?.[1];
    const parents = follows?.split(/,?\s+or\s+|,\s*/).map(name => name.replace(/ as (?:a )?combo action.*$/i, '').trim()).filter(name => job.actions.some(action => normalize(action.name) === normalize(name)));
    if (parents?.length && !parents.some(previousMatches)) return false;
    const startsCombo = candidates.some(item => item.step.action.description?.match(/Combo Action: ([^\n]+)/)?.[1]?.split(/ or /).some(parent => normalize(comboFamily(parent)) === normalize(comboFamily(name))));
    if (!same && !combo && hasCombo && startsCombo) return false;
    if (job.id === 'PCT') {
      const color = ['Fire|Blizzard', 'Aero|Stone', 'Water|Thunder'].findIndex(pattern => new RegExp(`^(${pattern}) (II in|in) `).test(name));
      const colors = pictomancerColors(job.actions, level, targetCount(mode, rotation.state));
      const stageLocked = !colors[held.hue];
      if (color >= 0) return (color === held.hue || color === 0 && stageLocked) && /Blizzard|Stone|Thunder/.test(name) === (held.subtractive > 0);
      if (is('Holy in White')) return held.whitePaint > 0 && !held.monochrome;
      if (is('Comet in Black')) return held.blackPaint > 0 && held.monochrome;
      if (is('Hammer Stamp|Hammer Brush|Polishing Hammer')) return held.hammer > 0 && (level < 86 || ['Hammer Stamp', 'Hammer Brush', 'Polishing Hammer'][held.hammerStep] === name);
      if (is('Rainbow Drip')) return held.rainbow > 0 || same && current.entry;
      if (/Motif/.test(name)) return same;
    }
    if (job.id === 'PLD' && is('Holy Spirit|Holy Circle')) return held.divine > 0 || held.magic > 0 || same;
    if (job.id === 'WAR' && is('Inner Beast|Fell Cleave|Steel Cyclone|Decimate|Inner Chaos|Chaotic Cyclone')) return (held.beast >= 50 || held.release > 0) && (!held.chaos || is('Inner Chaos|Chaotic Cyclone'));
    if (job.id === 'DRK' && is('Bloodspiller|Quietus')) return !(held.delirium > 0 && level >= 96) && (held.blood >= 50 || held.delirium > 0);
    if (job.id === 'GNB' && is('Double Down|Gnashing Fang|Burst Strike|Fated Circle')) return held.cartridges >= (is('Double Down') ? 2 : 1);
    if (job.id === 'SGE') { if (/^Eukrasian /.test(name)) return Boolean(held.eukrasia); if (/^(Dosis|Dyskrasia)/.test(name) && held.eukrasia) return false; if (is('Eukrasia')) return same; }
    if (job.id === 'MNK') {
      const form = /^(Bootshine|Leaping Opo|Dragon Kick|Arm of the Destroyer|Shadow of the Destroyer)$/.test(name) ? 'opo' : /^(True Strike|Rising Raptor|Twin Snakes|Four-point Fury)$/.test(name) ? 'raptor' : /^(Snap Punch|Pouncing Coeurl|Demolish|Rockbreaker)$/.test(name) ? 'coeurl' : '';
      if (form) return held.balance > 0 || form === held.form || form === 'opo' && !pickAction(job.actions, held.form === 'raptor' ? 'True Strike' : 'Snap Punch', level);
      if (/Elixir|Flint Strike|Rising Phoenix|Tornado Kick|Phantom Rush|Celestial Revolution/.test(name)) return held.blitz;
    }
    if (job.id === 'NIN' && /Mudra Combination:/.test(action.description)) return same;
    if (job.id === 'SAM') {
      const sen = Number(Boolean(held.setsu)) + Number(Boolean(held.getsu)) + Number(Boolean(held.ka));
      if (level >= 80 && held.meditation >= 3 && is('Higanbana|Tenka Goken|Tendo Goken|Midare Setsugekka|Tendo Setsugekka|Ogi Namikiri')) return false;
      if (is('Higanbana')) return sen === 1;
      if (is('Tenka Goken|Tendo Goken')) return sen === 2 && (!is('Tendo Goken') || held.tendo);
      if (is('Midare Setsugekka|Tendo Setsugekka')) return sen === 3 && (!is('Tendo Setsugekka') || held.tendo);
      if (/^Kaeshi:|^Tendo Kaeshi/.test(name)) return same;
      if (is('Gekko|Mangetsu') && held.getsu || is('Kasha|Oka') && held.ka || is('Yukikaze') && held.setsu) return false;
    }
    if (job.id === 'RPR' && /Gibbet|Gallows|Guillotine|Reaping|Communio/.test(name)) return false;
    if (job.id === 'VPR') { if (is('Reawaken')) return held.freeReawaken > 0 || held.offering >= 50; if (/Generation|Ouroboros/.test(name)) return false; if (is('Uncoiled Fury')) return held.coils > 0; }
    if (job.id === 'BRD') { if (is('Straight Shot|Refulgent Arrow|Wide Volley|Shadowbite')) return held.hawk > 0 || held.proc && !held.used.has(action.id); if (is('Apex Arrow')) return held.voice >= 80; }
    if (job.id === 'MCH' && is('Heat Blast|Blazing Shot|Auto Crossbow')) return held.overheat > 0;
    if (job.id === 'DNC') { if (is('Standard Finish|Technical Finish')) return same; if (is('Saber Dance|Dance of the Dawn')) return held.esprit >= 50 && (level < 100 || !held.dawn || is('Dance of the Dawn')); }
    if (job.id === 'SMN') { if (/^(Ruby|Topaz|Emerald) (Ruin|Rite|Outburst|Disaster|Catastrophe)/.test(name)) return held.attunementLeft > 0 && name.toLowerCase().startsWith(held.attunement); if (/Astral|Umbral|Fountain of Fire|Brand of Purgatory|Crimson|Slipstream/.test(name)) return same; if (row.id === 'primal') return same; }
    if (job.id === 'RDM') {
      if (held.grandImpact > 0 && is('Jolt III|Impact')) return false;
      if (/^Enchanted /.test(name)) return (held.swordplay > 0 || held.mana >= 20) && !held.dualcast;
      if (is('Verflare|Verholy|Scorch|Resolution')) return same;
      if (/^(Verthunder|Veraero)( III)?$|^(Scatter|Impact)$/.test(name)) return held.dualcast || held.acceleration > 0 || same && (name === 'Scatter' && level < 18 || !Number.parseFloat(current.action.cast));
      if (held.dualcast && /^(Jolt|Verfire|Verstone|Verthunder II|Veraero II)/.test(name)) return false;
    }
    if (job.id === 'BST' && /^(Avalanche|Mistral|Spinning|Gale) Axe$/.test(name)) return held.tp > 0 && !held.used.has(action.id);
    if (job.id === 'BLU' && is('Ultravibration')) return Boolean(held.freeze);
    if (!same && !ready && /Can only be executed|Cannot be executed|Motif|Make the ritual|Bristle|Moon Flute/.test(action.description + name)) return false;
    return true;
  };
  const seen = new Set();
  const options = candidates.filter(available).flatMap(({ step }) => {
    if (seen.has(step.action.id)) return [];
    seen.add(step.action.id);
    const combo = step.action.description?.match(/Combo Action: ([^\n]+)/)?.[1];
    const condition = step.action.id === current.action.id ? 'Shown at this point in the row' : combo ? `Continue after ${held.previous}` : 'Ready with the resources at this point';
    return [{ action: step.action, condition, example: Boolean(step.example) }];
  });
  options.sort((a, b) => Number(b.action.id === current.action.id) - Number(a.action.id === current.action.id));
  return options.length ? [{ id: targetRow.id, title: targetRow.title, reason: targetRow.reason, options }] : [];
}

export function showWeaveAttacks(job, level, mode, rotation) {
  if (rotation.presentation === 'sequence') return rotation.rows;
  const { state, rows } = rotation;
  const find = id => rows.find(row => row.id === id);
  const stepFor = (names, note = '') => {
    const action = pickAction(job.actions, names, level);
    return action ? { action, name: action.name, count: 1, note } : null;
  };
  let source = find('filler') || find('combo') || find('forms') || find('sen');
  let attacks = source?.steps.filter(step => step.action.category !== 'Ability') || [];
  if (job.id === 'MCH' && state.heatPlan === 'wildfire') {
    const start = attacks.findIndex(step => /^(Heated )?Split Shot$/.test(step.action.name));
    if (start >= 0) attacks = [...attacks.slice(start), ...attacks.slice(0, start)];
  }
  if (job.id === 'SMN' && ['ruby', 'topaz', 'emerald', 'demi'].includes(state.phase)) source = find(state.phase === 'demi' ? 'demi' : 'attunement');
  if (job.id === 'SMN') attacks = source?.steps.filter(step => step.action.category === 'Spell') || attacks;
  if (job.id === 'PCT') {
    const colors = (mode === 'aoe' && level >= 25 ? ['Fire II in Red', 'Aero II in Green', 'Water II in Blue'] : ['Fire in Red', 'Aero in Green', 'Water in Blue']).map(name => stepFor(name)).filter(Boolean);
    const hue = ({ none: 0, one: 1, two: 2 })[state.hues] || 0;
    attacks = colors.map((_, index) => colors[(index + hue) % colors.length]);
  }
  if (job.id === 'SAM' && !attacks.length) attacks = [stepFor('Hakaze|Gyofu')].filter(Boolean);
  if (job.id === 'MNK' && state.blitz !== 'none' && find('blitz')) attacks = [...find('blitz').steps, ...attacks];
  attacks = attacks.flatMap(step => Array.from({ length: step.count }, () => ({ ...step, count: 1 })));
  if (!attacks.length) return rows;
  let cursor = 0, slots = 0, used = 0, impact = Boolean(state.impact);
  const fast = /^(Heat Blast|Blazing Shot|Auto Crossbow|Emerald (Ruin|Rite|Outburst|Disaster|Catastrophe)|Void Reaping|Cross Reaping|Grim Reaping|Standard Step|Technical Step|Standard Finish|Technical Finish|Enchanted Riposte|Enchanted Zwerchhau|Enchanted Moulinet)/;
  const rendered = [];
  let active;
  const exampleState = () => {
    const probe = { ...attacks[0], count: 1, example: true };
    const row = { ...active, steps: [...active.steps, probe] };
    return gcdSlotState(job, level, rotation, [...rendered, row], row, row.steps.length - 1);
  };
  const nextAttack = () => {
    let step = attacks[cursor % attacks.length];
    if (job.id === 'MNK') {
      const held = exampleState();
      const form = held.form || 'opo';
      const patterns = { opo: /^(Bootshine|Leaping Opo|Dragon Kick|Arm of the Destroyer|Shadow of the Destroyer)$/, raptor: /^(True Strike|Rising Raptor|Twin Snakes|Four-point Fury)$/, coeurl: /^(Snap Punch|Pouncing Coeurl|Demolish|Rockbreaker)$/ };
      step = attacks.find(item => patterns[form].test(item.action.name)) || stepFor(({ opo: 'Bootshine|Leaping Opo', raptor: 'True Strike|Rising Raptor', coeurl: 'Snap Punch|Pouncing Coeurl' })[form]);
    }
    if (job.id === 'PCT') {
      const held = exampleState();
      const colors = pictomancerColors(job.actions, level, targetCount(mode, state), held.subtractive > 0);
      step = stepFor(colors[held.hue] || colors[0]);
    }
    if (job.id === 'MCH' && attacks.some(item => /^(Heated )?Split Shot$/.test(item.action.name))) {
      const held = exampleState();
      step = stepFor(/^(Heated )?Split Shot$/.test(held.previous) ? 'Slug Shot|Heated Slug Shot' : /^(Heated )?Slug Shot$/.test(held.previous) ? 'Clean Shot|Heated Clean Shot' : 'Split Shot|Heated Split Shot') || step;
    }
    if (job.id === 'SAM') {
      const held = exampleState();
      const parent = step.action.description?.match(/Combo Action: ([^\n]+)/)?.[1];
      if (cursor >= attacks.length || parent && !held.meikyo && normalize(comboFamily(parent)) !== normalize(comboFamily(held.previous))) step = stepFor('Hakaze|Gyofu') || step;
    }
    if (job.id === 'SMN' && cursor >= attacks.length && ['ruby', 'topaz', 'emerald'].includes(state.phase)) step = stepFor(mode === 'aoe' ? 'Outburst|Tri-disaster|Ruin' : 'Ruin|Ruin II|Ruin III') || step;
    if (job.id === 'RDM') {
      const held = exampleState();
      const pack = mode === 'aoe' && targetCount(mode, state) >= 3 && pickAction(job.actions, 'Scatter', level);
      const long = pack ? 'Scatter|Impact' : state.mana === 'white' ? 'Veraero|Veraero III' : 'Verthunder|Verthunder III';
      const short = pack ? state.mana === 'white' && level >= 22 ? 'Veraero II' : level >= 18 ? 'Verthunder II' : 'Scatter' : held.verfire > 0 ? 'Verfire' : held.verstone > 0 ? 'Verstone' : 'Jolt|Jolt II|Jolt III|Riposte';
      step = held.dualcast || held.acceleration > 0 ? stepFor(long, held.acceleration > 0 ? 'Instant · Acceleration' : 'Instant · Dualcast') || step : stepFor(short) || step;
      if (held.grandImpact > 0 && ['Jolt III', 'Impact'].includes(step.action.name)) step = stepFor('Grand Impact', 'Instant · preserves Dualcast');
    }
    if (job.id === 'DRG' && cursor >= attacks.length && /^(True|Raiden) Thrust$/.test(step.action.name) && attacks.some(item => item.action.name === 'Drakesbane')) step = stepFor('Raiden Thrust') || step;
    if (job.id === 'DRG' && cursor >= attacks.length && step.action.name === 'Doom Spike' && attacks.some(item => item.action.name === 'Coerthan Torment')) step = stepFor('Draconian Fury') || step;
    cursor++;
    return { ...step, example: true, note: [step.note, 'GCD example'].filter(Boolean).join(' · ') };
  };
  const capacity = step => {
    if (/Instant|Dualcast|Triplecast/.test(step.note) || step.action.cast === 'Instant' || step.action.category === 'Weaponskill' && !step.action.cast) return fast.test(step.action.name) || /1\.5s|single weave/i.test(step.note) ? 1 : 2;
    return Number.parseFloat(step.action.cast) <= 1.5 ? 1 : 0;
  };
  const excluded = row => ['setup', 'prepull', 'flamethrower'].includes(row.id) || job.id === 'BST' && row.id === 'summon' || job.id === 'NIN' && ['suiton', 'kassatsu', 'mudra', 'tenchijin'].includes(row.id);
  for (const row of rows) {
    if (excluded(row)) {
      for (const step of row.steps) if (step.entry || /Precast to start combat/.test(step.note)) {
        slots = capacity(step); used = 0;
        if (step.action.id === attacks[0].action.id) cursor++;
      }
      rendered.push(row);
      continue;
    }
    const steps = [];
    active = { ...row, steps };
    let illustrated = false;
    for (const planned of row.steps) {
      let step = planned;
      if (job.id === 'PCT' && /^(Fire|Aero|Water|Blizzard|Stone|Thunder) (II in|in) /.test(step.action.name)) {
        const held = exampleState();
        const colors = pictomancerColors(job.actions, level, targetCount(mode, state), held.subtractive > 0);
        const action = pickAction(job.actions, colors[held.hue] || colors[0], level);
        if (action) step = { ...step, action, name: action.name };
      }
      if (job.id === 'MNK' && ['forms', 'balance'].includes(row.id) && /^(Bootshine|Leaping Opo|Dragon Kick|Arm of the Destroyer|Shadow of the Destroyer|True Strike|Rising Raptor|Twin Snakes|Four-point Fury|Snap Punch|Pouncing Coeurl|Demolish|Rockbreaker)$/.test(step.action.name)) {
        const held = exampleState();
        if (!(held.balance > 0)) {
          const form = held.form || 'opo';
          const patterns = { opo: /^(Bootshine|Leaping Opo|Dragon Kick|Arm of the Destroyer|Shadow of the Destroyer)$/, raptor: /^(True Strike|Rising Raptor|Twin Snakes|Four-point Fury)$/, coeurl: /^(Snap Punch|Pouncing Coeurl|Demolish|Rockbreaker)$/ };
          const candidate = attacks.find(item => patterns[form].test(item.action.name)) || stepFor(({ opo: 'Bootshine|Leaping Opo', raptor: 'True Strike|Rising Raptor', coeurl: 'Snap Punch|Pouncing Coeurl' })[form]);
          if (candidate) step = { ...step, action: candidate.action, name: candidate.action.name };
        }
      }
      const weave = !step.entry && (row.type === 'weave' || step.action.category === 'Ability');
      if (!weave) {
        steps.push(step);
        if (job.id === 'RDM' && step.action.name === 'Grand Impact') impact = false;
        if (job.id === 'MCH') {
          const next = attacks.findIndex(attack => attack.action.id === step.action.id);
          if (next >= 0) cursor = next + step.count;
        }
        slots = capacity(step); used = 0;
        continue;
      }
      const hidden = job.id === 'NIN' && row.id === 'buffs' && state.burst === 'prepared' && /^(Trick Attack|Kunai[’']s Bane)$/.test(step.action.name);
      const exclusive = step.action.name === 'Stardiver' || /single weave|long animation/i.test(step.note);
      for (let cast = 0; cast < step.count; cast++) {
        if (job.id === 'MNK' && step.action.name === 'Perfect Balance') {
          while (!/^(Bootshine|Leaping Opo|Dragon Kick|Arm of the Destroyer|Shadow of the Destroyer)$/.test(exampleState().previous)) {
            const attack = nextAttack();
            steps.push(attack); slots = capacity(attack); used = 0; illustrated = true;
          }
        }
        const hypercharge = step.action.name === 'Hypercharge' && state.heatPlan === 'wildfire';
        if (!hidden && !(job.id === 'PCT' && exampleState().subtractive > 0) && (used >= slots || exclusive && used > 0 || hypercharge && slots - used < 2 || step.action.name === 'Stellar Detonation')) {
          let attack = nextAttack();
          steps.push(attack);
          if (job.id === 'RDM' && capacity(attack) === 0 && pickAction(job.actions, 'Jolt', level)) {
            attack = nextAttack();
            steps.push(attack);
          }
          if (job.id === 'SMN' && state.phase === 'ruby') while (capacity(attack) === 0 && cursor < attacks.length) {
            attack = nextAttack();
            steps.push(attack);
          }
          if (step.action.name === 'Stellar Detonation') attack.note += ' · repeat until the star has grown for at least 10s';
          slots = capacity(attack); used = 0;
          illustrated = true;
        }
        const clip = !hidden && (slots === 0 || used >= slots);
        steps.push({ ...step, count: 1, ...(clip ? { note: [step.note, 'Weave · clips without an available slot'].filter(Boolean).join(' · ') } : {}) });
        used = exclusive ? Math.max(1, slots) : used + 1;
      }
    }
    rendered.push(illustrated ? { ...row, steps, weaveExample: true } : { ...row, steps });
  }
  return rendered;
}

const rowGroups = {
  PLD: [['Damage window', 'buffs', 'divine-first', 'magic', 'goring'], ['Granted follow-ups', 'atonement', 'divine']],
  WAR: [['Inner Release window', 'buffs', 'release', 'rend']],
  DRK: [['Damage window', 'buffs', 'disesteem', 'delirium'], ['Resource spending', 'blood', 'mp']],
  GNB: [['Prepare the damage window', 'bloodfest', 'buffs', 'double'], ['Granted combos and cartridges', 'reign', 'sonic', 'gnashing', 'cartridge']],
  WHM: [['Damage cooldowns and lilies', 'buffs', 'sight', 'misery']],
  SCH: [['Damage abilities', 'buffs', 'impact', 'energy']],
  AST: [['Buffs and held cards', 'buffs', 'oracle', 'card', 'lord']],
  SGE: [['Damage cooldowns and movement', 'buffs', 'phlegma', 'pneuma', 'toxikon']],
  MNK: [['Damage buffs and Chakra', 'buffs', 'wind', 'chakra', 'wind-reply']],
  DRG: [['Jumps and Life of the Dragon', 'buffs', 'life']],
  NIN: [['Prepare and use burst', 'raid', 'suiton', 'buffs', 'bunshin'], ['Ninjutsu and gauge', 'kassatsu', 'mudra', 'ninki']],
  SAM: [['Ready finishers and Kenki', 'ogi', 'kenki', 'iaijutsu']],
  RPR: [['Prepare burst', 'buffs', 'perfectio'], ['Soul spenders', 'gluttony', 'slice']],
  VPR: [['Reawaken windows', 'buffs', 'reawaken-free', 'reawaken'], ['Twinblade attacks and coils', 'vice', 'coils']],
  BRD: [['Song cycle', 'pitch', 'song'], ['Damage buffs and their follow-ups', 'buffs', 'proc-before-barrage', 'barrage', 'finale', 'shots'], ['Gauge and held procs', 'voice', 'proc']],
  MCH: [['Battery and ready tools', 'battery', 'reassemble', 'tools', 'metal']],
  DNC: [['Dance window and follow-ups', 'technical', 'technical-follow', 'standard-follow', 'finish', 'standard'], ['Gauge and procs', 'esprit', 'fan3', 'feather', 'flow', 'symmetry']],
  SMN: [['Damage abilities', 'buffs', 'aether'], ['Summon phase', 'summon', 'demi', 'attunement', 'primal']],
  RDM: [['Prepare burst', 'buffs', 'dualcast', 'manafication'], ['Melee and ready spells', 'melee', 'impact']],
  PCT: [['Muses and granted spells', 'buffs', 'muse', 'prism', 'rainbow'], ['Paint spending', 'black', 'white', 'palette']],
  BLU: [['Selected spell setup', 'moon', 'freeze', 'dot']],
  BST: [['Familiar and instinctual skill', 'summon', 'instinct']],
};

export function groupRotation(jobId, rows) {
  const groups = [];
  for (const row of rows) {
    const definition = rowGroups[jobId]?.find(([, ...ids]) => ids.includes(row.id));
    const key = definition?.[0] || row.id;
    const previous = groups.at(-1);
    const section = { ...row, repeat: 1, sourceRows: [row] };
    for (let size = 1; size <= row.steps.length / 2; size++) {
      if (row.steps.length % size || !row.steps.every((step, i) => step.action.id === row.steps[i % size].action.id && step.count === row.steps[i % size].count && step.note === row.steps[i % size].note)) continue;
      section.steps = row.steps.slice(0, size);
      section.repeat = row.steps.length / size;
      section.repeatNote = `Repeat this complete sequence ${section.repeat} times. ${row.reason}`;
      break;
    }
    if (previous?.key === key) {
      const last = previous.sections.at(-1);
      if (jobId === 'VPR' && last.id === 'reawaken-free' && row.id === 'reawaken') {
        last.repeat = 2;
        last.title = 'Use the free entry, then the gauge-paid entry';
        last.repeatNote = 'Repeat the complete combo twice: first entry is free; the second spends a separate 50 Offering.';
        last.steps = last.steps.map((step, i) => i ? step : { ...step, note: 'Free, then 50 Offering' });
        last.sourceRows.push(row);
      } else previous.sections.push(section);
    } else groups.push({ key, title: definition?.[0] || row.title, sections: [section] });
  }
  return groups;
}
