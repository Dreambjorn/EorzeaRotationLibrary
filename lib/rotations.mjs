import { normalize, pickAction } from './catalog.mjs';

const step = (name, count = 1, note = '') => ({ name, count, note });
const flow = (title, names, note = '') => ({ title, note, steps: names.map(x => typeof x === 'string' ? step(x) : x) });

export function quickReferences(id, level, mode) {
  const aoe = mode === 'aoe';
  switch (id) {
    case 'PLD': return [
      flow('Weaponskill loop', aoe ? ['Total Eclipse', 'Prominence'] : ['Fast Blade', 'Riot Blade', 'Rage of Halone|Royal Authority', 'Atonement', 'Supplication', 'Sepulchre', 'Holy Spirit'], 'Spend Divine Might and Atonement before the next Royal Authority. Keep Fight or Flight on cooldown.'),
      flow('Magic burst', ['Fight or Flight', 'Requiescat|Imperator', 'Confiteor', 'Blade of Faith', 'Blade of Truth', 'Blade of Valor', 'Blade of Honor'], 'At 68–79 spend Requiescat on four Holy Spirits (Holy Circles for AoE at 72+). At 80–89 use Confiteor then three spells. At 90+ use the full blade combo.'),
    ];
    case 'WAR': return [
      flow('Build gauge and maintain Surging Tempest', aoe ? ['Overpower', 'Mythril Tempest'] : ['Heavy Swing', 'Maim', "Storm's Eye"], 'Use Storm’s Path instead of Storm’s Eye when the damage buff has enough time remaining.'),
      flow('Spend gauge', aoe ? ['Berserk|Inner Release', step('Steel Cyclone|Decimate', 3), 'Primal Rend', 'Primal Ruination'] : ['Berserk|Inner Release', step('Inner Beast|Fell Cleave', 3), 'Primal Rend', 'Primal Ruination'], 'The three free spenders require Inner Release. Spend Infuriate procs before another Infuriate; do not overcap gauge.'),
    ];
    case 'DRK': return [
      flow('Build blood', aoe ? ['Unleash', 'Stalwart Soul'] : ['Hard Slash', 'Syphon Strike', 'Souleater']),
      flow('Burst and spend', [aoe ? 'Flood of Darkness|Flood of Shadow' : 'Edge of Darkness|Edge of Shadow', 'Delirium', aoe ? 'Quietus|Impalement' : 'Bloodspiller|Scarlet Delirium', ...(aoe ? [] : ['Comeuppance', 'Torcleaver']), 'Living Shadow', 'Disesteem'], 'Keep Darkside active. Delirium changes at level 96; use its available combo. Save MP for required shielding.'),
    ];
    case 'GNB': return [
      flow('Build cartridges', aoe ? ['Demon Slice', 'Demon Slaughter'] : ['Keen Edge', 'Brutal Shell', 'Solid Barrel']),
      flow('Cartridge combo', ['No Mercy', 'Gnashing Fang', 'Jugular Rip', 'Savage Claw', 'Abdomen Tear', 'Wicked Talon', 'Eye Gouge'], 'Use the Continuation follow-up after each Gnashing Fang combo action. Below level 70, these follow-ups are unavailable.'),
      flow('Bloodfest follow-up', ['Bloodfest', 'Reign of Beasts', 'Noble Blood', 'Lion Heart'], 'Reign of Beasts requires level 100 and Ready to Reign. Also fit Double Down and Sonic Break into No Mercy; use the current guide for target breakpoints.'),
    ];
    case 'WHM': return [flow('Damage priority', aoe ? ['Holy|Holy III', 'Afflatus Misery'] : ['Aero|Aero II|Dia', step('Stone|Stone II|Stone III|Stone IV|Glare|Glare III', 1, 'Filler'), 'Afflatus Misery', 'Glare IV'], 'Maintain the damage-over-time effect on durable targets. Misery requires a Blood Lily; Glare IV requires Sacred Sight. Heal when needed; this is a priority list, not a strict repeating combo.')];
    case 'SCH': return [flow('Damage priority', aoe ? ['Art of War|Art of War II'] : ['Bio|Bio II|Biolysis', 'Ruin|Broil|Broil II|Broil III|Broil IV', 'Ruin II'], 'Maintain the damage-over-time effect. Ruin II is for movement or necessary weaving, not part of the stationary loop. Use Chain Stratagem and Baneful Impaction when available; keep healing resources for incoming damage.')];
    case 'AST': return [flow('Damage priority', aoe ? ['Gravity|Gravity II', 'Earthly Star', 'Stellar Detonation'] : ['Combust|Combust II|Combust III', 'Malefic|Malefic II|Malefic III|Malefic IV|Fall Malefic', 'Oracle'], 'Maintain Combust and cast your filler otherwise. Oracle requires Divining. Use cards and Divination as they become available; healing takes precedence when needed.')];
    case 'SGE': return [flow('Damage priority', aoe ? ['Dyskrasia|Dyskrasia II', 'Phlegma|Phlegma II|Phlegma III', 'Psyche'] : ['Eukrasia', 'Eukrasian Dosis|Eukrasian Dosis II|Eukrasian Dosis III', 'Dosis|Dosis II|Dosis III', 'Phlegma|Phlegma II|Phlegma III', 'Psyche'], 'This is a priority reference. Maintain your DoT, avoid capping Phlegma, and use Toxikon for movement. Keep Kardia on an appropriate party member.')];
    case 'MNK': return [flow('Advance through all three forms', aoe ? ['Arm of the Destroyer|Shadow of the Destroyer', 'Four-point Fury', 'Rockbreaker'] : ['Dragon Kick', 'Twin Snakes', 'Demolish', 'Bootshine|Leaping Opo', 'True Strike|Rising Raptor', 'Snap Punch|Pouncing Coeurl'], 'For each form, use its Fury spender when a Fury stack exists; otherwise use its generator. This row shows the options, not a fixed six-button loop. Follow current guide target counts for mixed AoE.'), flow('Perfect Balance examples', ['Perfect Balance', 'Dragon Kick', 'Bootshine|Leaping Opo', 'Dragon Kick', 'Elixir Field|Elixir Burst'], 'Three matching Beast Chakra build Lunar Nadi; three different forms build Solar Nadi. With both Nadi, your next Blitz becomes Phantom Rush. Align burst with Riddle of Fire and Brotherhood.')];
    case 'DRG': return [flow('Alternate the two combo chains', aoe ? ['Doom Spike|Draconian Fury', 'Sonic Thrust', 'Coerthan Torment'] : ['True Thrust|Raiden Thrust', 'Disembowel|Spiral Blow', 'Chaos Thrust|Chaotic Spring', 'Wheeling Thrust', 'Fang and Claw|Drakesbane', 'True Thrust|Raiden Thrust', 'Vorpal Thrust|Lance Barrage', "Full Thrust|Heavens' Thrust", 'Fang and Claw', 'Wheeling Thrust|Drakesbane'], 'At 64+ the fourth combo action enables the fifth. At 64–75 follow the highlighted Fang and Claw / Wheeling Thrust finisher. Weave jumps and buffs between weaponskills.')];
    case 'NIN': return [flow('Filler combo', aoe ? ['Death Blossom', 'Hakke Mujinsatsu'] : ['Spinning Edge', 'Gust Slash', 'Aeolian Edge'], 'Use Armor Crush to generate Kazematoi, then spend it with Aeolian Edge. Keep burst aligned with Kunai’s Bane / Trick Attack and Dokumori / Mug.'), flow(aoe ? 'AoE ninjutsu' : 'Single-target ninjutsu', aoe ? ['Ten', 'Jin', 'Katon'] : ['Ten', 'Chi', 'Raiton'], 'Mudra orders matter. Do not weave unrelated abilities between signs. Use Suiton to enable your burst; Doton only gains full value when enemies remain inside it.')];
    case 'SAM': return [flow('Build Sen', aoe ? ['Fuga|Fuko', 'Mangetsu', 'Fuga|Fuko', 'Oka', 'Tenka Goken'] : ['Hakaze|Gyofu', 'Jinpu', 'Gekko', 'Hakaze|Gyofu', 'Shifu', 'Kasha', 'Hakaze|Gyofu', 'Yukikaze', 'Midare Setsugekka'], 'Maintain Fugetsu and Fuka. Keep Higanbana on long-lived targets. Spend Kenki without overcapping and align Meikyo, Tsubame-gaeshi, and Ogi Namikiri with burst.')];
    case 'RPR': return [
      flow('Build Soul', aoe ? ['Whorl of Death', 'Spinning Scythe', 'Nightmare Scythe'] : ['Shadow of Death', 'Slice', 'Waxing Slice', 'Infernal Slice'], 'Refresh Death’s Design before it expires. Spend Soul on Blood Stalk / Grim Swathe, then use the granted Soul Reaver actions.'),
      flow('Enshroud window', ['Enshroud', aoe ? 'Grim Reaping' : 'Void Reaping', aoe ? 'Grim Reaping' : 'Cross Reaping', aoe ? "Lemure's Scythe" : "Lemure's Slice", aoe ? 'Grim Reaping' : 'Void Reaping', aoe ? 'Grim Reaping' : 'Cross Reaping', aoe ? "Lemure's Scythe" : "Lemure's Slice", 'Communio'], 'Enshroud needs 50 Shroud. At 80–85 use five Reaping actions; at 86–89 weave Lemure spenders but still finish with the fifth Reaping. Communio replaces that final action at 90.'),
    ];
    case 'VPR': return [flow('Follow Vipersight', aoe ? ['Steel Maw', "Hunter's Bite", 'Jagged Maw', 'Dread Maw|Reaving Maw', "Swiftskin's Bite", 'Bloodied Maw'] : ['Steel Fangs', "Hunter's Sting", 'Flanksting Strike', 'Dread Fangs|Reaving Fangs', "Swiftskin's Sting", 'Hindsting Strike'], 'Choose the branch whose buff needs refreshing and the finisher enhanced by your venom. Follow the highlighted Vipersight actions; these are example branches, not a universal fixed combo.'), flow('Reawaken window', ['Reawaken', 'First Generation', 'Second Generation', 'Third Generation', 'Fourth Generation', 'Ouroboros'], 'Requires the appropriate Offering or readiness. Weave available Legacy actions after their matching Generation at level 100; use the live guide for burst details.')];
    case 'BRD': return [flow('Damage priority', aoe ? ['Quick Nock|Ladonsbite', 'Wide Volley|Shadowbite', 'Rain of Death', 'Apex Arrow', 'Blast Arrow'] : ['Windbite|Stormbite', 'Venomous Bite|Caustic Bite', 'Iron Jaws', 'Straight Shot|Refulgent Arrow', 'Heavy Shot|Burst Shot'], 'Apply both DoTs once, refresh with Iron Jaws when needed, use procs, then filler. Keep songs cycling and spend Repertoire / Soul Voice before overcapping. Priority row; do not repeat every icon mechanically.'), flow('Song cycle', ["The Wanderer's Minuet", "Mage's Ballad", "Army's Paeon"], 'Keep a song active. Follow the current guide for exact song durations and burst alignment.')];
    case 'MCH': return [flow('Filler', aoe ? ['Spread Shot|Scattergun'] : ['Split Shot|Heated Split Shot', 'Slug Shot|Heated Slug Shot', 'Clean Shot|Heated Clean Shot']), flow('Burst priority', ['Hot Shot|Air Anchor', 'Drill', 'Chain Saw', 'Excavator', 'Full Metal Field', 'Hypercharge', step(aoe ? 'Auto Crossbow' : 'Heat Blast|Blazing Shot', 5)], 'Keep tools rolling. Weave Gauss Round / Ricochet (their upgrades at 92+) during Hypercharge without clipping. Align Wildfire with single-target Hypercharge; this is not an exact opener.')];
    case 'DNC': return [flow('Base combo and procs', aoe ? ['Windmill', 'Rising Windmill', 'Bladeshower', 'Bloodshower'] : ['Cascade', 'Reverse Cascade', 'Fountain', 'Fountainfall'], 'Use proc actions only when ready, before risking overwriting them. Keep Standard Step rolling, use Fan Dance procs, and do not overcap Esprit.'), flow('Technical window', ['Technical Step', 'Technical Finish', 'Devilment', 'Tillana', 'Saber Dance', 'Dance of the Dawn'], 'Perform the highlighted dance steps before finishing. This is a burst checklist; Technical Step cannot be followed immediately by its finish. Use the current guide for Finishing Move and Last Dance at high levels.')];
    case 'BLM': return [flow('Elemental cycle', aoe ? (level < 35 ? ['Blizzard II', 'Transpose', step('Fire II', 3), 'Transpose'] : level < 40 ? [step('Blizzard II', 2), step('Fire II', 4)] : level < 50 ? ['Freeze'] : level < 58 ? [step('Freeze', 2), 'Transpose', 'Fire II', 'Flare', 'Transpose'] : ['Freeze', 'Foul', 'Transpose', step('Flare', 2), ...(level >= 100 ? ['Flare Star'] : []), 'Transpose']) : level < 35 ? ['Fire', 'Transpose', 'Blizzard', 'Transpose'] : ['Blizzard III', level >= 58 ? 'Blizzard IV' : 'Blizzard', ...(level >= 90 ? ['Paradox'] : []), 'Fire III', step(level >= 60 ? 'Fire IV' : 'Fire', level >= 90 ? 3 : level >= 60 ? 7 : 1), ...(level >= 90 ? ['Paradox', step('Fire IV', 3)] : []), ...(level >= 100 ? ['Flare Star'] : []), 'Despair'], 'Keep Thunder active and spend Polyglot without overcapping. Repeat low-level Fire until MP is low, and Blizzard until full MP. AoE below level 12 is unavailable. In high-level AoE, wait out Transpose with Foul / AoE Thunder / Freeze as appropriate; the published sequence gives the current details.')];
    case 'SMN': return [flow('Summon cycle', ['Aethercharge|Dreadwyrm Trance|Summon Bahamut|Summon Solar Bahamut', 'Summon Ruby|Summon Ifrit|Summon Ifrit II', step(aoe ? 'Ruby Outburst|Ruby Disaster|Ruby Catastrophe' : 'Ruby Ruin|Ruby Ruin II|Ruby Ruin III|Ruby Rite', 2), 'Summon Topaz|Summon Titan|Summon Titan II', step(aoe ? 'Topaz Outburst|Topaz Disaster|Topaz Catastrophe' : 'Topaz Ruin|Topaz Ruin II|Topaz Ruin III|Topaz Rite', 4), 'Summon Emerald|Summon Garuda|Summon Garuda II', step(aoe ? 'Emerald Outburst|Emerald Disaster|Emerald Catastrophe' : 'Emerald Ruin|Emerald Ruin II|Emerald Ruin III|Emerald Rite', 4)], 'Use the demi phase’s GCDs and abilities before elemental summons. Elemental order is flexible. At 86+ add Astral Flow follow-ups; at 100 cycle Solar Bahamut, Bahamut, Solar Bahamut, Phoenix. This row abbreviates those phases.')];
    case 'RDM': return [flow('Build both mana colors', aoe ? ['Verthunder II|Veraero II', 'Scatter|Impact'] : ['Jolt|Jolt II|Jolt III', 'Verthunder|Verthunder III'], 'Use Verfire / Verstone procs before Jolt. Dualcast the long spell for the lower mana color. Avoid a large imbalance.'), flow('Spend 50 / 50 mana', [ ...(aoe ? ['Enchanted Moulinet', 'Enchanted Moulinet Deux', 'Enchanted Moulinet Trois'] : ['Enchanted Riposte', 'Enchanted Zwerchhau', 'Enchanted Redoublement']), 'Verflare|Verholy', 'Scorch', 'Resolution'], 'Choose Verholy or Verflare for the lower mana color and available procs. Manafication changes resource requirements; finish the entire chain.')];
    case 'PCT': return [flow('Additive colors', aoe ? ['Fire II in Red', 'Aero II in Green', 'Water II in Blue'] : ['Fire in Red', 'Aero in Green', 'Water in Blue']), flow('Subtractive colors', ['Subtractive Palette', ...(aoe ? ['Blizzard II in Cyan', 'Stone II in Yellow', 'Thunder II in Magenta'] : ['Blizzard in Cyan', 'Stone in Yellow', 'Thunder in Magenta']), 'Comet in Black'], 'Prepare motifs during downtime. Spend creature and hammer muses, use Starry Muse on cooldown, and keep movement tools available. The live guide gives current target-count breakpoints.')];
    case 'BLU': return [flow('Example learned-spell damage setup', ['Bristle', 'Song of Torment', 'Sonic Boom'], 'Only use spells you have learned and equipped. Keep Song of Torment active, use a suitable filler, and align Moon Flute burst with your loadout. Blue Mage has no universal leveling rotation.'), flow('Example dungeon pack', ['The Ram\'s Voice', 'Ultravibration'], 'Works only on susceptible enemies with the required status. Bosses and resistant enemies need a different spell set; use the action details and current specialist guide.')];
    case 'BST': return [flow('Build TP with your familiar', ['First Battlehorn', 'Smash Axe', 'Axeblade Bite'], 'Summon a familiar first, then repeat Smash Axe → Axeblade Bite to build TP. Beastmaster and familiar build TP separately; instinctual skills require at least 100 TP.'), flow('Instinctual skill options', ['Avalanche Axe', 'Mistral Axe', 'Spinning Axe', 'Gale Axe'], 'These are alternatives. Chain a beastmaster or familiar instinctual skill within seven seconds. Clockwise affinities form intentional combos: Volant → Rampant → Durant → Eldritch → Volant. Familiar choice changes the rotation.')];
    default: return [];
  }
}

