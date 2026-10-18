import { pickAction } from './catalog.mjs';

// Held procs describe past actions, not permission to cast their cooldown again.
export function annotatePrerequisites(job, rows, state, level, mode) {
  const aoe = mode === 'aoe';
  const history = {};
  const context = {};
  const ready = (row, note) => { context[row] = [context[row], note].filter(Boolean).join(' '); };
  const past = (row, names, note) => {
    const previous = history[row];
    history[row] = previous ? { names: [...previous.names, ...names], note: previous.note + '. ' + note } : { names, note };
  };
  switch (job.id) {
    case 'PLD':
      if (state.magic) past('magic', ['Requiescat|Imperator'], 'Magic window already granted');
      if (state.atonement) past('atonement', ['Fast Blade', 'Riot Blade', 'Royal Authority'], 'Combo already completed: Atonement Ready');
      if (state.divine) ready(rows.some(row => row.id === 'divine-first') ? 'divine-first' : 'divine', 'Divine Might is already active from Royal Authority or Prominence. Spend it without repeating the generating combo.');
      break;
    case 'WAR':
      if (state.chaos) past('chaos', ['Infuriate'], 'Already used: Nascent Chaos and its 50 gauge');
      if (state.release) past('release', ['Inner Release'], 'Already active: three free spenders');
      if (state.rend) past('rend', ['Inner Release'], 'Already granted: Primal Rend Ready remains unspent');
      break;
    case 'DRK':
      if (state.delirium) past('delirium', ['Delirium'], 'Already active: three stacks');
      if (state.darkside) ready('buffs', 'Darkside is already active. Shadowbringer does not require another Edge / Flood first.');
      break;
    case 'GNB':
      if (state.reign) past('reign', ['Bloodfest'], 'Already used: Ready to Reign');
      break;
    case 'WHM':
      if (state.sight) past('sight', ['Presence of Mind'], 'Already used: remaining Sacred Sight');
      if (state.misery) ready('misery', 'Blood Lily is full after three Solace / Rapture uses. Cast Misery without healing again to rebuild it.');
      break;
    case 'SCH':
      if (state.impact) past('impact', ['Chain Stratagem'], 'Already used: Impact Imminent');
      if (state.energy) ready('energy', 'Aetherflow stacks are already held. Spend only a spare healing stack; do not refill the gauge first.');
      break;
    case 'AST':
      if (state.oracle) past('oracle', ['Divination'], 'Already used: Divining');
      if (state.card !== 'none') past('card', [state.card === 'balance' ? 'Astral Draw' : 'Umbral Draw'], 'Card already drawn; do not overwrite your hand');
      if (state.lord) past('lord', ['Astral Draw'], 'Lord already drawn');
      break;
    case 'SGE':
      if (state.addersting) ready('toxikon', 'Addersting is already held from duty entry or an absorbed barrier. Cast Toxikon without adding an unnecessary shield.');
      break;
    case 'MNK':
      if (state.chakra) ready('chakra', 'Five Chakra are already held. Do not repeat Meditation to generate them.');
      if (state.blitz !== 'none') past('blitz', ['Perfect Balance'], 'Already used with three form weaponskills; the selected Beast Chakra pattern and Nadi are already present');
      ready('forms', state.blitz !== 'none' ? 'The ready Blitz grants Formless Fist. Resume with Opo-opo afterwards.' : state.form === 'none' ? 'No form is active yet. Use Form Shift first when unlocked; otherwise begin the form cycle below.' : `${({ opo: 'Opo-opo', raptor: 'Raptor', coeurl: 'Coeurl' })[state.form]} form is already active. Begin with that form’s action, then advance through the cycle.`);
      break;
    case 'DRG':
      if (state.life) past('life', ['Geirskogul'], 'Already used: Life of the Dragon');
      if (state.draconian) ready('combo', 'Draconian Fire is already active from a completed combo. Use the enhanced starter without repeating that finisher.');
      break;
    case 'NIN':
      if (state.kassatsu) past('kassatsu', ['Kassatsu'], 'Already active; no extra mudra charge is consumed');
      if (state.burst === 'prepared' && level < 45) past('buffs', ['Hide'], 'Hidden is already active; do not use Hide again in combat');
      else if (state.burst === 'prepared') ready('buffs', 'Shadow Walker or Hidden is already active. Use the ready personal debuff without repeating mudra or Hide.');
      break;
    case 'SAM':
      if (Number(state.meditation)) ready(rows.some(row => row.id === 'iaijutsu') ? 'iaijutsu' : rows.some(row => row.id === 'meditation') ? 'meditation' : 'sen', `${state.meditation} Meditation stack${state.meditation === '1' ? ' is' : 's are'} already held. Iaijutsu and Ogi Namikiri add one; Shoha spends three before another generator.`);
      if (state.ogi) past('ogi', ['Ikishoten'], 'Already used: Ogi Namikiri Ready');
      if (state.meikyo) past('sen', ['Meikyo Shisui'], 'Already active: skip combo starters');
      if (state.tendo) past('iaijutsu', ['Meikyo Shisui'], 'Already used: Tendo; selected Sen are also required');
      break;
    case 'RPR':
      if (state.prepared) ready(rows[0]?.id, 'Soulsow is already prepared. Harvest Moon can spend it without another cast.');
      if (state.reaver.startsWith('exec')) past('reaver', ['Gluttony'], 'Already used: spend the granted Executioner stacks before another weaponskill');
      else if (state.reaver !== 'none') ready('reaver', 'Soul Reaver is already active from a Soul spender. Spend the granted attack before another weaponskill.');
      if (state.prepared && state.harvestMoon) past('harvest-moon', ['Soulsow'], 'Soulsow already prepared; spend Harvest Moon without casting it again');
      if (state.shroud === 'harvest') past('shroud', ['Plentiful Harvest'], 'Already used: Ideal Host; at level 100 also Perfectio Occulta for the following Communio');
      if (state.perfectio) past('perfectio', ['Plentiful Harvest', 'Enshroud', 'Communio'], 'Plentiful Harvest supplied Perfectio Occulta; Enshroud already completed through Communio: Perfectio Parata');
      break;
    case 'VPR':
      if (state.ready) past('reawaken-free', ['Serpent’s Ire'], 'Already used: free Reawaken entry');
      if (state.coils && !state.vice && !state.buffs) ready('coils', 'A Rattling Coil is already held from Vicewinder / Vicepit or Serpent’s Ire. Each Uncoiled Fury spends one coil.');
      break;
    case 'BRD':
      ready(rows[0]?.id, state.song === 'none' ? 'No song is currently active. Select a ready song change when one is available.' : `${({ wanderer: 'The Wanderer’s Minuet', mage: 'Mage’s Ballad', army: 'Army’s Paeon' })[state.song]} is already active. A current song changes its effects and the next transition; it does not require an immediate extra cast.`);
      if (state.pitch) past('pitch', ["The Wanderer's Minuet"], 'Song already active and Repertoire already held');
      if (state.proc) ready(state.buffs ? 'proc-before-barrage' : 'proc', 'Hawk’s Eye is already active. Spend the proc without casting filler to try to generate it again.');
      if (state.finale && !state.songDue) ready('finale', 'At least one Coda is already held from a song. Use Radiant Finale without restarting a song.');
      if (state.dots === 'refresh' && !aoe) past('dots', ['Windbite|Stormbite', 'Venomous Bite|Caustic Bite'], 'Both DoTs already applied; Iron Jaws only refreshes them');
      break;
    case 'MCH':
      if (state.metal) past('metal', ['Barrel Stabilizer'], 'Already used: Full Metal Machinist');
      break;
    case 'DNC': {
      const source = { tillana: ['Technical Step', 'Technical Finish'], starfall: ['Devilment'], last: ['Standard Step', 'Standard Finish'], finishing: ['Flourish'], dawn: ['Technical Step', 'Technical Finish'] }[state.finish];
      if (state.finish === 'last') ready('finish', 'Last Dance Ready is already active from Standard Finish or Finishing Move. Spend it without repeating the dance.');
      else if (source) past('finish', source, 'Setup already completed; highlighted dance steps were required before the Finish, where applicable');
      if (state.symmetry) ready('symmetry', 'Symmetry is already active from a weaponskill proc or Flourish. Do not repeat the generating action.');
      if (state.flow) ready('flow', 'Flow is already active from a weaponskill proc or Flourish. Do not repeat the generating action.');
      if (state.fan3) ready('fan3', 'Threefold Fan Dance is already active from a feather spender or Flourish. Use the granted fan directly.');
      break;
    }
    case 'BLM':
      ready('cycle', ({ cycle: 'Starting from neutral. The opening ice spell establishes Umbral Ice.', loop: state.manafont ? 'The previous fire phase is complete; Astral Fire is still active. Use ready Manafont now, finish the extra fire phase, then refill in ice.' : 'The previous fire phase is complete; Astral Fire is still active. Switch to ice, refill, then return to fire.', ice: 'Umbral Ice is already active at maximum stacks. Skip the entry spell, finish ice setup, then continue through fire.', fire: `Astral Fire is already active with full MP${level >= 58 ? ' and three Umbral Hearts' : ''}${level >= 90 ? '; Paradox is ready' : ''}. Skip ice setup and continue with fire.` })[state.phase]);
      break;
    case 'SMN': {
      if (state.aether) ready('aether', 'Aetherflow is already held from Energy Drain / Energy Siphon. Spend the existing stack without generating it again.');
      if (state.ruin4) ready('ruin4', 'Further Ruin is already active from Energy Drain / Energy Siphon. Use the granted Ruin IV directly.');
      if (state.phase === 'between' && state.summon) past('summon', ['Summon Carbuncle'], 'Carbuncle already present before this new summon');
      if (state.phase === 'demi') past('demi', ['Summon Carbuncle', state.demi === 'solar' ? 'Summon Solar Bahamut' : state.demi === 'phoenix' ? 'Summon Phoenix' : 'Aethercharge|Dreadwyrm Trance|Summon Bahamut'], 'Summon already active; do not activate again');
      if (!['fresh', 'between', 'demi'].includes(state.phase)) past('attunement', [{ ruby: 'Summon Ruby|Summon Ifrit|Summon Ifrit II', topaz: 'Summon Topaz|Summon Titan|Summon Titan II', emerald: 'Summon Emerald|Summon Garuda|Summon Garuda II' }[state.phase]], 'Primal already summoned: all attunement charges remain');
      break;
    }
    case 'RDM':
      if (state.impact) past(rows.some(row => row.id === 'impact') ? 'impact' : 'filler', ['Acceleration'], 'Already used: Grand Impact Ready');
      if (state.dualcast) ready(rows.some(row => row.id === 'dualcast') ? 'dualcast' : 'filler', 'Dualcast is already active. Cast the selected long spell directly; a short cast is not needed first.');
      if (!state.dualcast) {
        const short = rows.find(row => row.id === 'filler')?.steps[0]?.action.name;
        if (short === 'Verfire') ready('filler', 'Verfire Ready is already active. The proc can come from Verthunder, Verflare or Acceleration; do not cast another generator first.');
        if (short === 'Verstone') ready('filler', 'Verstone Ready is already active. The proc can come from Veraero, Verholy or Acceleration; do not cast another generator first.');
      }
      break;
    case 'PCT':
      if (state.pull && state.prepared) past('setup', [{ none: 'Pom Motif', pom: 'Pom Motif', wing: 'Wing Motif', claw: 'Claw Motif', fang: 'Maw Motif' }[state.muse], 'Hammer Motif', 'Starry Sky Motif'], 'All available canvases already painted; skip repainting before the opening attack');
      else if (state.pull && state.hammer === 'ready') past('setup', ['Hammer Motif'], 'Weapon canvas already painted; prepare the remaining canvases before the pull');
      if (state.hammer === 'active') past('hammer', ['Hammer Motif', 'Striking Muse'], 'Hammer already painted and Muse already used: spend the remaining full three-stack combo');
      if (state.hammer === 'ready' && !state.pull) past('hammer', ['Hammer Motif'], 'Hammer already painted; use Striking Muse next');
      if (state.buffs && !state.pull) past('buffs', ['Starry Sky Motif'], 'Landscape already painted; use Starry Muse next');
      if (state.muse !== 'none' && !state.pull) past('muse', [...(state.muse === 'wing' ? ['Pom Muse'] : state.muse === 'fang' ? ['Pom Muse', 'Winged Muse', 'Clawed Muse'] : []), { pom: 'Pom Motif', wing: 'Wing Motif', claw: 'Claw Motif', fang: 'Maw Motif' }[state.muse]], 'Selected motif already painted; earlier creature depictions needed for its portrait are already rendered');
      if (state.pull && ['wing', 'fang'].includes(state.muse)) ready('muse', 'This selection continues an existing creature cycle with the earlier depictions already earned. Paint only the selected creature, not every creature motif at once.');
      if (state.prism) past('prism', ['Starry Sky Motif', 'Starry Muse'], 'Already used: Starstruck');
      if (state.rainbow) past('rainbow', ['Starry Muse'], 'Already used and all five Hyperphantasia stacks already spent: Rainbow Bright');
      if (state.black) past('black', ['Subtractive Palette'], 'Black Paint and Monochrome Tones already acquired');
      if (state.white) ready('white', 'White Paint is already held from a completed color combo or Rainbow Drip. Spend the paint without repeating its source.');
      break;
    case 'BLU':
    case 'BST':
      break;
  }
  return rows.map(row => {
    const setup = history[row.id];
    if (!setup) return context[row.id] ? { ...row, startingState: context[row.id] } : row;
    const prerequisites = setup.names.flatMap(item => {
      const value = typeof item === 'string' ? { name: item, count: 1 } : item;
      const action = pickAction(job.actions, value.name, level);
      return action ? [{ ...value, action, completed: true, note: setup.note }] : [];
    });
    return { ...row, prerequisites, prerequisiteNote: setup.note, ...(context[row.id] ? { startingState: context[row.id] } : {}) };
  });
}
