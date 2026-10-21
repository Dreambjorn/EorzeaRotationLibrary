import test from 'node:test';
import assert from 'node:assert/strict';
import { JOBS, pictomancerColors } from '../lib/catalog.mjs';
import { buildRotation } from '../lib/planner.mjs';
import { showWeaveAttacks, annotateCastSupport, gcdOptions, isGcdAttack } from '../lib/presentation.mjs';

function fixture(id, definitions) {
  const base = JOBS.find(job => job.id === id);
  const actions = definitions.map(([name, level = 1, category = 'Weaponskill', description = '', cast = 'Instant'], index) => ({
    id: id + '-' + index, name, level, category, description, cast, recast: category === 'Ability' ? '60s' : '2.5s',
  }));
  return { ...base, actions };
}
const monk = fixture('MNK', [
  ['Bootshine'], ['True Strike', 4], ['Snap Punch', 6], ['Dragon Kick', 50], ['Twin Snakes', 18], ['Demolish', 30],
  ['Arm of the Destroyer', 26], ['Four-point Fury', 45], ['Rockbreaker', 30],
  ['Form Shift', 52], ['Steeled Meditation', 15, 'Ability'], ['Steel Peak', 15, 'Ability'],
  ['Howling Fist', 40, 'Ability', 'Can only be executed while in combat.'], ['The Forbidden Chakra', 54, 'Ability', 'Can only be executed while in combat.'], ['Enlightenment', 74, 'Ability'],
  ['Perfect Balance', 50, 'Ability'], ['Elixir Field', 60], ['Flint Strike', 60], ['Tornado Kick', 60],
  ['Riddle of Fire', 68, 'Ability'], ['Brotherhood', 70, 'Ability'],
  ["Fire's Reply", 100, 'Weaponskill', 'Can only be executed while Fire Rumination is active.'],
]);
const painter = fixture('PCT', [
  ...[['Fire in Red', 1], ['Aero in Green', 5], ['Water in Blue', 15], ['Fire II in Red', 25], ['Aero II in Green', 35], ['Water II in Blue', 45]].map(([name, level]) => [name, level, 'Spell', '', '1.5s']),
  ...['Blizzard in Cyan', 'Stone in Yellow', 'Thunder in Magenta', 'Blizzard II in Cyan', 'Stone II in Yellow', 'Thunder II in Magenta'].map(name => [name, 60, 'Spell', '', '2.3s']),
  ['Subtractive Palette', 60, 'Ability'], ['Swiftcast', 18, 'Ability'], ['Starry Muse', 70, 'Ability'],
  ['Pom Motif', 30, 'Spell'], ['Hammer Motif', 50, 'Spell'], ['Starry Sky Motif', 70, 'Spell'],
  ['Holy in White', 80, 'Spell'], ['Comet in Black', 90, 'Spell'],
]);
const reaper = fixture('RPR', [
  ...['Slice', 'Waxing Slice', 'Infernal Slice', 'Spinning Scythe', 'Nightmare Scythe', 'Gibbet', 'Gallows', 'Guillotine', 'Executioner’s Gibbet', 'Executioner’s Gallows', 'Executioner’s Guillotine', 'Shadow of Death', 'Whorl of Death', 'Plentiful Harvest', 'Void Reaping', 'Cross Reaping', 'Grim Reaping', 'Communio', 'Perfectio'].map(name => [name, name === 'Perfectio' ? 100 : 70]),
  ...['Blood Stalk', 'Grim Swathe', 'Unveiled Gibbet', 'Unveiled Gallows', 'Gluttony', 'Arcane Circle', 'Enshroud', 'Sacrificium'].map(name => [name, 70, 'Ability']),
]);
const actions = rotation => rotation.rows.flatMap(row => row.steps.map(step => step.action.name));
const names = (rotation, id) => rotation.rows.find(row => row.id === id)?.steps.map(step => step.action.name) || [];