export function resolveReference(reference, actions, level) {
  return { ...reference, kind: 'reference', steps: reference.steps.flatMap(item => {
    const action = pickAction(actions, item.name, level);
    return action ? [{ ...item, action }] : [];
  }) };
}

export function identifyActions(text, actions) {
  const ordered = [...actions].sort((a, b) => b.name.length - a.name.length);
  const hits = [];
  for (const action of ordered) {
    const escaped = action.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[’']/g, "[’']");
    const expression = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu');
    for (const match of text.matchAll(expression)) {
      if (hits.some(hit => match.index < hit.end && match.index + match[0].length > hit.index)) continue;
      hits.push({ index: match.index, end: match.index + match[0].length, action });
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

export function extractSequence(text, actions, level) {
  if (!/(?:->|→|\s>\s|>\s|\s>)/.test(text)) return null;
  if (/stat priority|weapon damage|skill speed|crit.*determination|^\//i.test(text)) return null;
  const segments = text.split(/(?:->|→|>)/);
  const steps = [];
  for (const segment of segments) {
    let hits = identifyActions(segment, actions);
    if (!hits.length && /Firestarter(?: proc)?/i.test(segment)) {
      const action = actions.find(item => item.name === 'Fire III');
      if (action) hits = [{ action, index: 0, end: segment.length }];
    }
    if (!hits.length) {
      if (/^\s*(repeat|loop|finish|etc\b|…)/i.test(segment)) continue;
      return null;
    }
    if (hits.length > 1 && !/\/|\bor\b/i.test(segment)) return null;
    const available = hits.filter(hit => hit.action.level <= level);
    if (!available.length) return null;
    const hit = available[0];
    const tail = segment.slice(hit.end);
    const repeat = tail.match(/^\s*[×x]\s*(\d+)/i);
    const note = /Firestarter/i.test(segment) ? 'Firestarter proc' : tail.match(/^\s*(until[^.]+|spam[^.]*|\([^)]*\))/i)?.[1]?.trim() || '';
    steps.push({ action: hit.action, count: repeat ? Math.min(20, Number(repeat[1])) : 1, note, alternatives: available.slice(1).map(item => item.action) });
  }
  return steps.length >= 2 ? steps : null;
}

export function relevantSections(sections, level, mode) {
  return sections.filter(section => section.minLevel <= level &&
    (section.maxLevel === null || section.maxLevel >= level) &&
    (!section.mode || section.mode === mode));
}

export function isRotationDiagram(image) {
  const url = new URL(image.url);
  if (!['www.thebalanceffxiv.com', 'static.icy-veins.com'].includes(url.hostname)) return false;
  const filename = decodeURIComponent(url.pathname.split('/').at(-1));
  if (/^PCT[A-Z]|^202\d-|mchred|mchrobot|multitool|fight-tips|gauge|macro|effects/i.test(filename)) return false;
  return /opener|rotation|sequence|burst|leveling|filler|combo|gcd|motif-and-muse-order/i.test(filename)
    || /odd windows|even windows|fixing.*PB|solar lunar|double lunar/i.test(image.title);
}

export function createView(job, level, mode) {
  const actions = job.actions.filter(action => action.level <= level);
  const references = quickReferences(job.id, level, mode).map(ref => resolveReference(ref, actions, level)).filter(ref => ref.steps.length);
  const guideSections = relevantSections(job.guides.flatMap(guide => guide.sections.map(section => ({ ...section, source: guide.url, guideType: guide.type, publisher: guide.publisher || 'The Balance' }))), level, mode);
  const sequences = [];
  const seen = new Set();
  for (const section of guideSections) for (const block of section.blocks) {
    const steps = extractSequence(block.text, job.actions, level);
    if (!steps) continue;
    const signature = steps.map(item => `${item.action.id}:${item.count}`).join(',');
    if (seen.has(signature)) continue;
    seen.add(signature);
    sequences.push({ title: section.title, steps, context: block.text, source: section.source, kind: 'live' });
  }
  return { actions, references, sequences: sequences.slice(0, 12), guideSections };
}
