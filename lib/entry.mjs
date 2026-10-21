import { pickAction } from './catalog.mjs';

export const requiresCombat = action => /Can only be executed (?:while )?in combat/i.test(action.description || '');
export const startsCombat = action => /(?:Delivers\b[^.\n]*\b(?:attack|damage)|Deals\b[^.\n]*\bdamage|Increases enmity in target)/i.test(action.description || '');

export function includeCombatEntry(job, rows, controls, state, input, level, mode) {
  let target;
  for (const row of rows) {
    for (let index = 0; index < row.steps.length; index++) {
      const action = row.steps[index].action;
      if (requiresCombat(action)) { target = { row, index }; break; }
      if (startsCombat(action)) return;
    }
    if (target) break;
  }
  if (!target) return;
  const explicitPull = controls.some(control => control.key === 'pull');
  const active = explicitPull ? !state.pull : input.combat === true;
  state.combat = active;
  if (!explicitPull) controls.unshift({ key: 'combat', label: 'Combat already started', type: 'checkbox', value: active, min: 1,
    help: 'Leave unchecked to include an opening attack before abilities that require combat. Check when already fighting.' });
  if (active) return;
  const starter = {
    WAR: 'Heavy Swing', SCH: mode === 'aoe' ? 'Art of War|Art of War II|Ruin' : 'Ruin|Broil|Broil II|Broil III|Broil IV',
    SAM: 'Hakaze|Gyofu', VPR: mode === 'aoe' ? 'Steel Maw|Steel Fangs' : 'Steel Fangs',
    BRD: mode === 'aoe' ? 'Quick Nock|Ladonsbite|Heavy Shot' : 'Heavy Shot|Burst Shot',
    MCH: 'Split Shot|Heated Split Shot', DNC: 'Cascade', SMN: mode === 'aoe' ? 'Outburst|Tri-disaster|Ruin' : 'Ruin|Ruin II|Ruin III',
    RDM: mode === 'aoe' && level >= 15 ? level >= 18 ? state.mana === 'white' && level >= 22 ? 'Veraero II' : 'Verthunder II' : 'Scatter' : 'Jolt|Jolt II|Jolt III|Riposte', PCT: mode === 'aoe' ? 'Fire II in Red|Fire in Red' : 'Fire in Red', BST: 'Smash Axe',
  }[job.id];
  const forms = rows.find(row => row.id === 'forms');
  const monkSource = state.blitz !== 'none' ? rows.find(row => row.id === 'blitz') : state.balance ? rows.find(row => row.id === 'balance') : forms;
  const samuraiSource = job.id === 'SAM' && state.meikyo ? rows.find(row => row.id === 'sen') : null;
  const redMageSource = job.id === 'RDM' && state.impact ? rows.find(row => row.id === 'impact') : null;
  const action = job.id === 'MNK' ? monkSource?.steps[0]?.action : samuraiSource ? samuraiSource.steps[0]?.action : redMageSource ? redMageSource.steps[0]?.action : starter ? pickAction(job.actions, starter, level) : rows.flatMap(row => row.steps).find(step => startsCombat(step.action))?.action;
  if (!action) return;
  const entry = [{ action, name: action.name, count: 1, note: 'Start combat first', entry: true }];
  if (job.id === 'MNK') {
    monkSource.steps.shift();
    if (!monkSource.steps.length) rows.splice(rows.indexOf(monkSource), 1);
  }
  if (samuraiSource) {
    samuraiSource.steps.shift();
    if (!samuraiSource.steps.length) rows.splice(rows.indexOf(samuraiSource), 1);
    entry[0].note = 'Start combat · spend one held Meikyo stack';
  }
  if (job.id === 'RDM') {
    if (redMageSource) {
      redMageSource.steps.shift();
      if (!redMageSource.steps.length) rows.splice(rows.indexOf(redMageSource), 1);
      entry[0].note = 'Instant · held Grand Impact · start combat';
    }
    const long = pickAction(job.actions, mode === 'aoe' && level >= 15 ? 'Scatter|Impact' : state.mana === 'white' ? 'Veraero|Veraero III' : 'Verthunder|Verthunder III', level);
    if (long && !redMageSource) entry.push({ action: long, name: long.name, count: 1, note: 'Instant · opening Dualcast', entry: true });
  }
  const destination = job.id === 'MNK' ? rows.find(row => !['setup', 'prepull'].includes(row.id)) || target.row : target.row;
  destination.steps.splice(destination === target.row ? target.index : 0, 0, ...entry);
  destination.reason += ' Outside combat, land the included opening attack first; the following ability cannot be used before combat starts.';
}