function legalSlots(job, level, mode, input) {
  const rotation = buildRotation(job, level, mode, input);
  const rows = annotateCastSupport(showWeaveAttacks(job, level, mode, rotation), level);
  for (const row of rows) for (let index = 0; index < row.steps.length; index++) {
    const step = row.steps[index];
    if (!isGcdAttack(step.action) || row.type === 'weave' && !step.example && !step.entry) continue;
    const options = gcdOptions(job, level, mode, rotation, rows, { row: row.id, index }).flatMap(group => group.options);
    assert.ok(options.some(option => option.action.id === step.action.id), row.id + ': ' + step.action.name);
  }
  if (job.id === 'MNK') {
    let form = rotation.state.form === 'none' ? 'opo' : rotation.state.form, balance = 0;
    for (const step of rows.flatMap(row => row.steps)) {
      const name = step.action.name;
      if (name === 'Perfect Balance') balance = 3;
      if (/^(Elixir Field|Flint Strike|Tornado Kick|Fire's Reply|Form Shift)$/.test(name)) form = 'opo';
      const current = /^(Bootshine|Leaping Opo|Dragon Kick|Arm of the Destroyer|Shadow of the Destroyer)$/.test(name) ? 'opo' : /^(True Strike|Twin Snakes|Four-point Fury)$/.test(name) ? 'raptor' : /^(Snap Punch|Demolish|Rockbreaker)$/.test(name) ? 'coeurl' : '';
      if (!current) continue;
      if (current !== 'opo' && !balance) assert.equal(current, form, 'Every rendered form action must follow its prerequisite.');
      if (balance) balance--;
      form = { opo: 'raptor', raptor: 'coeurl', coeurl: 'opo' }[current];
    }
  }
  return rows;
}

test('Monk examples cannot use a reply before its granting cooldown', () => {
  const rows = legalSlots(monk, 100, 'single', { buffs: true });
  const sequence = rows.flatMap(row => row.steps.map(step => step.action.name));
  assert.ok(sequence.indexOf('Riddle of Fire') < sequence.indexOf("Fire's Reply"));
  assert.notEqual(sequence[0], "Fire's Reply");
});
for (const level of [50, 60, 68, 100]) test('Perfect Balance generates legal form actions at level ' + level, () => {
  for (const mode of ['single', 'aoe']) for (const form of ['none', 'opo', 'raptor', 'coeurl']) {
    legalSlots(monk, level, mode, { balance: true, buffs: true, form, pull: true, chakra: true });
  }
});
for (const level of [60, 70, 79]) test('Pictomancer examples respect Subtractive Palette at level ' + level, () => {
  for (const mode of ['single', 'aoe']) {
    const rows = legalSlots(painter, level, mode, { pull: true, prepared: true, palette: true, moving: true });
    let hue = 0, remaining = 0, casts = 0;
    for (const step of rows.flatMap(row => row.steps)) {
      if (step.action.name === 'Subtractive Palette') remaining = 3;
      const color = ['Fire|Blizzard', 'Aero|Stone', 'Water|Thunder'].findIndex(pattern => new RegExp('^(' + pattern + ') (II in|in) ').test(step.action.name));
      if (color < 0) continue;
      assert.equal(color, hue, 'Rendered color stage must follow every preceding cast.');
      assert.equal(/^(Blizzard|Stone|Thunder)/.test(step.action.name), remaining > 0);
      if (remaining) { remaining--; casts++; }
      hue = (hue + 1) % 3;
    }
    assert.equal(casts, 3, 'A funded Palette includes exactly three transformed casts.');
  }
});
test('Dragoon accepts the qualified Fang and Claw parent of Drakesbane', () => {
  const job = fixture('DRG', [['True Thrust'], ['Vorpal Thrust', 4, 'Weaponskill', 'Combo Action: True Thrust'],
    ['Full Thrust', 26, 'Weaponskill', 'Combo Action: Vorpal Thrust'], ['Fang and Claw', 56, 'Weaponskill', 'Can only be executed after successfully landing Full Thrust.'],
    ['Drakesbane', 64, 'Weaponskill', 'Combo Action: Wheeling Thrust or Fang and Claw\nCan only be executed after successfully landing Wheeling Thrust or Fang and Claw as a combo action.'],
    ['Wheeling Thrust', 58]]);
  legalSlots(job, 100, 'single', { refresh: false });
});
test('Reaper keeps the enhanced positional and single-target filler at three targets', () => {
  const rotation = buildRotation(reaper, 100, 'aoe', { targets: '3', reaver: 'gibbet', design: false });
  assert.deepEqual(names(rotation, 'reaver'), ['Gibbet']);
  assert.deepEqual(names(rotation, 'filler'), ['Slice', 'Waxing Slice', 'Infernal Slice']);
  assert.ok(!rotation.controls.find(control => control.key === 'targets').disabled);
});
test('Reaper selects Grim Swathe at three only without an enhancement', () => {
  assert.equal(names(buildRotation(reaper, 100, 'aoe', { soulUse: 'spend', targets: '3' }), 'soul')[0], 'Grim Swathe');
  assert.equal(names(buildRotation(reaper, 100, 'aoe', { soulUse: 'spend', targets: '3', avatar: 'gibbet' }), 'soul')[0], 'Unveiled Gibbet');
  assert.equal(names(buildRotation(reaper, 100, 'aoe', { soulUse: 'spend', targets: '4', avatar: 'gibbet' }), 'soul')[0], 'Grim Swathe');
});
test('Reaper starts Gluttony on the enhancement resulting from the held Reaver', () => {
  const rotation = buildRotation(reaper, 100, 'aoe', { soulUse: 'gluttony', targets: '3', reaver: 'gibbet' });
  assert.deepEqual(names(rotation, 'gluttony'), ['Gluttony', 'Executioner’s Gallows', 'Executioner’s Gibbet']);
});
test('Reaper generates Ideal Host instead of assuming Plentiful Harvest was used', () => {
  const rotation = buildRotation(reaper, 100, 'single', { shroud: 'prepare', design: false });
  const sequence = actions(rotation);
  assert.ok(sequence.indexOf('Plentiful Harvest') < sequence.indexOf('Enshroud'));
  assert.ok(sequence.indexOf('Communio') < sequence.indexOf('Perfectio'));
  legalSlots(reaper, 100, 'single', { shroud: 'prepare', design: false });
});
for (const [level, targets, expected] of [[50, 2, 'Howling Fist'], [60, 3, 'The Forbidden Chakra'], [60, 4, 'Howling Fist'], [74, 3, 'Enlightenment']]) test('Chakra threshold: ' + level + ' / ' + targets, () => {
  assert.equal(names(buildRotation(monk, level, 'aoe', { targets: String(targets), chakra: true, pull: false }), 'chakra')[0], expected);
});
test('Pictomancer uses the mixed synced color sequence and red spam', () => {
  assert.deepEqual(pictomancerColors(painter.actions, 30, 3), ['Fire II in Red', 'Aero in Green', 'Water in Blue']);
  assert.deepEqual(pictomancerColors(painter.actions, 30, 4), ['Fire II in Red']);
  assert.deepEqual(pictomancerColors(painter.actions, 60, 3), ['Fire in Red', 'Aero in Green', 'Water II in Blue']);
});
test('Assize and Earthly Star remain usable without their longer buff cooldown', () => {
  const whm = fixture('WHM', [['Stone', 1, 'Spell'], ['Assize', 56, 'Ability'], ['Presence of Mind', 30, 'Ability']]);
  const ast = fixture('AST', [['Malefic', 1, 'Spell'], ['Earthly Star', 62, 'Ability'], ['Stellar Detonation', 62, 'Ability'], ['Divination', 50, 'Ability']]);
  assert.ok(actions(buildRotation(whm, 100, 'single', { assize: true })).includes('Assize'));
  assert.ok(!actions(buildRotation(whm, 100, 'single', { assize: true })).includes('Presence of Mind'));
  assert.ok(actions(buildRotation(ast, 100, 'single', { star: true })).includes('Earthly Star'));
  assert.ok(!actions(buildRotation(ast, 100, 'single', { star: true })).includes('Divination'));
});
test('Pack DoTs require surviving targets and stop before losing to filler', () => {
  const scholar = fixture('SCH', [['Bio', 2, 'Spell'], ['Biolysis', 72, 'Spell'], ['Art of War', 46, 'Spell'], ['Ruin', 1, 'Spell']]);
  assert.deepEqual(names(buildRotation(scholar, 100, 'aoe', { targets: '2', lifetime: '15' }), 'dot'), ['Biolysis']);
  assert.equal(buildRotation(scholar, 100, 'aoe', { targets: '2' }).rows.some(row => row.id === 'dot'), false);
  assert.equal(buildRotation(scholar, 100, 'aoe', { targets: '5', lifetime: '60' }).rows.some(row => row.id === 'dot'), false);
});
test('Ordinary jobs expose both reference publishers and a separate rules review', () => {
  const job = { ...monk, guides: [...monk.guides, { type: 'icy-rotation', publisher: 'Icy Veins', url: 'https://www.icy-veins.com/ffxiv/monk-pve-dps-rotation-openers-abilities', patch: '7.55' }] };
  const rotation = buildRotation(job, 100, 'single');
  assert.deepEqual(rotation.references.map(reference => reference.publisher), ['The Balance', 'Icy Veins', 'Official action requirements']);
  assert.equal(rotation.rulesReviewedAt, '2026-10-20');
});
test('Machinist resumes a legal combo after Reassemble used an AoE weaponskill', () => {
  const job = fixture('MCH', [
    ['Split Shot'], ['Slug Shot', 2, 'Weaponskill', 'Combo Action: Split Shot'],
    ['Clean Shot', 26, 'Weaponskill', 'Combo Action: Slug Shot'], ['Spread Shot', 18],
    ['Hot Shot', 4], ['Heat Blast', 35], ['Auto Crossbow', 52],
    ['Gauss Round', 15, 'Ability'], ['Ricochet', 50, 'Ability'],
    ['Hypercharge', 30, 'Ability'], ['Wildfire', 45, 'Ability'], ['Reassemble', 10, 'Ability'],
  ]);
  for (const level of [45, 50, 59]) for (const heatPlan of ['normal', 'wildfire']) {
    legalSlots(job, level, 'aoe', { heatPlan, reassemble: true, shots: true, tools: true, targets: '3' });
  }
});
test('Acceleration uses Grand Impact before its transformed Impact button', () => {
  const job = fixture('RDM', [
    ['Jolt', 2, 'Spell', '', '2s'], ['Jolt III', 84, 'Spell', '', '2s'],
    ['Verthunder', 4, 'Spell', '', '5s'], ['Veraero', 10, 'Spell', '', '5s'],
    ['Verfire', 26, 'Spell', '', '2s'], ['Verstone', 30, 'Spell', '', '2s'],
    ['Verthunder II', 18, 'Spell', '', '2s'], ['Veraero II', 22, 'Spell', '', '2s'],
    ['Scatter', 15, 'Spell', '', '5s'], ['Impact', 66, 'Spell', '', '5s'],
    ['Grand Impact', 96, 'Spell'], ['Acceleration', 50, 'Ability'],
  ]);
  for (const level of [50, 66, 96, 100]) for (const mode of ['single', 'aoe']) legalSlots(job, level, mode, { acceleration: true });
  const sequence = actions(buildRotation(job, 100, 'aoe', { acceleration: true }));
  assert.ok(sequence.indexOf('Grand Impact') < sequence.indexOf('Impact'));
});
test('Gunbreaker separates two-target builders and the Fated Brand breakpoint', () => {
  const job = fixture('GNB', [
    ['Keen Edge'], ['Brutal Shell'], ['Solid Barrel'], ['Demon Slice'], ['Demon Slaughter'],
    ['Burst Strike'], ['Fated Circle', 72], ['Fated Brand', 96, 'Ability'],
    ['Gnashing Fang', 60], ['Savage Claw', 60], ['Wicked Talon', 60],
  ]);
  const pair = buildRotation(job, 100, 'aoe', { targets: '2', cartridges: '1' });
  assert.deepEqual(names(pair, 'filler'), ['Keen Edge', 'Brutal Shell', 'Solid Barrel']);
  assert.equal(names(pair, 'cartridge')[0], 'Fated Circle');
  assert.ok(names(buildRotation(job, 95, 'aoe', { targets: '3', cartridges: '1', gnashing: true }), 'gnashing').length);
  assert.equal(names(buildRotation(job, 100, 'aoe', { targets: '3', cartridges: '1', gnashing: true }), 'gnashing').length, 0);
});
test('Dark Knight keeps single-target spenders with synced two-target builders', () => {
  const job = fixture('DRK', [
    ['Hard Slash'], ['Syphon Strike'], ['Souleater'], ['Unleash'], ['Stalwart Soul', 40],
    ['Bloodspiller', 62], ['Quietus', 64], ['Flood of Darkness', 30, 'Ability'], ['Edge of Darkness', 40, 'Ability'],
  ]);
  const synced = buildRotation(job, 80, 'aoe', { targets: '2', blood: true, mpPlan: 'spend' });
  assert.deepEqual(names(synced, 'filler'), ['Unleash', 'Stalwart Soul']);
  assert.deepEqual(names(synced, 'blood'), ['Bloodspiller']);
  assert.deepEqual(names(synced, 'mp'), ['Edge of Darkness']);
  assert.deepEqual(names(buildRotation(job, 94, 'aoe', { targets: '2' }), 'filler'), ['Hard Slash', 'Syphon Strike', 'Souleater']);
});
test('Dancer cleaves feathers before switching the base combo', () => {
  const job = fixture('DNC', [
    ['Cascade'], ['Fountain'], ['Windmill'], ['Bladeshower'], ['Fan Dance', 30, 'Ability'], ['Fan Dance II', 50, 'Ability'],
    ['Reverse Cascade', 20], ['Rising Windmill', 35], ['Fountainfall', 40], ['Bloodshower', 45],
  ]);
  const rotation = buildRotation(job, 100, 'aoe', { targets: '2', feather: true, symmetry: true, flow: true });
  assert.deepEqual(names(rotation, 'feather'), ['Fan Dance II']);
  assert.deepEqual(names(rotation, 'filler'), ['Cascade', 'Fountain']);
  assert.deepEqual(names(rotation, 'symmetry'), ['Reverse Cascade']);
  assert.deepEqual(names(rotation, 'flow'), ['Fountainfall']);
});
test('Machinist uses coverage for filler while preserving full-splash Hypercharge math', () => {
  const job = fixture('MCH', [
    ['Split Shot'], ['Slug Shot'], ['Clean Shot'], ['Hot Shot', 4], ['Air Anchor', 76], ['Spread Shot', 18], ['Scattergun', 82],
    ['Heat Blast', 35], ['Blazing Shot', 68], ['Auto Crossbow', 52], ['Ricochet', 50, 'Ability'], ['Gauss Round', 15, 'Ability'],
    ['Hypercharge', 30, 'Ability'], ['Drill', 58], ['Bioblaster', 72], ['Chain Saw', 90], ['Excavator', 96],
    ['Reassemble', 10, 'Ability'],
  ]);
  assert.deepEqual(names(buildRotation(job, 100, 'aoe', { targets: '3', cleave: true }), 'filler'), ['Scattergun']);
  assert.deepEqual(names(buildRotation(job, 100, 'aoe', { targets: '3', cleave: false }), 'filler'), ['Split Shot', 'Slug Shot', 'Clean Shot']);
  assert.ok(names(buildRotation(job, 100, 'aoe', { targets: '5', heatPlan: 'normal', cleave: true }), 'heat').includes('Blazing Shot'));
  assert.ok(names(buildRotation(job, 100, 'aoe', { targets: '6', heatPlan: 'normal', cleave: true }), 'heat').includes('Auto Crossbow'));
  assert.ok(!actions(buildRotation(job, 100, 'aoe', { targets: '6', tools: true })).includes('Air Anchor'));
  const readyAnchor = buildRotation(job, 100, 'single', { tools: false, saw: false, anchor: true, reassemble: true });
  assert.equal(names(readyAnchor, 'reassemble').at(-1), 'Air Anchor');
  const heldExcavator = buildRotation(job, 100, 'single', { tools: false, reassemble: true, reassembleTarget: 'excavator' });
  assert.deepEqual(names(heldExcavator, 'reassemble'), ['Reassemble', 'Excavator']);
  assert.ok(!actions(heldExcavator).includes('Chain Saw'));
});
test('Darkside remains selectable for independently ready Shadowbringer', () => {
  const job = fixture('DRK', [['Hard Slash'], ['Flood of Darkness', 30, 'Ability'], ['Shadowbringer', 90, 'Ability']]);
  const rotation = buildRotation(job, 100, 'single', { buffs: false, shadow: true, darkside: true });
  assert.ok(!rotation.controls.find(control => control.key === 'darkside').disabled);
  assert.ok(actions(rotation).includes('Shadowbringer'));
});
