import { readFile } from 'node:fs/promises';
import { buildRotation } from '../lib/planner.mjs';
import { showWeaveAttacks, annotateCastSupport, gcdOptions, isGcdAttack } from '../lib/presentation.mjs';
import { createView } from '../lib/rotations.mjs';

if (!process.argv[2]) throw new Error('Pass the path to an existing library.json. This check never refreshes or writes the library.');
const library = JSON.parse(await readFile(process.argv[2], 'utf8'));
if (!Array.isArray(library.jobs) || !library.jobs.length) throw new Error('No cached job data available.');
let cells = 0, variants = 0, slots = 0, choices = 0;
const failures = [];
for (const job of library.jobs) {
  for (let level = 1; level <= job.cap; level++) for (const mode of ['single', 'aoe']) {
    cells++;
    const base = buildRotation(job, level, mode);
    const ready = Object.fromEntries(base.controls.filter(control => control.type === 'checkbox' && !control.disabled).map(control => [control.key, true]));
    const inputs = [{}, ready];
    if (mode === 'aoe') {
      const pair = buildRotation(job, level, mode, { targets: '2' });
      const pairReady = Object.fromEntries(pair.controls.filter(control => control.type === 'checkbox' && !control.disabled).map(control => [control.key, true]));
      inputs.push({ ...pairReady, targets: '2' });
      for (const control of pair.controls.filter(control => !base.controls.some(item => item.key === control.key))) if (control.type === 'checkbox') inputs.push({ targets: '2', [control.key]: true });
    }
    for (const control of base.controls) {
      if (control.type === 'checkbox') inputs.push({ [control.key]: !control.value });
      else for (const option of control.options || []) if (option.value !== control.value) {
        inputs.push({ [control.key]: option.value });
        inputs.push({ ...ready, [control.key]: option.value });
      }
    }
    for (const input of inputs) {
      variants++;
      try {
        const rotation = buildRotation(job, level, mode, input);
        const rows = annotateCastSupport(showWeaveAttacks(job, level, mode, rotation), level);
        for (const row of rows) for (let index = 0; index < row.steps.length; index++) {
          const step = row.steps[index];
          if (step.action.level > level || !Number.isInteger(step.count) || step.count < 1) throw new Error('Unavailable action or invalid count: ' + step.action.name);
          if (!isGcdAttack(step.action) || row.type === 'weave' && !step.entry && !step.example) continue;
          slots++;
          const options = gcdOptions(job, level, mode, rotation, rows, { row: row.id, index }).flatMap(group => group.options);
          choices += options.length;
          if (!options.some(option => option.action.id === step.action.id)) throw new Error('Displayed GCD absent from its own choices: ' + row.id + ' / ' + step.action.name);
          if (options.some(option => option.action.level > level)) throw new Error('Unavailable GCD alternative.');
        }
      } catch (error) {
        failures.push({ job: job.id, level, mode, input, error: error.message });
      }
    }
    createView(job, level, mode);
  }
  console.log('Checked ' + job.id + '.');
}
console.log(JSON.stringify({ cells, variants, slots, choices, failures: failures.length, failureGroups: failures.reduce((result, item) => { const key = item.job + ': ' + item.error; result[key] = (result[key] || 0) + 1; return result; }, {}), examples: failures.slice(0, 20) }, null, 2));
if (failures.length) process.exitCode = 1;
