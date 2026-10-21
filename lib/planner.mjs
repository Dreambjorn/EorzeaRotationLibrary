import { pickAction, targetCount, pictomancerColors, rotationReferences, RULES_REVIEWED_AT } from './catalog.mjs';
import { annotatePrerequisites } from './prerequisites.mjs';
import { includeCombatEntry } from './entry.mjs';

const toggle = (key, label, requires, help = '', value = false, min = 1) => ({ key, label, requires, help, value, min, type: 'checkbox' });
const choice = (key, label, options, help = '') => ({ key, label, options, help, value: options[0][0], type: 'select', min: 1 });
const buffs = (requires, label = 'Damage cooldowns ready') => toggle('buffs', label, requires, 'Include available damage buffs and their follow-ups. Weave abilities between GCDs.');
const dot = requires => toggle('dot', 'DoT needs refreshing', requires, 'Enable only when the effect is missing or about to expire on a target that will survive it.', true);
const moving = toggle('moving', 'Use Ruin II for movement', 'Ruin II', 'Use instant Ruin II while movement prevents Broil. Return to Broil when stationary.');
const swiftcast = toggle('moving', 'Use Swiftcast for movement', 'Swiftcast', 'Include Swiftcast before a hardcast spell. Enable only when Swiftcast is ready.');
const spec = {
  PLD: [buffs('Fight or Flight'), toggle('magic', 'Requiescat active', 'Requiescat|Imperator', 'Use the magic window already granted to you.'), toggle('atonement', 'Atonement Ready', 'Atonement', 'Start the full Atonement → Supplication → Sepulchre chain.'), toggle('divine', 'Divine Might ready', 'Holy Spirit', 'Spend the instant, enhanced Holy Spirit or Holy Circle.', false, 64)],
  WAR: [toggle('tempest', 'Surging Tempest needs refreshing', "Storm's Eye", 'Choose Storm’s Eye instead of Storm’s Path.', true), toggle('chaos', 'Nascent Chaos + 50 Beast Gauge available', 'Chaotic Cyclone|Inner Chaos', 'Reserve this 50 gauge for the enhanced action; spend it before another Infuriate.'), toggle('release', 'Inner Release stacks available', 'Inner Release', 'Start with all three free-spender stacks remaining. Primal Rend readiness is selected separately.'), toggle('rend', 'Primal Rend already ready', 'Primal Rend', 'Select only while Primal Rend Ready remains; held Inner Release stacks alone do not guarantee it.'), toggle('gauge', 'Additional Beast Gauge ≥ 50', 'Inner Beast', 'A separate 50 gauge is needed if Nascent Chaos is also selected. Inner Release does not consume it.'), buffs('Berserk|Inner Release')],
  DRK: [choice('mpPlan', 'MP / Dark Arts spending', [['hold', 'Hold MP for now'], ['refresh', 'Refresh Darkside · 3,000 MP / Dark Arts available', 'Flood of Darkness'], ['spend', 'Spend surplus · 3,000 MP / Dark Arts available', 'Flood of Darkness']], 'Each spending choice includes its resource requirement. Retain MP needed for a planned shield.'), toggle('darkside', 'Darkside already active', 'Flood of Darkness', 'Allows Shadowbringer without spending MP first. Otherwise an included Edge / Flood must activate Darkside.'), toggle('blood', 'Blood Gauge ≥ 50', 'Bloodspiller', 'Spend under buffs or before overcapping.'), toggle('delirium', 'Delirium active', 'Delirium', 'Start with all three stacks remaining.'), buffs('Blood Weapon|Delirium')],
  GNB: [choice('cartridges', 'Cartridges currently held', [['0', '0'], ['1', '1', 'Burst Strike'], ['2', '2', 'Burst Strike'], ['3', '3', 'Burst Strike', 88]], 'Capacity is two before level 88 and three afterwards. Bloodfest adds the same number of temporary cartridges; each is spent only once.'), toggle('gnashing', 'Gnashing Fang charge ready', 'Gnashing Fang', 'Uses one of the held or Bloodfest cartridges.'), toggle('bloodfest', 'Bloodfest ready', 'Bloodfest', 'Adds two cartridges before level 88, three afterwards, with temporary extra capacity. At 100, also grants Ready to Reign.'), toggle('reign', 'Ready to Reign already active', 'Reign of Beasts', 'Use the full Reign of Beasts combo.'), buffs('No Mercy', 'No Mercy + damage cooldowns ready')],
  WHM: [dot('Aero'), toggle('misery', 'Blood Lily ready', 'Afflatus Misery', 'Requires three lily heals. Use for damage, movement, or raid buffs.'), toggle('sight', 'Sacred Sight available', 'Glare IV', 'Use a granted Glare IV before the buff expires.'), buffs('Assize|Presence of Mind'), swiftcast],
  SCH: [dot('Bio'), toggle('impact', 'Impact Imminent ready', 'Baneful Impaction', 'Granted by Chain Stratagem; use before it expires.'), toggle('energy', 'Spare Aetherflow stack', 'Energy Drain', 'Only spend stacks not needed for upcoming healing.'), buffs('Chain Stratagem'), moving],
  AST: [dot('Combust'), toggle('oracle', 'Divining ready', 'Oracle', 'Granted by Divination; use Oracle while the buff is active.'), choice('card', 'Damage card held', [['none', 'None'], ['balance', 'The Balance', 'Astral Draw'], ['spear', 'The Spear', 'Umbral Draw']], 'Play your held damage card on an appropriate party member during buffs.'), toggle('lord', 'Lord of Crowns held', 'Minor Arcana', 'Use the held Lord during raid buffs without losing a use.'), buffs('Divination')],
  SGE: [dot('Eukrasia'), toggle('phlegma', 'Phlegma charge available', 'Phlegma', 'Spend under buffs or before capping charges; requires close range.'), toggle('addersting', 'Use available Addersting', 'Toxikon', 'Include Toxikon for planned movement or cleave.'), buffs('Psyche'), swiftcast],
  MNK: [choice('form', 'Current form', [['none', 'No form · prepare first'], ['opo', 'Opo-opo'], ['raptor', 'Raptor', 'True Strike'], ['coeurl', 'Coeurl', 'Snap Punch']], 'The output starts in this form and progresses through the next two.'), toggle('opo', 'Opo-opo Fury available', 'Dragon Kick'), toggle('raptor', 'Raptor Fury available', 'Twin Snakes'), toggle('coeurl', 'Coeurl Fury available', 'Demolish'), choice('blitz', 'Blitz ready: three Beast Chakra', [['none', 'Not ready'], ['lunar', 'Three matching forms', 'Elixir Field'], ['solar', 'Three different forms', 'Flint Strike|Rising Phoenix'], ['both', 'Both Nadi open', 'Tornado Kick|Phantom Rush']], 'Choose only after all three Beast Chakra are filled. Nadi change the resulting Blitz.'), toggle('chakra', 'Five Chakra available', 'Steel Peak', 'Spend before overcap. Use the line attack when it hits multiple enemies.'), toggle('wind', 'Riddle of Wind ready', 'Riddle of Wind', 'Include its granted Wind’s Reply at 96+.'), buffs('Riddle of Fire')],
  DRG: [toggle('refresh', 'Power Surge / DoT needs refreshing', 'Disembowel', 'Start with the buff-and-DoT combo; alternate chains afterwards.', true), toggle('draconian', 'Draconian Fire ready', 'Raiden Thrust', 'Use Raiden Thrust / Draconian Fury only when their readiness is active.'), buffs('Lance Charge'), toggle('life', 'Life of the Dragon active', 'Nastrond', 'Use Nastrond and available Stardiver within the active window.')],
  NIN: [toggle('kazematoi', 'Kazematoi available', 'Armor Crush', 'Spend with Aeolian Edge; otherwise build stacks with Armor Crush.'), choice('burst', 'Trick Attack / Kunai’s Bane setup', [['none', 'No burst now'], ['prepared', 'Debuff ready + Hidden / Shadow Walker active', 'Trick Attack|Kunai’s Bane'], ['prepare', 'Prepare ninjutsu + debuff · both ready', 'Suiton']], 'The preparation choice includes its ninjutsu charge. No extra switch is needed.'), toggle('mudra', 'Additional ninjutsu charge available', 'Ten', 'Complete signs without inserting other actions. This is a separate charge from burst preparation.'), toggle('kassatsu', 'Kassatsu active', 'Kassatsu', 'Its free ninjutsu does not consume a mudra charge.'), toggle('ninki', '50 Ninki available for a spender', 'Hellfrog Medium', 'A separate 50 Ninki is needed if Bunshin is also selected.'), toggle('bunshin', 'Bunshin ready + 50 Ninki available', 'Bunshin', 'Reserve this 50 Ninki for Bunshin; do not spend it again on Bhavacakra.')],
  SAM: [toggle('setsu', 'Setsu held', 'Yukikaze'), toggle('getsu', 'Getsu held', 'Gekko'), toggle('ka', 'Ka held', 'Kasha'), toggle('dot', 'Higanbana needs refreshing', 'Higanbana', 'Apply with one Sen to a target that will live long enough.', true), toggle('meikyo', 'Meikyo Shisui active', 'Meikyo Shisui', 'Use combo finishers directly to generate missing Sen and apply their buffs.'), toggle('tendo', 'Tendo ready', 'Tendo Setsugekka', 'Choose the enhanced Iaijutsu granted by Meikyo Shisui.'), toggle('kenki', 'Kenki ≥ 25', 'Hissatsu: Shinten', 'Spend surplus Kenki without losing a planned Senei / Guren.'), toggle('ogi', 'Ogi Namikiri Ready', 'Ogi Namikiri')],
  RPR: [choice('reaver', 'Granted Reaver / Executioner action', [['none', 'Not active'], ['gibbet', 'Soul Reaver: Gibbet enhanced', 'Gibbet'], ['gallows', 'Soul Reaver: Gallows enhanced', 'Gallows'], ['execGibbet', 'Executioner: Gibbet enhanced', 'Executioner’s Gibbet'], ['execGallows', 'Executioner: Gallows enhanced', 'Executioner’s Gallows']], 'Spend this granted weaponskill before other GCDs.'), toggle('prepared', 'Soulsow already prepared', 'Soulsow', 'Skip the pre-combat Soulsow cast when its buff is already held.'), toggle('harvestMoon', 'Use prepared Harvest Moon', 'Harvest Moon', 'Requires held Soulsow or the included pre-combat preparation.'), toggle('design', 'Death’s Design needs refreshing', 'Shadow of Death', 'Refresh before the debuff falls off.', true), choice('soulUse', 'Spend 50 Soul', [['hold', 'Hold Soul'], ['spend', 'Blood Stalk / Grim Swathe · 50 Soul available', 'Blood Stalk'], ['gluttony', 'Gluttony ready · 50 Soul available', 'Gluttony']], 'Select one use for the same 50 Soul. Gluttony grants two Executioner attacks.'), toggle('slice', 'Soul Slice / Soul Scythe charge ready', 'Soul Slice', 'Use without overcapping Soul; this adds 50 Soul for your next decision.'), choice('shroud', 'Enshroud setup', [['none', 'No Enshroud now'], ['gauge', '50 Shroud · Enshroud ready', 'Enshroud'], ['harvest', 'Ideal Host active · Plentiful Harvest used', 'Plentiful Harvest'], ['prepare', 'Immortal Sacrifice held · Plentiful Harvest ready · no Bloodsown', 'Plentiful Harvest']], 'Ideal Host funds the free window. At 100, its Plentiful Harvest also grants Perfectio Occulta; a gauge-only window does not.'), toggle('perfectio', 'Perfectio Parata ready', 'Perfectio'), buffs('Arcane Circle')],
  VPR: [choice('fang', 'Highlighted starting fang', [['steel', 'Steel Fangs / Steel Maw'], ['reaving', 'Reaving Fangs / Reaving Maw', 'Reaving Fangs']], 'Select the action enhanced by Honed Steel or Honed Reavers.'), choice('branch', 'Vipersight finisher', [['flanksting', 'Flanksting / Hunter branch'], ['flanksbane', 'Flanksbane / Hunter branch', 'Flanksbane Fang'], ['hindsting', 'Hindsting / Swiftskin branch', 'Hindsting Strike'], ['hindsbane', 'Hindsbane / Swiftskin branch', 'Hindsbane Fang']], 'Match the enhanced finisher and the buff that needs refreshing.'), toggle('vice', 'Vicewinder / Vicepit charge ready', 'Vicewinder'), toggle('coils', 'Rattling Coil available', 'Uncoiled Fury', 'Spend before overcap; keep a coil for a planned disengage.'), toggle('reawaken', 'Serpent Offerings ≥ 50', 'Reawaken', 'Funds one gauge-paid Reawaken. This remains available after a free entry.'), toggle('ready', 'Ready to Reawaken already active', 'Reawaken', 'Funds one free entry without spending Offering.'), buffs('Serpent’s Ire', 'Serpent’s Ire ready')],
  BRD: [choice('dots', 'Damage-over-time effects', [['apply', 'Missing: apply both', 'Venomous Bite|Windbite'], ['refresh', 'Both active: refresh soon', 'Iron Jaws'], ['healthy', 'Both have time remaining']], 'Iron Jaws refreshes existing effects; it does not apply missing DoTs.'), toggle('proc', 'Hawk’s Eye ready', 'Straight Shot', 'Use the ready proc before it is overwritten.'), choice('song', 'Current song', [['none', 'No song'], ['wanderer', 'The Wanderer’s Minuet', "The Wanderer's Minuet"], ['mage', 'Mage’s Ballad', "Mage's Ballad"], ['army', 'Army’s Paeon', "Army's Paeon"]]), toggle('songDue', 'Start / change song now', "Mage's Ballad", 'At cap: Wanderer about 43s → Mage about 43s → Army about 34s.', true), toggle('voice', 'Soul Voice ≥ 80', 'Apex Arrow', 'An 80+ Apex Arrow grants Blast Arrow; spend before overcap.'), toggle('finale', 'Radiant Finale ready + Coda available', 'Radiant Finale', 'Includes the Coda prerequisite and the granted Radiant Encore at 100.'), toggle('pitch', 'Pitch Perfect ready · spend Repertoire', 'Pitch Perfect', 'Use at three stacks, before overcap, or before leaving Wanderer’s Minuet.'), toggle('shots', 'Damage shot abilities ready', 'Bloodletter', 'Includes the unlocked Bloodletter / Heartbreak Shot, Empyreal Arrow, and Sidewinder.'), buffs('Raging Strikes')],
  MCH: [toggle('tools', 'Tool cooldowns ready', 'Hot Shot|Air Anchor', 'Prioritize available tools before starting Hypercharge.', true), choice('heatPlan', 'Hypercharge window', [['none', 'No Hypercharge now'], ['normal', '50 Heat / Hypercharged ready', 'Heat Blast'], ['wildfire', 'Wildfire + full Hypercharge ready', 'Wildfire']], 'Wildfire includes its Heat requirement. Land five fast shots and a sixth weaponskill inside Wildfire.'), toggle('battery', 'Spend Battery (≥ 50)', 'Rook Autoturret|Automaton Queen', 'Enable for raid buffs or before overcap; allow the summon to finish naturally.'), toggle('reassemble', 'Reassemble + strong weaponskill ready', 'Reassemble', 'Includes the target and any required combo setup. Never apply to Full Metal Field or Bioblaster’s DoT.'), toggle('metal', 'Full Metal Machinist ready', 'Full Metal Field', 'Granted by Barrel Stabilizer; use Full Metal Field before it expires.')],
  DNC: [toggle('symmetry', 'Silken / Flourishing Symmetry', 'Reverse Cascade'), toggle('flow', 'Silken / Flourishing Flow', 'Fountainfall'), toggle('standard', 'Standard Step ready', 'Standard Step', 'Use on cooldown; perform the highlighted dance steps before finishing.', true), toggle('technical', 'Technical Step + Devilment ready', 'Technical Step', 'Start the two-minute dance window. Complete four highlighted steps.'), choice('finish', 'Ready follow-up', [['none', 'None'], ['tillana', 'Flourishing Finish: Tillana', 'Tillana'], ['starfall', 'Flourishing Starfall', 'Starfall Dance'], ['last', 'Last Dance Ready', 'Last Dance'], ['finishing', 'Finishing Move Ready', 'Finishing Move'], ['dawn', 'Dance of the Dawn Ready + 50 Esprit', 'Dance of the Dawn']]), toggle('esprit', 'Esprit ≥ 80 (50 during buffs)', 'Saber Dance', 'Spend before overcap; bank gauge for the next buff window.'), toggle('feather', 'Spend a Fourfold Feather', 'Fan Dance', 'Use spare feathers before overcap or during buffs.'), toggle('fan3', 'Threefold Fan Dance ready', 'Fan Dance III')],
  BLM: [choice('phase', 'Starting phase', [['cycle', 'Start from neutral · full cycle'], ['loop', 'Continue after a completed fire phase'], ['ice', 'Already in ice · maximum stacks'], ['fire', 'Already in fire · full resources']], 'Existing phases assume maximum elemental stacks. Fire assumes full MP, Umbral Hearts and Paradox when unlocked. Ice finishes setup, then continues through fire.'), toggle('dot', 'Thunderhead ready + DoT needs refreshing', 'Thunder', 'Enable only with Thunderhead and a DoT that is missing or about to expire.', true), toggle('polyglot', 'Polyglot available', 'Foul', 'Spend for movement, during buffs, or before overcap.'), toggle('firestarter', 'Firestarter carried from last cycle', 'Fire III', 'Use after Transpose for Astral Fire I re-entry.'), toggle('paradox', 'Ice Paradox available', 'Paradox', 'Available when entering Umbral Ice from a completed Astral Fire phase.'), toggle('manafont', 'Use Manafont after fire phase', 'Manafont', 'Use when ready after fire. From a completed fire phase, use it immediately before switching to ice.'), toggle('triplecast', 'Use Triplecast for movement', 'Triplecast', 'Prefer the fire phase: Flare / Flare / Flare Star in packs, Fire IV in single target. Enable when a charge is ready.'), swiftcast],
  SMN: [choice('phase', 'Current summon phase', [['fresh', 'Before pull · summon Carbuncle first'], ['between', 'Carbuncle ready · between phases'], ['ruby', 'Ruby / Ifrit attunement', 'Summon Ruby'], ['topaz', 'Topaz / Titan attunement', 'Summon Topaz'], ['emerald', 'Emerald / Garuda attunement', 'Summon Emerald'], ['demi', 'Demi / trance active', 'Aethercharge']], 'Attunement choices start with all charges remaining.'), choice('demi', 'Next / active demi', [['bahamut', 'Bahamut / early trance'], ['phoenix', 'Phoenix', 'Summon Phoenix'], ['solar', 'Solar Bahamut', 'Summon Solar Bahamut']], 'At 100 follow Solar → Bahamut → Solar → Phoenix.'), choice('primal', 'Next available primal gem', [['topaz', 'Topaz / Titan', 'Summon Topaz'], ['ruby', 'Ruby / Ifrit', 'Summon Ruby'], ['emerald', 'Emerald / Garuda', 'Summon Emerald']], 'Choose an unspent gem. Elemental order can change to fit movement.'), toggle('summon', 'Demi / trance cooldown ready', 'Aethercharge', 'Between phases, use it before spending available primal gems.', true), toggle('aether', 'Aetherflow stack available', 'Fester', 'Spend in raid buffs or before the next Energy Drain.'), toggle('ruin4', 'Further Ruin ready', 'Ruin IV', 'Use one Ruin IV between demi phases, for damage or movement.'), buffs('Searing Light')],
  RDM: [choice('mana', 'Lower mana color', [['black', 'Black mana', 'Verthunder'], ['white', 'White mana', 'Veraero']], 'Use the long spell that raises the lower color; finisher procs can affect this choice.'), toggle('verfire', 'Verfire Ready', 'Verfire'), toggle('verstone', 'Verstone Ready', 'Verstone'), toggle('melee', '50 / 50 mana or Magicked Swordplay', 'Enchanted Riposte', 'Enough mana for the complete unlocked melee combo.'), toggle('manafication', 'Manafication ready · free melee combo', 'Manafication', 'Includes the free combo and Prefulgence at 100. Finish an existing combo first.'), toggle('dualcast', 'Dualcast active', 'Verthunder', 'Cast the long spell directly; otherwise use a short cast first.'), toggle('impact', 'Grand Impact Ready', 'Grand Impact'), buffs('Embolden')],
  PCT: [toggle('pull', 'Starting outside combat', 'Fire in Red', 'Paint all three available canvases before the opening attack. Uncheck when already fighting.'), toggle('prepared', 'All motifs already painted', 'Pom Motif', 'Skip painting filled canvases. An already painted or active hammer also skips its own motif.'), choice('hues', 'Current Aetherhues', [['none', 'None · red / cyan next'], ['one', 'Aetherhues · green / yellow next', 'Aero in Green'], ['two', 'Aetherhues II · blue / magenta next', 'Water in Blue']], 'Color spells share one changing button. A new Subtractive Palette preserves this color stage and grants three casts.'), toggle('palette', 'New Subtractive Palette · 50 Palette / Spectrum', 'Subtractive Palette', 'Start a new three-cast window. Finish an already active Subtractive Palette before selecting another.'), toggle('black', 'Black Paint available', 'Comet in Black'), toggle('white', 'Use White Paint for movement', 'Holy in White'), choice('hammer', 'Hammer combo', [['none', 'No hammer now'], ['prepare', 'Prepare hammer + Striking Muse ready', 'Striking Muse'], ['ready', 'Hammer painted + Striking Muse ready', 'Striking Muse'], ['active', 'Hammer Time already active · three stacks', 'Hammer Stamp']], 'Pre-combat setup paints the hammer first. In combat, preparation includes Hammer Motif and Striking Muse inline.'), toggle('rainbow', 'Rainbow Bright ready', 'Rainbow Drip', 'Use the instant Rainbow Drip granted after Hyperphantasia.'), toggle('prism', 'Starstruck ready', 'Star Prism'), choice('muse', 'Creature motif / ready Muse', [['none', 'No muse now · prepare Pom'], ['pom', 'Pom Muse ready', 'Pom Muse'], ['wing', 'Winged Muse ready', 'Winged Muse'], ['claw', 'Clawed Muse ready', 'Clawed Muse'], ['fang', 'Fanged Muse ready', 'Fanged Muse']], 'Before combat, paint this creature motif. In combat, its canvas must already be painted. Only one creature motif fits the canvas.'), buffs('Starry Muse', 'Starry Muse ready'), swiftcast],
  BLU: [choice('dotPlan', 'Song of Torment refresh', [['none', 'No refresh now'], ['plain', 'Song equipped · refresh DoT', 'Song of Torment'], ['bristled', 'Bristle + Song equipped · refresh DoT', 'Bristle']], 'The combined choice includes both equipped spells and a DoT that needs refreshing.'), toggle('sonic', 'Sonic Boom equipped', 'Sonic Boom'), choice('freezePlan', 'Susceptible pack setup', [['none', 'No freeze setup'], ['ram', 'The Ram’s Voice equipped · Deep Freeze possible', "The Ram's Voice"], ['ultra', 'Ram + Ultravibration ready · enemies susceptible', 'Ultravibration']], 'Ultravibration requires both equipped spells and enemies vulnerable to Deep Freeze and instant death. One choice includes the complete setup.'), toggle('moon', 'Moon Flute equipped and ready', 'Moon Flute', 'Only enable with a planned burst loadout; Waning Nocturne locks actions afterwards.')],
  BST: [choice('familiar', 'Familiar state', [['first', 'Summon First Battlehorn familiar'], ['active', 'Already summoned'], ['second', 'Summon Second Battlehorn familiar', 'Second Battlehorn'], ['third', 'Summon Third Battlehorn familiar', 'Third Battlehorn']], 'A summon choice includes its equipped battlehorn. Player and familiar build TP independently.'), toggle('tp', 'Beastmaster TP ≥ 100', 'Avalanche Axe', 'Player instinctual skills consume all player TP.'), choice('affinity', 'Familiar’s recent affinity', [['none', 'No active chain'], ['volant', 'Volant'], ['rampant', 'Rampant'], ['durant', 'Durant'], ['eldritch', 'Eldritch']], 'Choose the familiar skill used within the last seven seconds. The next player skill uses your own TP, not the familiar’s.')],
};

const hiddenInPack = { PLD: ['atonement'], WAR: ['tempest'], SCH: ['moving'], SGE: ['moving'], NIN: ['kazematoi'], BLM: ['firestarter'], RDM: ['verfire', 'verstone'], BLU: ['dotPlan'] };
const cooldowns = {
  PLD: [['magicReady', 'Requiescat / Imperator', 'Requiescat|Imperator'], ['circle', 'Circle of Scorn', 'Circle of Scorn'], ['spirits', 'Spirits Within / Expiacion', 'Spirits Within|Expiacion'], ['intervene', 'Intervene charge', 'Intervene']],
  WAR: [['upheaval', 'Upheaval / Orogeny', 'Upheaval'], ['onslaught', 'Onslaught charge', 'Onslaught']],
  DRK: [['living', 'Living Shadow', 'Living Shadow'], ['carve', 'Carve and Spit / Abyssal Drain', 'Carve and Spit|Abyssal Drain'], ['salt', 'Salted Earth', 'Salted Earth'], ['shadow', 'Shadowbringer charge', 'Shadowbringer']],
  GNB: [['zone', 'Danger Zone / Blasting Zone', 'Danger Zone|Blasting Zone'], ['bow', 'Bow Shock', 'Bow Shock'], ['double', 'Double Down', 'Double Down']],
  WHM: [['assize', 'Assize', 'Assize']], AST: [['star', 'Earthly Star', 'Earthly Star']],
  MNK: [['brotherhood', 'Brotherhood', 'Brotherhood']],
  DRG: [['litany', 'Battle Litany', 'Battle Litany'], ['geir', 'Geirskogul', 'Geirskogul'], ['jump', 'Jump / High Jump', 'Jump|High Jump'], ['dragonfire', 'Dragonfire Dive', 'Dragonfire Dive']],
  RDM: [['fleche', 'Fleche', 'Fleche'], ['contre', 'Contre Sixte', 'Contre Sixte'], ['corps', 'Corps-a-corps charge', 'Corps-a-corps'], ['engagement', 'Engagement charge', 'Engagement']],
  BRD: [['bloodletter', 'Bloodletter / Rain of Death charge', 'Bloodletter', 'shots'], ['empyreal', 'Empyreal Arrow', 'Empyreal Arrow', 'shots'], ['sidewinder', 'Sidewinder', 'Sidewinder', 'shots']],
  MCH: [['saw', 'Chain Saw', 'Chain Saw', 'tools'], ['drill', 'Drill / Bioblaster charge', 'Drill|Bioblaster', 'tools'], ['anchor', 'Hot Shot / Air Anchor', 'Hot Shot|Air Anchor', 'tools']],
};
const exclusive = { PLD: ['magic', 'buffs'], WAR: ['release', 'buffs'], DRK: ['delirium', 'buffs'], GNB: ['reign', 'bloodfest'], WHM: ['sight', 'buffs'], SCH: ['impact', 'buffs'], AST: ['oracle', 'buffs'], DRG: ['life', 'buffs'], SAM: ['ogi', 'buffs'], VPR: ['ready', 'buffs'], PCT: ['prism', 'buffs'] };

function blockedCondition(id, key, state, mode, level, has) {
  const conflict = exclusive[id];
  if (conflict?.includes(key) && conflict.some(other => other !== key && state[other])) return 'An existing proc / window and the cooldown that creates it describe different starting states. Clear the selected alternative first.';
  const packAoe = mode === 'aoe' && Number(state.targets || 3) >= 3;
  const sen = Number(Boolean(state.setsu)) + Number(Boolean(state.getsu)) + Number(Boolean(state.ka));
  if (id === 'GNB' && key === 'gnashing' && mode === 'aoe' && Number(state.targets) >= (level >= 96 ? 3 : 4)) return 'At this level and target count, spend cartridges on Fated Circle instead of Gnashing Fang.';
  if (id === 'GNB' && key === 'gnashing') {
    const total = Number(state.cartridges || 0) + (state.bloodfest ? level >= 88 ? 3 : 2 : 0);
    if (total < 1) return 'No cartridge is available. Set held cartridges or select Bloodfest; those resources also fund Double Down and other spenders.';
    if (state.double && has('Double Down') && total === 2) return 'Double Down uses both selected cartridges. A third cartridge or Bloodfest is needed for Gnashing Fang in this window.';
  }
  if (id === 'WAR' && key === 'rend' && state.buffs) return 'The new Inner Release already grants Primal Rend Ready. Spend that single readiness after the free spenders.';
  if (id === 'DRK' && key === 'darkside' && (!state.shadow || !has('Shadowbringer') || state.mpPlan !== 'hold')) return 'This starting status changes Shadowbringer when MP is held. An included Edge / Flood supplies Darkside otherwise.';
  if (id === 'RDM' && key === 'mana' && mode === 'aoe' && level >= 15 && level < 22) return 'Scatter raises both colors. Only the black short AoE spell is unlocked before Veraero II at level 22, so this color choice does not change the available pack sequence yet.';
  if (id === 'DNC' && key === 'pull' && state.standard && (state.finish === 'last' || state.flourish && level >= 96)) return 'Spend the held Last Dance or use the Flourish-granted Finishing Move before another Standard Step. They share readiness or a recast timer.';
  if (id === 'DNC' && key === 'flourish' && state.finish === 'finishing') return 'Flourish was already used to grant the held Finishing Move. Spend that existing readiness first.';
  if (id === 'MCH' && key === 'flamethrower' && state.heatPlan !== 'none') return 'Spend the selected Hypercharge window first. Flamethrower is the stationary fallback after tools and usable gauge.';
  if (id === 'MNK' && ['opo', 'raptor', 'coeurl'].includes(key) && mode === 'aoe' && Number(state.targets) >= 3 && (key === 'opo' || level < 92 || Number(state.targets) >= 4)) return 'The selected pack size uses an AoE action for this form, which does not spend Fury.';
  if (id === 'DRG' && key === 'draconian' && mode === 'aoe' && Number(state.targets) >= 3 && !has('Draconian Fury')) return 'Draconian Fire does not change the AoE starter until Draconian Fury is unlocked at level 82.';
  if (id === 'MNK' && key === 'form' && state.blitz !== 'none') return 'The selected Blitz grants Formless Fist. Use it on Opo-opo before resuming the form cycle.';
  if (id === 'SAM' && key === 'dot' && sen !== 1) return 'Higanbana requires exactly one Sen. Select the Sen you currently hold.';
  if (id === 'SAM' && key === 'tendo' && sen !== (packAoe ? 2 : 3)) return `Requires ${packAoe ? 'two' : 'three'} Sen for this Iaijutsu.`;
  if (id === 'SAM' && key === 'meikyo' && (sen === 3 || packAoe && sen === 2 || !packAoe && sen === 1 && state.dot)) return 'Spend the currently ready Iaijutsu first. Recheck the remaining Meikyo stacks when building Sen.';
  if (id === 'BRD' && key === 'pitch' && state.song !== 'wanderer') return 'Pitch Perfect requires an active Wanderer’s Minuet and existing Repertoire. Select that current song first.';
  if (id === 'PCT' && (key === 'buffs' && state.rainbow || key === 'rainbow' && state.buffs)) return 'Rainbow Bright from the previous Starry Muse expires before that cooldown is ready again. Select the existing proc or the new window.';
  if (id === 'DNC' && key === 'standard' && state.finish === 'finishing') return 'Finishing Move replaces Standard Step and shares its cooldown.';
  if (id === 'DNC' && key === 'esprit' && state.finish === 'dawn') return 'The selected 50 Esprit funds Dance of the Dawn first. Recheck remaining Esprit afterwards.';
  if (id === 'RPR' && key === 'avatar' && (mode !== 'aoe' && state.reaver !== 'none' || !['spend', 'gluttony'].includes(state.soulUse) || mode === 'aoe' && Number(state.targets) >= 4)) return 'The held Reaver attack sets the next enhancement, or this route does not use an Unveiled avatar action.';
  if (id === 'MCH' && key === 'cleave' && Number(state.targets) >= (level >= 94 ? 6 : level >= 92 ? 22 : 4)) return 'Auto Crossbow is already preferred at this target count, even when refunded shot abilities hit the full pack.';
  if (id === 'BLM' && ['paradox', 'firestarter'].includes(key) && state.phase === 'cycle') return 'A neutral start has no carried proc. Choose an existing elemental phase to use this ready effect.';
  if (id === 'BLM' && key === 'manafont' && mode === 'aoe' && level >= 40 && level < 50) return 'This level’s pack loop uses Freeze. Manafont requires Astral Fire and is not part of that loop.';
  if (id === 'BLM' && key === 'paradox' && (state.phase === 'fire' || mode === 'aoe' && (state.dot || state.polyglot))) return mode === 'aoe' ? 'Thunder / Foul already provides the selected ice filler. Clear those choices to use Ice Paradox as the fallback.' : 'Ice Paradox belongs to the ice phase. Choose Full elemental cycle or Start of Umbral Ice.';
  if (id === 'BLM' && key === 'firestarter' && state.phase === 'fire') return 'This condition changes the ice-to-fire re-entry. Fire-only starts after that transition, so retain the proc for the next ice phase.';
  if (id === 'SMN' && key === 'demi' && !['fresh', 'between', 'demi'].includes(state.phase) && !state.summon) return 'This selector is used when the next demi is ready or already active. Finish the current attunement while its cooldown runs.';
  if (id === 'SMN' && key === 'summon' && state.phase === 'demi') return 'The demi / trance is already active; do not summon it again.';
  if (id === 'SMN' && key === 'primal' && state.phase === 'fresh') return 'A fresh start has no earned primal gems. Complete the demi / trance first, then select Carbuncle ready · between phases.';
  if (id === 'SMN' && key === 'primal' && (state.phase !== 'between' || state.summon)) return 'Choose the next primal between phases, after clearing Demi / trance cooldown ready.';
  if (id === 'SMN' && key === 'ruin4' && (state.phase === 'demi' || state.summon)) return 'Use the demi’s stronger replacement spells first. Further Ruin is held until between demi phases.';
  if (id === 'BLU' && key === 'freezePlan' && mode !== 'aoe') return 'This pack setup belongs to Area of effect.';
  if (id === 'BLU' && key === 'moon' && state.freezePlan === 'ultra') return 'Use the instant-death setup directly on susceptible enemies; Moon Flute adds no value to Ultravibration.';
  if (id === 'BST' && key === 'affinity' && !state.tp) return 'Select Beastmaster TP ≥ 100 before planning a player instinctual skill.';
  if (id === 'PLD' && key === 'magicReady' && state.magic) return 'The selected magic window is already active. Spend it before using another Requiescat / Imperator.';
  if (id === 'DRG' && key === 'geir' && state.life) return 'Life of the Dragon is already active. Finish that window before starting another Geirskogul.';
  if (id === 'MCH' && key === 'stabilizer' && (state.metal || state.heatPlan !== 'none')) return 'Spend the selected held Heat / Hypercharged / Full Metal readiness first, then plan a new Barrel Stabilizer.';
  if (id === 'SAM' && key === 'meikyoReady' && (state.meikyo || sen > 0)) return 'Spend held Sen or the active Meikyo first, then start a new three-stack window.';
  if (id === 'MNK' && key === 'balance' && state.blitz !== 'none') return 'Spend the already-ready Blitz first, then choose a new Perfect Balance.';
  if (id === 'RDM' && key === 'acceleration' && (state.dualcast || state.impact)) return 'Spend the selected held Dualcast / Grand Impact first, then use a new Acceleration charge.';
  if (id === 'PCT' && key === 'palette' && state.buffs) return 'Starry Muse already grants one free Subtractive Palette. Its window includes that combo.';
  if (id === 'PCT' && key === 'pull' && (state.hammer === 'active' || state.prism || state.rainbow)) return 'An active hammer or burst proc describes an existing window. Finish that window before selecting fresh pre-combat preparation.';
  if (id === 'PCT' && key === 'prepared' && !state.pull) return 'This skips the complete pre-combat painting row. In combat, the selected ready Muse or hammer already declares its painted canvas.';
  if (id === 'RPR' && key === 'harvestMoon' && !state.prepared && !state.pull) return 'Harvest Moon needs Soulsow. Mark Soulsow already prepared or include the pre-combat setup.';
  return '';
}

function baseControls(job, level, input = {}, mode = 'single') {
  const packAoe = mode === 'aoe' && targetCount(mode, input) >= 3;
  const hidePack = mode === 'aoe' && targetCount(mode, input) >= (['SCH', 'SGE', 'BLM', 'BLU'].includes(job.id) ? 2 : 3);
  const has = names => !names || Boolean(pickAction(job.actions, names, level));
  input = { ...input };
  if (job.id === 'DRK' && input.mpPlan === undefined && input.mp) input.mpPlan = input.darkside ? 'refresh' : 'spend';
  if (job.id === 'GNB' && input.cartridges === undefined && input.cartridge) input.cartridges = '1';
  if (job.id === 'NIN' && input.burst === undefined && input.buffs) input.burst = input.shadow ? 'prepared' : input.mudra ? 'prepare' : 'none';
  if (job.id === 'MCH' && input.heatPlan === undefined && input.heat) input.heatPlan = input.wildfire ? 'wildfire' : 'normal';
  if (job.id === 'RPR' && input.soulUse === undefined && input.soul) input.soulUse = 'spend';
  if (job.id === 'RPR' && typeof input.shroud === 'boolean') input.shroud = input.shroud ? 'gauge' : 'none';
  if (job.id === 'PCT' && typeof input.muse === 'boolean') input.muse = input.muse ? 'pom' : 'none';
  if (job.id === 'PCT' && typeof input.hammer === 'boolean') input.hammer = input.hammer ? 'active' : 'none';
  if (job.id === 'BLU') {
    if (input.dotPlan === undefined && input.torment && input.dot !== false) input.dotPlan = input.bristle ? 'bristled' : 'plain';
    if (input.freezePlan === undefined && input.ram) input.freezePlan = input.ultra && input.susceptible ? 'ultra' : 'ram';
  }
  if (job.id === 'BST' && typeof input.familiar === 'boolean') input.familiar = input.familiar ? 'active' : input.horn || 'first';
  const definitions = (spec[job.id] || []).map(control => job.id === 'PCT' && control.key === 'pull' ? { ...control, value: input.combat !== true } : control);
  const prepull = { MNK: ['Steeled Meditation|Forbidden Meditation', 'Fill Chakra and prepare your form before engaging.'], NIN: ['Hide', 'Use Hide outside combat to restore mudra charges. Already prepared Hidden is not recast.'], RPR: ['Soulsow', 'Prepare instant Soulsow before engaging; never hardcast it during combat for this damage plan.'], DNC: ['Standard Step', 'Prepare the two highlighted Standard Step steps before combat, then land Standard Finish on the pull.'] }[job.id];
  if (prepull) definitions.unshift(toggle('pull', 'Starting outside combat', prepull[0], prepull[1], input.combat !== true));
  const preparation = { SCH: ['Summon Eos', 'Fairy already summoned'], SGE: ['Kardia', 'Kardia already assigned'], DNC: ['Closed Position', 'Dance Partner assigned / playing solo'] }[job.id];
  if (preparation) definitions.unshift(toggle('prepared', preparation[1], preparation[0], 'Leave unchecked to include this setup before the rotation. Check once it is already complete.'));
  if (job.id === 'DRG') definitions.push(toggle('surge', 'Life Surge ready', 'Life Surge', 'Weave immediately before the strongest direct-damage weaponskill in the selected combo.'), toggle('focus', 'Two Firstminds’ Focus available', 'Wyrmwind Thrust', 'Spend the held two Focus before another enhanced starter would overcap.'));
  if (job.id === 'MNK') {
    const index = definitions.findIndex(control => control.key === 'blitz');
    definitions[index] = { ...definitions[index], options: [...definitions[index].options, ['mixed', 'Two forms · Celestial Revolution recovery', 'Celestial Revolution']] };
  }
  if (job.id === 'NIN') definitions.push(toggle('tenchijin', 'Ten Chi Jin ready · Meisui ready in single target', 'Ten Chi Jin', 'Use the three transformed ninjutsu without ordinary mudra charges. Single target ends in Suiton and funds another spender through Meisui at 72+. Packs end in Doton: keep enemies in its field.'));
  if (job.id === 'SAM') definitions.push(buffs('Ikishoten', 'Ikishoten + Kenki cooldowns ready'), choice('meditation', 'Meditation stacks currently held', [['0', '0'], ['1', '1', 'Shoha'], ['2', '2', 'Shoha'], ['3', '3 · Shoha ready', 'Shoha']], 'Iaijutsu and Ogi Namikiri add one stack at level 80+. Spend Shoha on reaching three, before another generating action.'));
  if (job.id === 'BST') definitions.push(toggle('tempered', 'Tempered Release ready', 'Tempered Release', 'Requires the summoned familiar and One with Nature; its controlled ability depends on that familiar.'), toggle('trick', 'Familiar TP ≥ 100 · use Trick', 'Trick', 'Spends the familiar’s TP independently. When player TP is also ready, select the affinity of this familiar skill for the following player combo.'), toggle('charge', 'Shield Charge ready', 'Shield Charge', 'Use one ready damage charge unless it must be reserved for movement.'));
  if (job.id === 'MCH') definitions.push(toggle('shots', 'Shot abilities ready', 'Gauss Round', 'Use one ready charge of each unlocked shot ability before Hypercharge refunds. Keep spending refunded charges between fast shots.'));
  if (job.id === 'MCH' && mode === 'aoe') definitions.push(toggle('flamethrower', 'Flamethrower ready · can channel', 'Flamethrower', 'Channel only when tools and usable Heat are unavailable and the pack remains in range. Movement ends the channel.'));
  if (job.id === 'DNC') definitions.push(toggle('flourish', 'Flourish ready', 'Flourish', 'Spend selected held procs first, then use the new guaranteed procs. At 96+, Finishing Move replaces the ordinary Standard Step in this window.'));
  if (job.id === 'BLM') definitions.push(toggle('buffs', 'Ley Lines ready', 'Ley Lines', 'Use the next clean weave, including during ice. Instant spells also benefit from its shorter recast. Plan for 20 seconds in the circle.'), toggle('amplifier', 'Amplifier ready', 'Amplifier', 'Weave in an elemental stance. Its additional Polyglot is spent separately from any held charge; that instant spell can provide a Ley Lines weave.'));
  if (job.id === 'SMN') definitions.push(toggle('drain', 'Energy Drain / Siphon ready', 'Energy Drain', 'Spend selected held stacks first, then generate and spend two new stacks. Further Ruin is used between demis or held until the active demi finishes.'));
  if (job.id === 'RDM') {
    const index = definitions.findIndex(control => control.key === 'buffs');
    definitions[index] = buffs('Corps-a-corps|Fleche|Embolden');
  }
  if (job.id === 'SGE' && mode === 'aoe') {
    definitions.push(toggle('pneuma', 'Pneuma ready · line hits the pack', 'Pneuma', 'A pack damage gain that also heals. Aim the line through the enemies; in single target reserve it for needed healing.'));
  }
  if (job.id === 'NIN') definitions.push(toggle('raid', 'Mug / Dokumori ready', 'Mug', 'This two-minute cooldown is separate from the one-minute Trick / Kunai setup.'));
  if (job.id === 'RPR') definitions.push(choice('avatar', 'Gibbet / Gallows enhancement currently held', [['none', 'Neither enhancement'], ['gibbet', 'Enhanced Gibbet · Unveiled Gibbet', 'Unveiled Gibbet'], ['gallows', 'Enhanced Gallows · Unveiled Gallows', 'Unveiled Gallows']], 'A held enhancement replaces Blood Stalk with its matching Unveiled action. A preceding Reaver weaponskill updates this state.'));
  if (mode === 'aoe') definitions.unshift({ ...choice('targets', 'Enemies hit', Array.from({ length: 23 }, (_, index) => [String(index + 2), String(index + 2) + ' enemies']), 'Use the actual count. Builders, gauge spenders, and cleaving abilities can change at different counts.'), value: '3' });
  if (mode === 'aoe' && ['WHM', 'SCH', 'AST', 'SGE', 'BRD', 'SAM'].includes(job.id)) definitions.push(choice('lifetime', 'Expected remaining target life', [['short', 'Short / uncertain · skip new DoTs'], ...[15, 18, 21, 24, 27, 30, 60].map(seconds => [String(seconds), 'At least ' + seconds + ' seconds'])], 'Apply missing DoTs to surviving, high-HP targets. Recheck while the pack is gathered; do not overwrite healthy effects.'));
  for (const [key, label, requires, parent = 'buffs'] of cooldowns[job.id] || []) definitions.push({ ...toggle(key, label + ' ready', requires, 'Independent cooldown or charge. Reserve movement and healing abilities when needed.', Boolean(input[parent] ?? spec[job.id]?.find(control => control.key === parent)?.value)), parent });
  if (job.id === 'WAR') definitions.push(toggle('infuriate', 'Infuriate ready · gauge has room', 'Infuriate', 'Spend held Nascent Chaos first. The new Infuriate generates its own 50 Beast Gauge.'));
  if (job.id === 'MNK') definitions.push(toggle('balance', 'Perfect Balance charge ready', 'Perfect Balance', 'Use after Opo-opo; complete three form weaponskills and the unlocked Blitz.'), choice('nadi', 'Nadi already open', [['none', 'Neither'], ['lunar', 'Lunar only', 'Elixir Field'], ['solar', 'Solar only', 'Flint Strike'], ['both', 'Both', 'Tornado Kick']], 'Build the missing Nadi. Both open allows the finisher after any valid three-chakra pattern.'));
  if (job.id === 'SAM') definitions.push(toggle('meikyoReady', 'Meikyo Shisui charge ready', 'Meikyo Shisui', 'Generate three new Sen directly. Existing held Meikyo remains a separate starting state.'));
  if (job.id === 'MCH') definitions.push(choice('reassembleTarget', 'Reassemble target', [['auto', 'Best ready selected tool / filler'], ['saw', 'Chain Saw ready', 'Chain Saw'], ['excavator', 'Excavator Ready already held', 'Excavator'], ['anchor', 'Hot Shot / Air Anchor ready', 'Hot Shot|Air Anchor'], ['scatter', 'Scattergun / Spread Shot', 'Spread Shot'], ['drill', 'Drill charge ready', 'Drill']], 'Use with Reassemble. Explicit choices include the named ready weaponskill; Auto uses the independently selected tool cooldowns.'));
  if (job.id === 'MCH') definitions.push(toggle('stabilizer', 'Barrel Stabilizer ready', 'Barrel Stabilizer', 'Grants a free Hypercharge and, at 100, Full Metal Machinist. Spend existing readiness first.'));
  if (job.id === 'RDM') definitions.push(toggle('acceleration', 'Acceleration charge ready', 'Acceleration', 'Makes the next eligible long spell instant, guarantees its proc, and grants Grand Impact at 96.'));
  if (mode === 'aoe' && job.id === 'MCH' && has('Auto Crossbow')) definitions.push(toggle('cleave', 'Shot-ability splash hits the whole pack', 'Ricochet', 'Checked: Ricochet, or both upgraded shot abilities at 92+, cleaves every enemy. Unchecked: only the main target is hit. Gauss Round remains single-target before 92. For partial coverage, compare actual hit counts.', true));
  const controls = definitions.map(control => control.options ? { ...control, options: control.options.filter(option => level >= (option[3] || 1)) } : control).filter(control => level >= control.min && has(control.requires) && !(job.id === 'BLM' && control.key === 'firestarter' && level < 42) && !(hidePack && hiddenInPack[job.id]?.includes(control.key))).map(control => {
    const options = control.options?.filter(option => has(option[2]) && !(job.id === 'SMN' && control.key === 'phase' && option[0] === 'between' && !has('Summon Carbuncle')) && !(job.id === 'DNC' && control.key === 'finish' && input.technical && ['tillana', 'starfall', 'dawn'].includes(option[0])) && !(job.id === 'VPR' && packAoe && (['flanksbane', 'hindsbane'].includes(option[0]) || !has(({ fang: { steel: 'Steel Maw', reaving: 'Reaving Maw' }, branch: { flanksting: 'Jagged Maw', hindsting: 'Bloodied Maw' } })[control.key]?.[option[0]]))) && !(job.id === 'BLM' && control.key === 'phase' && (mode === 'aoe' && level >= 40 && level < 50 && !['cycle', 'loop', 'ice'].includes(option[0]) || option[0] === 'fire' && !has(mode === 'aoe' && level >= 12 ? 'Fire II' : 'Fire')))).map(([value, label]) => ({ value, label: job.id === 'VPR' && packAoe && control.key === 'branch' ? value === 'flanksting' ? 'Jagged Maw / Hunter branch' : 'Bloodied Maw / Swiftskin branch' : job.id === 'RPR' && mode === 'aoe' && Number(input.targets || 3) >= 4 && control.key === 'reaver' ? ({ none: 'Not active', gibbet: 'Soul Reaver active', execGibbet: 'Executioner active' })[value] : label }));
    const fallback = job.id === 'SMN' && control.key === 'demi' && has('Summon Solar Bahamut') ? 'solar' : options?.some(option => option.value === control.value) ? control.value : options?.[0]?.value ?? control.value;
    const value = control.type === 'checkbox' ? (typeof input[control.key] === 'boolean' ? input[control.key] : job.id === 'SMN' && control.key === 'summon' && input.phase && !['fresh', 'between'].includes(input.phase) ? false : control.value)
      : options.some(option => option.value === input[control.key]) ? input[control.key] : fallback;
    return { ...control, options, value, hidden: control.type === 'select' && options.length < 2 };
  });
  const state = { ...Object.fromEntries((spec[job.id] || []).filter(control => control.type === 'select').map(control => [control.key, control.value])), ...Object.fromEntries(controls.map(control => [control.key, control.value])) };
  const conflict = exclusive[job.id];
  if (conflict?.every(key => state[key])) {
    state[conflict[1]] = false;
    controls.find(control => control.key === conflict[1]).value = false;
  }
  if (job.id === 'PCT' && state.rainbow && state.buffs) {
    state.buffs = false;
    controls.find(control => control.key === 'buffs').value = false;
  }
  for (const control of controls) {
    control.disabledReason = blockedCondition(job.id, control.key, state, mode, level, has);
    control.disabled = Boolean(control.disabledReason);
    if (control.disabled && control.type === 'checkbox') state[control.key] = control.value = false;
  }
  return controls;
}

const times = (name, count, note = '') => ({ name, count, note });

function blackMageSupport(names, job, level, state) {
  const items = names.map(item => typeof item === 'string' ? times(item, 1) : item).filter(item => pickAction(job.actions, item.name, level));
  const spell = item => pickAction(job.actions, item.name, level);
  const hardcast = item => !/Firestarter/.test(item.note) && /^(Fire(?: IV| III| II)?|Blizzard(?: IV| III| II)?|High Fire II|High Blizzard II|Freeze|Flare|Flare Star)$/.test(spell(item).name);
  const firecast = item => hardcast(item) && /^(Fire|High Fire II|Flare)/.test(spell(item).name);
  let target = items.findIndex(item => /^(Fire IV|Flare)$/.test(spell(item).name));
  if (target < 0) target = items.findIndex(item => hardcast(item) && /^(Fire|Fire II|High Fire II)$/.test(spell(item).name));
  const iceEntry = state.phase === 'loop' ? items.findIndex((item, index) => index > 0 && spell(item).name === 'Blizzard III' && spell(items[index - 1]).name === 'Transpose') : -1;
  const swiftTarget = iceEntry >= 0 ? iceEntry : target < 0 ? items.findIndex(hardcast) : target;
  let triple = 0;
  let swift = Boolean(state.moving && pickAction(job.actions, 'Swiftcast', level));
  const result = [];
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (state.triplecast && index === target) {
      result.push(times('Triplecast', 1, 'Weave · next three casts'));
      triple = 3;
    }
    if (!hardcast(item)) { result.push(item); continue; }
    let count = item.count;
    if (triple) {
      const used = Math.min(triple, count);
      result.push(times(item.name, used, 'Instant · Triplecast'));
      triple -= used;
      count -= used;
    }
    if (count && swift && index >= swiftTarget && swiftTarget >= 0 && (iceEntry >= 0 ? index === iceEntry : target < 0 || firecast(item))) {
      result.push(times('Swiftcast', 1, 'Weave · next cast'), times(item.name, 1, 'Instant · Swiftcast'));
      swift = false;
      count--;
    }
    if (count) result.push({ ...item, count });
  }
  return result;
}

function blackMageCooldowns(items, job, level, mode, state) {
  if (!state.buffs && !state.amplifier) return items;
  const action = item => pickAction(job.actions, item.name, level);
  let element = state.phase === 'fire' || state.phase === 'loop' ? 'fire' : state.phase === 'ice' ? 'ice' : '';
  let stacks = element ? 3 : 0;
  const windows = items.map((item, index) => {
    const current = action(item);
    if (current.name === 'Transpose') { element = element === 'fire' ? 'ice' : 'fire'; stacks = 1; }
    if (current.name === 'Manafont') { element = 'fire'; stacks = 3; }
    if (current.category !== 'Spell') return { capacity: 0, reserved: 0 };
    const instant = /Instant|Firestarter/.test(item.note) || current.cast === 'Instant' && !(current.name === 'Foul' && level < 80 || current.name === 'Despair' && level < 100);
    const next = /^(Fire III|Fire II|High Fire II)$/.test(current.name) ? 'fire' : /^(Blizzard III|Blizzard II|High Blizzard II)$/.test(current.name) ? 'ice' : '';
    const capacity = instant ? 2 : next && element && element !== next && stacks === 3 ? 1 : 0;
    if (next) { element = next; stacks = 3; }
    let reserved = 0;
    if (item.count === 1) for (let after = index + 1; after < items.length && action(items[after]).category === 'Ability'; after++) reserved++;
    return { capacity, reserved };
  });
  let index = windows.findIndex(window => state.amplifier
    ? window.capacity >= 1 && window.reserved <= 2 && (!state.buffs || window.capacity >= 2 || window.reserved < 2)
    : window.capacity > window.reserved);
  const clean = index >= 0;
  if (!clean) index = items.findIndex((item, position) => action(item).category === 'Spell' && windows[position].reserved < 2);
  if (index < 0) index = items.findIndex(item => action(item).category === 'Spell');
  if (index < 0) return items;
  const { capacity, reserved } = windows[index];
  const cooldowns = [];
  const clip = 'Weave · clips next spell';
  if (state.amplifier) {
    if (state.buffs && capacity >= 2) cooldowns.push(times('Ley Lines', 1, 'Weave'));
    cooldowns.push(times('Amplifier', 1, clean ? 'Weave' : clip), times(mode === 'aoe' ? 'Foul' : 'Xenoglossy', 1));
    if (state.buffs && capacity < 2) cooldowns.push(times('Ley Lines', 1, reserved < 2 ? 'Weave' : clip));
  } else cooldowns.push(times('Ley Lines', 1, clean ? 'Weave' : clip));
  const item = items[index];
  return [...items.slice(0, index), { ...item, count: 1 }, ...cooldowns, ...(item.count > 1 ? [{ ...item, count: item.count - 1 }] : []), ...items.slice(index + 1)];
}

export function buildRotation(job, level, mode, input = {}) {
  const controls = baseControls(job, level, input, mode);
  const state = { ...Object.fromEntries((spec[job.id] || []).filter(control => control.type === 'select').map(control => [control.key, control.value])), ...Object.fromEntries(controls.map(control => [control.key, control.value])) };
  const has = names => Boolean(pickAction(job.actions, names, level));
  const targets = targetCount(mode, state);
  const pack = mode === 'aoe';
  const aoe = targets >= 3;
  const life = Number(state.lifetime) || 0;
  const rows = [];
  const notes = [];
  function add(id, title, names, reason, type = 'gcd') {
    const steps = names.flatMap(item => {
      const value = typeof item === 'string' ? { name: item, count: 1, note: '' } : item;
      const action = pickAction(job.actions, value.name, level);
      return action ? [{ ...value, action }] : [];
    });
    if (steps.length) rows.push({ id, title, steps, reason, type });
  }
  const weave = (id, names, reason) => add(id, ({ buffs: 'Use ready damage cooldowns', shots: 'Use ready shot abilities', pitch: 'Spend Repertoire', song: 'Start or change song' })[id] || (names.length === 1 ? `Use ${pickAction(job.actions, names[0], level)?.name || 'the ready ability'}` : 'Use ready damage abilities'), names, reason, 'weave');
  const preparation = { SCH: ['Summon Eos', 'Summon your fairy', 'Summon Eos before combat, or resummon after a death. Skip when the fairy is already present.'], SGE: ['Kardia', 'Assign Kardia', 'Choose the appropriate tank or party member before attacking, so damaging spells also heal them.'], DNC: ['Closed Position', 'Choose your Dance Partner', 'Assign Closed Position to your chosen party member before the dance window. In solo play, mark this setup complete to skip it.'] }[job.id];
  if (preparation && !state.prepared) add('setup', preparation[1], [preparation[0]], preparation[2]);
  if (job.id === 'MNK') add('setup', 'Prepare Chakra and your opening form', [...(state.pull && !state.chakra ? ['Steeled Meditation|Forbidden Meditation'] : []), ...(state.form === 'none' && state.blitz === 'none' ? ['Form Shift'] : [])], 'Outside combat, Meditation fills all five Chakra. Form Shift grants the opening form bonus when no form is active. Already held resources are not generated again.');
  if (job.id === 'NIN' && state.pull && state.burst !== 'prepared') add('setup', 'Restore mudra before combat', ['Hide'], 'Hide restores mudra charges outside combat. It ends on the next action; Suiton / Huton later supplies Shadow Walker when that burst setup is selected.');
  if (job.id === 'RPR' && state.pull && !state.prepared) add('setup', 'Prepare Soulsow before combat', ['Soulsow'], 'Soulsow is instant outside combat and prepares Harvest Moon. Skip when already prepared; do not hardcast it during combat for this plan.');
  if (job.id === 'DNC' && state.pull && state.standard) add('prepull', 'Prepare Standard Step before combat', [times('Standard Step', 1, 'Perform two highlighted steps before pull')], 'Prepare the random highlighted steps before combat. The following Standard Finish lands on the pull; do not start Technical Step before that finish.');
  if (job.id === 'SMN' && state.phase === 'fresh' && has('Summon Carbuncle')) add('setup', 'Summon Carbuncle, then engage', ['Summon Carbuncle', times(aoe && has('Outburst') ? 'Outburst|Tri-disaster' : 'Ruin|Ruin II|Ruin III', 1, 'Precast to start combat')], 'Carbuncle enables your summons. Land the opening damage spell before combat-only Aethercharge at lower levels; the precast is also the usual high-level pull.');
  switch (job.id) {
    case 'PLD': {
      if (state.buffs || state.magicReady || state.circle || state.spirits || state.intervene) weave('buffs', [...(state.buffs ? ['Fight or Flight'] : []), ...(state.magicReady ? ['Requiescat|Imperator'] : []), ...(state.circle ? ['Circle of Scorn'] : []), ...(state.spirits ? ['Spirits Within|Expiacion'] : []), ...(state.intervene ? ['Intervene'] : [])], 'Start Fight or Flight on cooldown; Imperator grants your magic window. Use the selected ready Intervene charge when it is not needed for movement.');
      if (state.divine && (state.magic || state.magicReady) && level < 90) add('divine-first', 'Spend Divine Might before Requiescat stacks', [aoe && has('Holy Circle') ? 'Holy Circle' : 'Holy Spirit'], 'Divine Might takes priority over Requiescat. Consume it separately so the following four spells can spend all four Requiescat stacks.');
      if ((state.magicReady || state.magic) && has('Requiescat|Imperator')) add('magic', 'Use your magic window', level >= 90 ? ['Confiteor', 'Blade of Faith', 'Blade of Truth', 'Blade of Valor', 'Blade of Honor'] : level >= 80 ? ['Confiteor', times(aoe ? 'Holy Circle' : 'Holy Spirit', 3)] : [times(aoe && level >= 72 ? 'Holy Circle' : 'Holy Spirit', 4)], 'Requiescat / Imperator makes these available. Blade of Honor is a weave after Blade of Valor.');
      if (state.buffs) add('goring', 'Use Goring Blade during Fight or Flight', ['Goring Blade'], 'Use the granted Goring Blade while the damage buff is active.');
      if (state.atonement && !aoe) add('atonement', 'Spend Atonement Ready', ['Atonement', 'Supplication', 'Sepulchre'], 'Use the granted chain before the next Royal Authority.');
      if (state.divine && !(level < 90 && (state.magic || state.magicReady))) add('divine', 'Spend Divine Might', [aoe && has('Holy Circle') ? 'Holy Circle' : 'Holy Spirit'], 'The enhanced spell is instant.');
      add('filler', 'Build your next combo', aoe && has('Total Eclipse') ? ['Total Eclipse', 'Prominence'] : ['Fast Blade', 'Riot Blade', 'Rage of Halone|Royal Authority'], 'Finish the combo; Royal Authority grants the procs above. Recheck them before repeating.');
      break;
    }
    case 'WAR': {
      if (state.chaos) add('chaos', 'Spend Nascent Chaos', [aoe || !has('Inner Chaos') ? 'Chaotic Cyclone' : 'Inner Chaos'], 'Use the Infuriate-enhanced action before generating another proc.');
      if (state.tempest && !aoe) add('tempest', 'Refresh Surging Tempest', ['Heavy Swing', 'Maim', "Storm's Eye"], 'Keep the damage buff active without exceeding its duration cap.');
      if (state.buffs || state.upheaval || state.onslaught) weave('buffs', [...(state.buffs ? ['Berserk|Inner Release'] : []), ...(state.upheaval ? [targets >= 3 && has('Orogeny') ? 'Orogeny' : 'Upheaval'] : []), ...(state.onslaught ? ['Onslaught'] : [])], 'Keep the damage window rolling. Use Orogeny on packs, Upheaval on a single target. Reserve an Onslaught charge when movement requires it.');
      if (state.release || (state.buffs && has('Inner Release'))) add('release', 'Spend Inner Release', [times(aoe ? 'Steel Cyclone|Decimate' : 'Inner Beast|Fell Cleave', 3), 'Primal Wrath'], 'Use the three free spenders. Primal Wrath is a weave granted after the third at level 96. Held stacks do not imply that Primal Rend is still ready.');
      if (state.rend || state.buffs) add('rend', 'Spend Primal Rend Ready', ['Primal Rend', 'Primal Ruination'], 'Requires the selected held readiness or the new Inner Release above. Primal Rend grants Primal Ruination at level 100.');
      if (state.gauge) add('gauge', 'Spend Beast Gauge', [aoe && has('Steel Cyclone') ? 'Steel Cyclone|Decimate' : 'Inner Beast|Fell Cleave'], 'Spend under buffs or before gauge would overcap. Inner Release’s free spenders do not consume this gauge.');
      if (state.infuriate) add('infuriate', 'Generate and spend new Beast Gauge', ['Infuriate', level >= 72 ? targets >= 3 || !has('Inner Chaos') ? 'Chaotic Cyclone' : 'Inner Chaos' : aoe && has('Steel Cyclone') ? 'Steel Cyclone' : 'Inner Beast|Fell Cleave'], 'The new Infuriate adds 50 gauge. Existing Nascent Chaos and the separately selected gauge have already been spent.');
      add('filler', 'Build gauge', aoe && has('Overpower') ? ['Overpower', 'Mythril Tempest'] : ['Heavy Swing', 'Maim', "Storm's Path"], 'Finish this combo while Surging Tempest has enough time remaining.');
      break;
    }
    case 'DRK': {
      const earlyMp = state.mpPlan === 'spend' && state.shadow && has('Shadowbringer') && !state.darkside;
      if (state.mpPlan === 'refresh' || earlyMp) weave('darkside', [aoe || !has('Edge of Darkness') ? 'Flood of Darkness|Flood of Shadow' : 'Edge of Darkness|Edge of Shadow'], 'Activate Darkside before dependent damage, using the selected 3,000 MP or Dark Arts.');
      if (state.buffs || state.living || state.carve || state.salt || state.shadow) weave('buffs', [...(state.buffs ? ['Blood Weapon|Delirium'] : []), ...(state.living ? ['Living Shadow'] : []), ...(state.carve ? [aoe ? 'Abyssal Drain' : 'Carve and Spit'] : []), ...(state.salt ? ['Salted Earth', 'Salt and Darkness'] : []), ...(state.shadow && (state.darkside || state.mpPlan !== 'hold') ? ['Shadowbringer'] : [])], 'Use ready damage cooldowns. Salt and Darkness follows the placed Salted Earth; Shadowbringer requires active Darkside.');
      if (state.shadow && has('Shadowbringer') && !state.darkside && state.mpPlan === 'hold') notes.push('Shadowbringer is held because Darkside is absent. Select an MP spend or mark Darkside already active to include it.');
      if (state.living) add('disesteem', 'Spend Scorn', ['Disesteem'], 'Living Shadow grants Scorn. Use Disesteem under buffs before it expires.');
      if (state.delirium || state.buffs && has('Delirium')) add('delirium', 'Spend Delirium', aoe ? [times(level >= 96 ? 'Impalement' : 'Quietus', 3)] : level >= 96 ? ['Scarlet Delirium', 'Comeuppance', 'Torcleaver'] : [times('Bloodspiller', 3)], 'These actions require the selected Delirium window; below level 96 use the free gauge spenders.');
      if (state.blood) add('blood', 'Spend Blood Gauge', [aoe && has('Quietus') ? 'Quietus' : 'Bloodspiller'], 'Spend during buffs or before overcap. Before Quietus unlocks, Bloodspiller is the available gauge spender in packs too.');
      if (state.mpPlan === 'spend' && !earlyMp) weave('mp', [aoe || !has('Edge of Darkness') ? 'Flood of Darkness|Flood of Shadow' : 'Edge of Darkness|Edge of Shadow'], 'Spend surplus MP during buffs or before overcap; retain MP needed for The Blackest Night.');
      add('filler', 'Build Blood and MP', (targets >= 3 || targets === 2 && level >= 40 && level < 94) && has('Unleash') ? ['Unleash', 'Stalwart Soul'] : ['Hard Slash', 'Syphon Strike', 'Souleater'], 'Keep the combo moving between resource spenders.');
      break;
    }
    case 'GNB': {
      const bloodfestGain = level >= 88 ? 3 : 2;
      let cartridges = Number(state.cartridges) + (state.bloodfest ? bloodfestGain : 0);
      if (state.bloodfest) weave('bloodfest', ['Bloodfest'], `Adds ${bloodfestGain} cartridges with temporary extra capacity; at 100 also grants Ready to Reign.`);
      if (state.buffs || state.zone || state.bow) weave('buffs', [...(state.buffs ? ['No Mercy'] : []), ...(state.zone ? ['Danger Zone|Blasting Zone'] : []), ...(state.bow ? ['Bow Shock'] : [])], 'Place your strongest available weaponskills in No Mercy.');
      if (state.double && cartridges >= 2 && has('Double Down')) {
        add('double', 'Use Double Down under No Mercy', ['Double Down'], 'Spend two cartridges on this hard cooldown before flexible granted actions.');
        cartridges -= 2;
      }
      if (state.reign || state.bloodfest) add('reign', 'Spend Ready to Reign', ['Reign of Beasts', 'Noble Blood', 'Lion Heart'], 'Use the granted combo under No Mercy. Complete it before starting Gnashing Fang.');
      if (state.buffs) add('sonic', 'Spend Ready to Break', ['Sonic Break'], 'No Mercy grants this action.');
      if (state.gnashing && cartridges >= 1) {
        add('gnashing', 'Use Gnashing Fang', ['Gnashing Fang', 'Jugular Rip', 'Savage Claw', 'Abdomen Tear', 'Wicked Talon', 'Eye Gouge'], 'Spend one cartridge. Weave each Continuation after its matching weaponskill. Do not interrupt this combo with Reign or a builder.');
        cartridges--;
      }
      if (cartridges > 0) add('cartridge', 'Spend a remaining cartridge when needed', [targets >= 2 && has('Fated Circle') ? 'Fated Circle' : 'Burst Strike', targets >= 2 && has('Fated Circle') ? 'Fated Brand' : 'Hypervelocity'], `${cartridges} cartridge${cartridges === 1 ? '' : 's'} remain after the planned cooldowns. Spend under No Mercy or before the next builder would overcap. The Continuation follow-up is a weave.`);
      if (state.gnashing && cartridges === 0 && !rows.some(row => row.id === 'gnashing')) notes.push('Double Down used the available cartridges. Build another before the selected Gnashing Fang.');
      add('filler', 'Build cartridges', aoe && has('Demon Slice') ? ['Demon Slice', 'Demon Slaughter'] : ['Keen Edge', 'Brutal Shell', 'Solid Barrel'], 'Avoid overcapping the cartridge gauge.');
      break;
    }
    case 'WHM': {
      if (state.dot && (!pack || life >= Math.max(15, 3 * Math.ceil((150 * targets - 60) / 70)))) add('dot', 'Refresh your DoT', ['Aero|Aero II|Dia'], 'Apply only when missing or expiring.');
      if (state.buffs || state.assize) weave('buffs', [...(state.buffs ? ['Presence of Mind'] : []), ...(state.assize ? ['Assize'] : [])], 'Use ready damage cooldowns; Presence of Mind grants Sacred Sight at 92.');
      if (state.misery) add('misery', 'Spend the Blood Lily', ['Afflatus Misery'], 'Useful for damage and movement; requires the selected Blood Lily.');
      if (state.sight || (state.buffs && has('Glare IV'))) add('sight', 'Spend Sacred Sight', [times('Glare IV', state.buffs ? 3 : 1)], 'Presence of Mind grants three uses; an already-active partial buff shows one use. Spend remaining stacks before expiry.');
      add('filler', 'Cast your damage filler', [...(state.moving ? ['Swiftcast'] : []), times(aoe && has('Holy') ? 'Holy|Holy III' : 'Stone|Stone II|Stone III|Stone IV|Glare|Glare III', 1, state.moving ? 'Instant · Swiftcast' : '')], state.moving ? 'Weave Swiftcast immediately before this filler. In progression, consider reserving it for Raise.' : 'Fill time between DoT refreshes and healing.');
      notes.push('Healing takes priority when needed. Lily heals build the Blood Lily; do not cast damage instead of required healing.');
      break;
    }
    case 'SCH': {
      if (state.dot && (!pack || targets <= 4 && life >= 6 * targets + 3)) add('dot', pack ? 'Spread the DoT to surviving targets' : 'Refresh your DoT', [times('Bio|Bio II|Biolysis', pack ? targets : 1, pack ? 'Different high-HP target each cast' : '')], 'Apply only when missing or expiring.');
      if (state.buffs) weave('buffs', ['Chain Stratagem'], 'Keep Chain Stratagem aligned with two-minute party buffs.');
      if (state.impact || state.buffs) weave('impact', ['Baneful Impaction'], 'Chain Stratagem grants Impact Imminent; spend before it expires.');
      if (state.energy) weave('energy', ['Energy Drain'], 'Only consume Aetherflow not required for healing.');
      add('filler', state.moving && !aoe ? 'Use instant movement filler' : 'Cast your damage filler', [targets >= 2 && has('Art of War') ? 'Art of War|Art of War II' : state.moving && has('Ruin II') ? 'Ruin II' : 'Ruin|Broil|Broil II|Broil III|Broil IV'], 'Return to Broil when stationary; Ruin II is a movement or weaving fallback.');
      notes.push('Keep the fairy active and plan healing resources before spending spare Aetherflow on damage.');
      break;
    }
    case 'AST': {
      if (state.dot && (!pack || life >= Math.max(15, 6 * targets))) add('dot', pack ? 'Spread Combust to surviving targets' : 'Refresh Combust', [times('Combust|Combust II|Combust III', pack ? targets : 1, pack ? 'Different high-HP target each cast' : '')], 'Apply only when missing or expiring.');
      if (state.buffs) weave('buffs', ['Divination'], 'Keep the two-minute damage buff aligned with your party.');
      if (state.star) add('star', 'Place Earthly Star, then detonate when grown', ['Earthly Star', times('Stellar Detonation', 1, 'Wait at least 10s · keep casting meanwhile')], 'Place the ready star where the party and enemies will remain. Continue normal GCDs while it grows; detonate after ten seconds, or let it resolve automatically at twenty. Detonate earlier only for needed healing.', 'weave');
      if (state.oracle || state.buffs) weave('oracle', ['Oracle'], 'Divination grants Divining; use Oracle within the damage-buff window.');
      if (state.card !== 'none') weave('card', [state.card === 'balance' ? 'The Balance' : 'The Spear'], 'Play the held damage card on an appropriate party member; do not cast an unheld card.');
      if (state.lord) weave('lord', ['Lord of Crowns'], 'Use your held Lord without overwriting it with the next draw.');
      add('filler', 'Cast your damage filler', [targets >= 2 && has('Gravity') ? 'Gravity|Gravity II' : 'Malefic|Malefic II|Malefic III|Malefic IV|Fall Malefic'], 'Keep casting while handling required healing and card play.');
      break;
    }
    case 'SGE': {
      if (state.dot && (!pack || life >= 15)) {
        const spread = pack && (targets === 2 || !has('Eukrasian Dyskrasia'));
        const names = spread ? Array.from({ length: targets }, () => ['Eukrasia', times('Eukrasian Dosis|Eukrasian Dosis II|Eukrasian Dosis III', 1, 'Different surviving target')]).flat() : ['Eukrasia', pack ? 'Eukrasian Dyskrasia' : 'Eukrasian Dosis|Eukrasian Dosis II|Eukrasian Dosis III'];
        add('dot', spread ? 'Spread Eukrasian Dosis' : 'Apply the appropriate DoT', names, 'Your Eukrasian Dosis and Eukrasian Dyskrasia cannot coexist on one target. Spread Dosis on two surviving enemies; use the area effect for larger gathered packs. Skip short-lived enemies.');
      }
      if (state.buffs) weave('buffs', ['Psyche'], 'Use the ready damaging ability between GCDs.');
      if (state.phlegma) add('phlegma', 'Spend a Phlegma charge', ['Phlegma|Phlegma II|Phlegma III'], 'Use within range during buffs or before charges cap.');
      if (state.pneuma && targets >= 2) add('pneuma', 'Use Pneuma through the pack', ['Pneuma'], 'The line attack is a gain over Dyskrasia against a pack and also heals nearby allies. Aim through the enemies; keep required healing available.');
      if (state.addersting) add('toxikon', 'Spend Addersting', ['Toxikon|Toxikon II'], 'Use the selected instant cast for planned movement or cleave.');
      add('filler', 'Cast your damage filler', [...(state.moving ? ['Swiftcast'] : []), times(targets >= 2 && has('Dyskrasia') ? 'Dyskrasia|Dyskrasia II' : 'Dosis|Dosis II|Dosis III', 1, state.moving ? 'Instant · Swiftcast' : '')], 'Keep Kardia on the appropriate party member; healing takes priority when needed. Swiftcast, when selected, applies to this filler.');
      break;
    }
    case 'MNK': {
      if (state.buffs || state.brotherhood) weave('buffs', [...(state.buffs ? ['Riddle of Fire'] : []), ...(state.brotherhood ? ['Brotherhood'] : [])], 'Align ready damage buffs; use Perfect Balance after an Opo-opo GCD as described in the guide.');
      if (state.wind) weave('wind', ['Riddle of Wind'], 'Use on cooldown; its 90-second timer does not always align with Riddle of Fire.');
      if (state.chakra || state.pull) weave('chakra', [targets >= (level < 54 ? 2 : level < 74 ? 4 : 3) && has('Howling Fist') ? 'Howling Fist|Enlightenment' : 'Steel Peak|The Forbidden Chakra'], 'Spend five held Chakra, or the five generated by the included pre-combat Meditation, before overcap.');
      if (state.wind) add('wind-reply', 'Spend Wind’s Rumination', ['Wind’s Reply'], 'Use the granted reply before expiry; it does not change your form.');
      if (state.blitz !== 'none') add('blitz', 'Use your ready Blitz', [state.blitz === 'both' ? 'Tornado Kick|Phantom Rush' : state.blitz === 'solar' ? 'Flint Strike|Rising Phoenix' : state.blitz === 'mixed' ? 'Celestial Revolution' : 'Elixir Field|Elixir Burst'], 'Requires three filled Beast Chakra and the selected pattern / Nadi. Two different forms produce the recovery Celestial Revolution rather than a matching-form or three-form Blitz. Recheck your next form afterwards.');
      const forms = ['opo', 'raptor', 'coeurl'];
      const start = state.blitz !== 'none' || state.balance && has('Elixir Field') ? 0 : state.balance ? 1 : Math.max(0, forms.indexOf(state.form));
      const large = aoe && (Number(state.targets) >= 4 || level < 92);
      const names = { opo: aoe && has('Arm of the Destroyer') ? 'Arm of the Destroyer|Shadow of the Destroyer' : state.opo || !has('Dragon Kick') ? 'Bootshine|Leaping Opo' : 'Dragon Kick', raptor: large && has('Four-point Fury') ? 'Four-point Fury' : state.raptor || !has('Twin Snakes') ? 'True Strike|Rising Raptor' : 'Twin Snakes', coeurl: large && has('Rockbreaker') ? 'Rockbreaker' : state.coeurl || !has('Demolish') ? 'Snap Punch|Pouncing Coeurl' : 'Demolish' };
      if (state.balance) {
        const pattern = state.nadi === 'lunar' ? [names.opo, names.raptor, names.coeurl] : [names.opo, aoe ? names.opo : state.opo ? 'Dragon Kick' : 'Bootshine|Leaping Opo', names.opo];
        const blitz = state.nadi === 'both' ? 'Tornado Kick|Phantom Rush' : state.nadi === 'lunar' ? 'Flint Strike|Rising Phoenix' : 'Elixir Field|Elixir Burst';
        const currentForm = Math.max(0, forms.indexOf(state.form));
        const entry = currentForm ? [...forms.slice(currentForm), 'opo'].map(form => names[form]) : [names.opo];
        add('balance', 'Generate the next Blitz with Perfect Balance', [...entry, 'Perfect Balance', ...pattern, blitz], 'Land Opo-opo, weave Perfect Balance, then complete three form weaponskills. Build the missing Nadi; with both open, use the finisher. The resulting Blitz grants Formless Fist.');
      }
      const sequence = [...forms.slice(start), ...forms.slice(0, start)].flatMap(form => form === 'opo' && state.buffs && has('Fire’s Reply') ? [names.opo, 'Fire’s Reply', aoe ? names.opo : state.opo ? 'Dragon Kick' : 'Bootshine|Leaping Opo'] : [names[form]]);
      add('forms', 'Advance through your forms', sequence, 'Spend Fury when present, otherwise generate it. A ready Blitz grants Formless Fist: restart with Opo-opo. Place Fire’s Reply after an Opo-opo action and use its Formless Fist for another Opo-opo. Recheck the gauge afterwards.');
      if (aoe) notes.push('At level 92+, three targets use single-target Raptor / Coeurl actions; four or more use the full AoE form cycle.');
      break;
    }
    case 'DRG': {
      if (state.buffs || state.litany || state.geir || state.jump || state.dragonfire) weave('buffs', [...(state.buffs ? ['Lance Charge'] : []), ...(state.litany ? ['Battle Litany'] : []), ...(state.geir ? ['Geirskogul'] : []), ...(state.jump ? ['Jump|High Jump', 'Mirage Dive'] : []), ...(state.dragonfire ? ['Dragonfire Dive', 'Rise of the Dragon'] : [])], 'Use Lance Charge and Battle Litany before Geirskogul, then put the ready jumps inside its damage window. Spread these abilities across legal weave slots. Mirage Dive follows Jump; Rise follows Dragonfire Dive. Keep the GCD rolling.');
      if (state.life || (state.geir && has('Nastrond'))) weave('life', ['Nastrond', times('Stardiver', 1, 'Single weave · long animation'), times('Starcross', 1, 'Weave after next GCD')], 'Geirskogul grants Life of the Dragon. Use Nastrond once and Stardiver, then Starcross. Give Stardiver its own weave window; use Starcross after the next GCD.');
      if (state.focus) weave('focus', ['Wyrmwind Thrust'], 'Spend the selected two Firstminds’ Focus before another Raiden Thrust / Draconian Fury would overcap.');
      const starter = state.draconian ? 'Raiden Thrust' : 'True Thrust';
      const buffCombo = [starter, 'Disembowel|Spiral Blow', 'Chaos Thrust|Chaotic Spring', 'Wheeling Thrust', level >= 64 ? 'Fang and Claw|Drakesbane' : ''];
      const damageCombo = [starter, 'Vorpal Thrust|Lance Barrage', "Full Thrust|Heavens' Thrust", 'Fang and Claw', level >= 64 ? 'Wheeling Thrust|Drakesbane' : ''];
      const combo = (aoe && has('Doom Spike') ? [state.draconian && has('Draconian Fury') ? 'Draconian Fury' : 'Doom Spike', 'Sonic Thrust', 'Coerthan Torment'] : state.refresh ? buffCombo : damageCombo).filter(has);
      if (targets === 2 && has('Disembowel')) combo.splice(0, combo.length, ...buffCombo.filter(has), ...buffCombo.map((name, index) => !index && has('Raiden Thrust') ? 'Raiden Thrust' : name).filter(has));
      if (state.surge) {
        const potency = name => Number(pickAction(job.actions, name, level).description.match(/Combo Potency: ([\d,]+)|potency of ([\d,]+)/i)?.slice(1).find(Boolean)?.replaceAll(',', '') || 0);
        const strongest = combo.reduce((best, name, index) => potency(name) > potency(combo[best]) ? index : best, 0);
        combo.splice(strongest, 0, 'Life Surge');
      }
      add('combo', 'Complete the selected combo', combo, 'Alternate the buff / DoT chain with the direct-damage chain. Follow the highlighted fourth and fifth actions at your level. Selected Life Surge goes immediately before the strongest direct hit.');
      break;
    }
    case 'NIN': {
      const kassatsu = aoe ? level >= 76 ? ['Chi', 'Ten', 'Goka Mekkyaku'] : ['Chi', 'Ten', 'Katon'] : level >= 76 ? ['Ten', 'Jin', 'Hyosho Ranryu'] : has('Raiton') ? ['Ten', 'Chi', 'Raiton'] : ['Ten', 'Fuma Shuriken'];
      const spendKassatsu = () => add('kassatsu', 'Use Kassatsu ninjutsu', kassatsu, 'Kassatsu must already be active. Spend its free ninjutsu before another ninjutsu consumes the status; do not weave between signs.');
      if (state.raid && state.burst !== 'prepared') weave('raid', ['Mug|Dokumori'], 'Use the ready two-minute cooldown. Avoid overcapping Ninki when it generates gauge.');
      if (state.kassatsu && state.burst === 'prepare') spendKassatsu();
      if (state.burst !== 'none') {
        if (state.burst === 'prepare') add('suiton', 'Prepare Shadow Walker', aoe && has('Huton') ? ['Jin', 'Chi', 'Ten', 'Huton'] : ['Ten', 'Chi', 'Jin', 'Suiton'], 'This setup includes one ready ninjutsu charge. Complete all signs before using the granted burst debuff.');
        weave('buffs', ['Trick Attack|Kunai’s Bane', 'Assassinate|Dream Within a Dream'], 'The selected setup supplies Hidden / Shadow Walker. Mug / Dokumori has its own two-minute readiness condition.');
      }
      if (state.raid && state.burst === 'prepared') weave('raid', ['Mug|Dokumori'], 'Use the prepared Hidden-gated attack first: Mug / Dokumori would remove Hidden. Then apply this separate two-minute cooldown.');
      if (state.bunshin) add('bunshin', 'Use Bunshin and its granted attack', ['Bunshin', 'Phantom Kamaitachi'], 'Bunshin uses its own reserved 50 Ninki and grants Phantom Kamaitachi at 82+. Do not spend the same Ninki again.');
      if (state.kassatsu && state.burst !== 'prepare') spendKassatsu();
      if (state.mudra) add('mudra', 'Spend the separate ninjutsu charge', aoe && has('Katon') ? ['Chi', 'Ten', 'Katon'] : has('Raiton') ? ['Ten', 'Chi', 'Raiton', 'Fleeting Raiju'] : ['Ten', 'Fuma Shuriken'], 'Complete the signs without interruption. At 90+, spend the Raiton-granted Raiju before other weaponskills remove it. Kassatsu uses a separate free cast.');
      if (state.tenchijin) add('tenchijin', 'Use the three transformed Ten Chi Jin actions', ['Ten Chi Jin', 'Fuma Shuriken', aoe ? 'Katon' : 'Raiton', aoe ? 'Doton' : 'Suiton', 'Tenri Jindo', ...(!aoe && has('Meisui') ? ['Meisui', state.raid ? 'Bhavacakra|Zesho Meppo' : 'Bhavacakra'] : []), ...(!aoe ? ['Fleeting Raiju'] : [])], 'Ten Chi Jin replaces the mudra with these ninjutsu: no ordinary signs or charges are spent. Finish all three before other actions. Single target uses Ten → Chi → Jin, then Meisui consumes Shadow Walker and funds the extra spender. Packs use Jin → Ten → Chi and end in Doton; keep enemies in its field. Spend Raiton’s Raiju before base weaponskills.');
      const higi = state.raid && !(state.tenchijin && !aoe && has('Meisui'));
      if (state.ninki) weave('ninki', [aoe || !has('Bhavacakra') ? higi ? 'Hellfrog Medium|Deathfrog Medium' : 'Hellfrog Medium' : higi ? 'Bhavacakra|Zesho Meppo' : 'Bhavacakra'], 'Spend the selected Ninki during buffs or before overcap. Dokumori grants one upgraded Higi spender; if the Meisui-funded spender used it, this separate spender returns to the base action.');
      add('filler', state.kazematoi ? 'Spend Kazematoi' : 'Build Kazematoi', aoe && has('Death Blossom') ? ['Death Blossom', 'Hakke Mujinsatsu'] : ['Spinning Edge', 'Gust Slash', state.kazematoi || !has('Armor Crush') ? 'Aeolian Edge' : 'Armor Crush'], 'Use Armor Crush when you need Kazematoi; use Aeolian Edge when stacks are available.');
      break;
    }
    case 'SAM': {
      const count = Number(Boolean(state.setsu)) + Number(Boolean(state.getsu)) + Number(Boolean(state.ka));
      const multi = aoe && has('Fuga|Fuko');
      let meditation = Number(state.meditation || 0);
      if (meditation === 3) { weave('meditation', ['Shoha'], 'Spend the selected three held Meditation stacks before another Iaijutsu / Ogi would overcap.'); meditation = 0; }
      if (state.buffs) weave('buffs', ['Ikishoten', ...(has('Zanshin') ? ['Zanshin'] : has('Hissatsu: Guren') ? [targets >= 2 || !has('Hissatsu: Senei') ? 'Hissatsu: Guren' : 'Hissatsu: Senei', aoe ? 'Hissatsu: Kyuten' : 'Hissatsu: Shinten'] : [times(aoe ? 'Hissatsu: Kyuten' : 'Hissatsu: Shinten', 2)])], 'Ikishoten supplies 50 Kenki. At 96+, Zanshin spends it; below 96, split those 50 Kenki between the ready long-cooldown spender and Shinten / Kyuten.');
      if (state.meikyoReady) weave('meikyo-ready', ['Meikyo Shisui'], 'The ready charge grants three combo-bypass stacks; this is separate from an already active window.');
      if (state.ogi || state.buffs) add('ogi', 'Spend Ogi Namikiri Ready', ['Ogi Namikiri', 'Kaeshi: Namikiri'], 'Use the selected held readiness or the one granted by the new Ikishoten.');
      if (state.kenki) weave('kenki', [state.buffs && has('Zanshin') ? targets >= 2 ? 'Hissatsu: Guren' : 'Hissatsu: Senei' : aoe && has('Hissatsu: Kyuten') ? 'Hissatsu: Kyuten' : 'Hissatsu: Shinten'], 'This separate 25 Kenki funds the selected spender. During the new high-level window, use the ready Senei / Guren; otherwise use Shinten / Kyuten.');
      if (!aoe && count === 1 && state.dot && (!pack || life >= 60)) add('iaijutsu', 'Apply Higanbana', ['Higanbana'], 'One Sen is selected and the DoT needs refreshing. Ensure Fugetsu is active.');
      else if (count === 3) add('iaijutsu', 'Spend three Sen', [state.tendo ? 'Tendo Setsugekka' : 'Midare Setsugekka', state.tendo ? 'Tendo Kaeshi Setsugekka' : 'Kaeshi: Setsugekka'], 'Use the selected Iaijutsu, followed by its available Tsubame-gaeshi action. In packs, return to the two-Sen loop afterwards.');
      else if (aoe && count === 2) add('iaijutsu', 'Spend two Sen', [state.tendo ? 'Tendo Goken' : 'Tenka Goken', state.tendo ? 'Tendo Kaeshi Goken' : 'Kaeshi: Goken'], 'Use the AoE Iaijutsu, then its granted Tsubame-gaeshi follow-up.');
      else {
        const chains = multi ? [...(!state.getsu ? [['Fuga|Fuko', 'Mangetsu']] : []), ...(!state.ka ? [['Fuga|Fuko', 'Oka']] : [])] : [...(!state.getsu ? [['Hakaze|Gyofu', 'Jinpu', 'Gekko']] : []), ...(!state.ka ? [['Hakaze|Gyofu', 'Shifu', 'Kasha']] : []), ...(!state.setsu ? [['Hakaze|Gyofu', 'Yukikaze']] : [])];
        if (!(state.meikyo || state.meikyoReady) && !multi && !state.getsu && !state.ka) chains.sort((a, b) => Number(b.at(-1) === 'Kasha') - Number(a.at(-1) === 'Kasha'));
        const selected = multi ? chains.slice(0, Math.max(1, 2 - count)) : chains;
        const names = selected.flatMap(chain => state.meikyo || state.meikyoReady ? [chain.at(-1)] : chain);
        add('sen', 'Build the missing Sen', names.length ? names : ['Hakaze|Gyofu', 'Jinpu', 'Gekko'], 'Avoid overwriting Sen you already hold. Maintain Fugetsu and Fuka; recheck Iaijutsu once the required Sen are built.');
      }
      if (state.meikyoReady) add('generated-iaijutsu', 'Spend the newly generated Sen', [multi ? has('Tendo Goken') ? 'Tendo Goken' : 'Tenka Goken' : has('Tendo Setsugekka') ? 'Tendo Setsugekka' : 'Midare Setsugekka', multi ? has('Tendo Kaeshi Goken') ? 'Tendo Kaeshi Goken' : 'Kaeshi: Goken' : has('Tendo Kaeshi Setsugekka') ? 'Tendo Kaeshi Setsugekka' : 'Kaeshi: Setsugekka'], 'Meikyo supplied the finishers and, at the appropriate level, Tendo. In AoE, one Meikyo stack remains after this two-Sen attack.');
      if (has('Shoha')) for (const row of rows) row.steps = row.steps.flatMap(step => {
        if (/Grants a stack of Meditation/i.test(step.action.description)) meditation++;
        if (meditation < 3) return [step];
        meditation = 0;
        return [step, { name: 'Shoha', count: 1, note: 'Weave · third Meditation stack', action: pickAction(job.actions, 'Shoha', level) }];
      });
      break;
    }
    case 'RPR': {
      const reaperAoe = targets >= 4;
      let avatar = state.avatar || 'none';
      if (!reaperAoe && state.reaver !== 'none') avatar = state.reaver.toLowerCase().includes('gallows') ? 'gibbet' : 'gallows';
      if (state.reaver !== 'none') add('reaver', 'Spend the granted Reaver / Executioner', [reaperAoe ? state.reaver.startsWith('exec') ? 'Executioner’s Guillotine' : 'Guillotine' : { gibbet: 'Gibbet', gallows: 'Gallows', execGibbet: 'Executioner’s Gibbet', execGallows: 'Executioner’s Gallows' }[state.reaver]], 'Spend the currently enhanced granted action before another GCD.');
      if (state.design) add('design', 'Refresh Death’s Design', [aoe && has('Whorl of Death') ? 'Whorl of Death' : 'Shadow of Death'], 'Apply before the debuff expires.');
      if (state.buffs) weave('buffs', ['Arcane Circle'], 'Keep the party damage buff aligned with two-minute windows.');
      if (state.harvestMoon) add('harvest-moon', 'Use prepared Harvest Moon', ['Harvest Moon'], 'Spend the held Soulsow, or the one prepared before this pull, for damage and movement.');
      if (state.perfectio) add('perfectio', 'Spend Perfectio Parata', ['Perfectio'], 'Use the granted finisher during buffs or before it expires.');
      if (state.soulUse === 'gluttony') add('gluttony', 'Spend 50 Soul on Gluttony', ['Gluttony', ...(reaperAoe ? [times('Executioner’s Guillotine|Guillotine', 2)] : avatar === 'gallows' ? ['Executioner’s Gallows|Gallows', 'Executioner’s Gibbet|Gibbet'] : ['Executioner’s Gibbet|Gibbet', 'Executioner’s Gallows|Gallows'])], 'Weave Gluttony, then spend both granted Executioners before another GCD. Start on the enhanced positional.');
      if (state.slice) add('slice', 'Build Soul without overcapping', [aoe && has('Soul Scythe') ? 'Soul Scythe' : 'Soul Slice'], 'Adds 50 Soul. Spend existing Soul first if this would overcap; then recheck the Soul-spending choice.');
      if (state.shroud === 'prepare') add('harvest', 'Use ready Plentiful Harvest', ['Plentiful Harvest'], 'Requires held Immortal Sacrifice, no Bloodsown Circle, and a ready Plentiful Harvest. Grants Ideal Host and, at 100, Perfectio Occulta.');
      if (state.shroud !== 'none') {
        const reap = aoe ? 'Grim Reaping' : 'Void Reaping';
        const cross = aoe ? 'Grim Reaping' : 'Cross Reaping';
        add('shroud', 'Complete Enshroud', ['Enshroud', reap, 'Sacrificium', cross, ...(level >= 86 ? [aoe ? "Lemure's Scythe" : "Lemure's Slice"] : []), reap, cross, ...(level >= 86 ? [aoe ? "Lemure's Scythe" : "Lemure's Slice"] : []), level >= 90 ? 'Communio' : reap, ...(['harvest', 'prepare'].includes(state.shroud) ? ['Perfectio'] : [])], 'Enshroud is a weave. Alternate Reaping actions and weave Lemure spenders after each pair. Communio only grants Perfectio at 100 when Plentiful Harvest supplied Perfectio Occulta; the gauge-only window does not.');
      }
      if (state.soulUse === 'spend') add('soul', 'Spend 50 Soul and its granted attack', [targets >= (avatar === 'none' ? 3 : 4) ? 'Grim Swathe' : level >= 70 && avatar !== 'none' ? avatar === 'gibbet' ? 'Unveiled Gibbet' : 'Unveiled Gallows' : 'Blood Stalk', reaperAoe ? 'Guillotine' : avatar === 'gallows' ? 'Gallows' : 'Gibbet'], 'The first action is a weave that grants Soul Reaver. A held enhancement transforms Blood Stalk into its Unveiled action. Grim Swathe wins at three without an enhancement, or four with one. Spend the matching enhanced positional in single target.');
      add('filler', 'Build Soul', reaperAoe && has('Spinning Scythe') ? ['Spinning Scythe', 'Nightmare Scythe'] : ['Slice', 'Waxing Slice', 'Infernal Slice'], 'Continue the weaponskill combo between resource windows.');
      break;
    }
    case 'VPR': {
      if (state.buffs) weave('buffs', ['Serpent’s Ire'], level >= 90 ? 'Generates a Rattling Coil and Ready to Reawaken.' : 'Generates a Rattling Coil. The free Reawaken entry unlocks at 90.');
      const reawaken = ['Reawaken', 'First Generation', 'First Legacy', 'Second Generation', 'Second Legacy', 'Third Generation', 'Third Legacy', 'Fourth Generation', 'Fourth Legacy', 'Ouroboros'];
      const reawakenNote = 'At 90–95 finish after Fourth Generation. At 96+ add Ouroboros. At 100 weave each Legacy after its matching Generation.';
      if (state.ready || (state.buffs && has('Reawaken'))) add('reawaken-free', 'Use the free Reawaken entry', reawaken, 'Ready to Reawaken pays for this window; Offering is preserved. ' + reawakenNote);
      if (state.reawaken) add('reawaken', 'Spend 50 Offering on Reawaken', reawaken, (state.ready || state.buffs ? 'A separate 50 Offering funds another window after the free entry. ' : 'This entry consumes 50 Offering. ') + reawakenNote);
      if (state.vice) add('vice', 'Spend a twinblade charge', aoe && has('Vicepit') ? ['Vicepit', "Hunter's Den", 'Twinfang Thresh', 'Twinblood Thresh', "Swiftskin's Den", 'Twinblood Thresh', 'Twinfang Thresh'] : ['Vicewinder', "Hunter's Coil", 'Twinfang Bite', 'Twinblood Bite', "Swiftskin's Coil", 'Twinblood Bite', 'Twinfang Bite'], 'Coil / Den order can be reversed to refresh the needed buff first. Weave the matching Twinfang and Twinblood actions after each.');
      const coils = Number(Boolean(state.coils)) + Number(Boolean(state.buffs)) + Number(Boolean(state.vice));
      if (coils) add('coils', 'Spend available Rattling Coils', Array.from({ length: coils }, () => ['Uncoiled Fury', 'Uncoiled Twinfang', 'Uncoiled Twinblood']).flat(), 'Includes the selected held coil and newly generated coils from Ire / Vicewinder. Each entry spends one coil; its follow-ups are weaves. Preserve a coil for a planned disengage when possible.');
      const hunter = ['flanksting', 'flanksbane'].includes(state.branch);
      const finish = { flanksting: 'Flanksting Strike', flanksbane: 'Flanksbane Fang', hindsting: 'Hindsting Strike', hindsbane: 'Hindsbane Fang' }[state.branch];
      add('filler', 'Follow your selected Vipersight branch', aoe && has('Steel Maw') ? [state.fang === 'reaving' && has('Reaving Maw') ? 'Reaving Maw' : 'Steel Maw', hunter ? "Hunter's Bite" : "Swiftskin's Bite", hunter ? 'Jagged Maw' : 'Bloodied Maw', 'Last Lash'] : [state.fang === 'reaving' ? 'Reaving Fangs' : 'Steel Fangs', hunter ? "Hunter's Sting" : "Swiftskin's Sting", finish, 'Death Rattle'], 'Choose the highlighted starter and enhanced finisher. Death Rattle / Last Lash are weaves after the finisher.');
      break;
    }
    case 'BRD': {
      if (state.pitch) weave('pitch', ['Pitch Perfect'], 'Spend the selected Repertoire before overcap or leaving Wanderer’s Minuet.');
      if (state.songDue) {
        const next = { none: has("The Wanderer's Minuet") ? "The Wanderer's Minuet" : "Mage's Ballad", wanderer: "Mage's Ballad", mage: has("Army's Paeon") ? "Army's Paeon" : "Mage's Ballad", army: has("The Wanderer's Minuet") ? "The Wanderer's Minuet" : "Mage's Ballad" }[state.song];
        weave('song', [next], state.song === 'none' ? 'Start a song in combat. At cap begin with Wanderer’s Minuet.' : `Transition from ${state.song === 'army' ? 'Army’s Paeon after about 34 seconds' : state.song === 'wanderer' ? 'Wanderer’s Minuet after about 43 seconds' : 'Mage’s Ballad after about 43 seconds'}. Maintain song uptime; the cap cycle is Wanderer → Mage → Army.`);
      }
      if (state.buffs) weave('buffs', ['Raging Strikes', 'Battle Voice'], 'Align ready two-minute buffs and spend the abilities they grant.');
      if (state.buffs && state.proc && has('Barrage')) add('proc-before-barrage', 'Spend the held proc before Barrage', [targets >= 2 && has('Wide Volley|Shadowbite') ? 'Wide Volley|Shadowbite' : 'Straight Shot|Refulgent Arrow'], 'Spend the selected Hawk’s Eye first, then use Barrage for a separate empowered arrow. Preserve both opportunities.');
      if (state.buffs && has('Barrage')) add('barrage', 'Use Barrage and its granted arrows', ['Barrage', targets >= 2 && has('Wide Volley|Shadowbite') ? 'Wide Volley|Shadowbite' : 'Straight Shot|Refulgent Arrow', 'Resonant Arrow'], 'Weave Barrage, use its empowered arrow, then the granted Resonant Arrow at 96+. Keep both GCDs inside damage buffs.');
      if (state.finale) add('finale', 'Use the prepared Radiant Finale', ['Radiant Finale', 'Radiant Encore'], 'The combined condition includes at least one Coda. Encore is a GCD granted at 100; Finale is a weave.');
      if (state.bloodletter || state.empyreal || state.sidewinder) weave('shots', [...(state.bloodletter ? [targets >= 2 && has('Rain of Death') ? 'Rain of Death' : 'Bloodletter|Heartbreak Shot'] : []), ...(state.empyreal ? ['Empyreal Arrow'] : []), ...(state.sidewinder ? ['Sidewinder'] : [])], 'Use the listed ready cooldowns across weave slots. Empyreal Arrow can generate Repertoire: spend a capped Pitch Perfect first.');
      if ((!pack || life >= 30) && state.dots === 'apply') add('dots', 'Apply the missing DoTs', ['Windbite|Stormbite', 'Venomous Bite|Caustic Bite'], 'Apply each missing effect once; use Iron Jaws for later refreshes.');
      else if ((!pack || life >= 30) && state.dots === 'refresh') add('dots', 'Refresh both active DoTs', ['Iron Jaws'], 'Requires both effects already on the target.');
      if (state.voice) add('voice', 'Spend Soul Voice', ['Apex Arrow', 'Blast Arrow'], 'Apex Arrow at 80+ gauge grants Blast Arrow at level 86+.');
      if (state.proc && !(state.buffs && has('Barrage'))) add('proc', 'Spend Hawk’s Eye', [targets >= 2 && has('Wide Volley|Shadowbite') ? 'Wide Volley|Shadowbite' : 'Straight Shot|Refulgent Arrow'], 'Use the held proc before another proc can overwrite it. Barrage has its own empowered arrow.');
      add('filler', 'Use filler until another priority is ready', [targets >= 2 && has('Quick Nock') ? 'Quick Nock|Ladonsbite' : 'Heavy Shot|Burst Shot'], 'Keep the GCD moving and recheck DoTs, song timing, and procs.');
      break;
    }
    case 'MCH': {
      const heatPlan = state.stabilizer ? 'normal' : state.heatPlan;
      if (state.stabilizer) weave('stabilizer', ['Barrel Stabilizer'], 'Generates the free Hypercharge below; at 100 also grants Full Metal Machinist.');
      if (state.battery) weave('battery', ['Rook Autoturret|Automaton Queen'], 'Spend the selected Battery before overcap; allow enough uptime for the summon’s finishers.');
      const explicit = { saw: 'Chain Saw', excavator: 'Excavator', anchor: 'Hot Shot|Air Anchor', scatter: 'Spread Shot|Scattergun', drill: 'Drill' }[state.reassembleTarget];
      const selected = explicit ? pickAction(job.actions, explicit, level)?.name : null;
      const strongTool = selected || (state.saw && has('Chain Saw') ? 'Chain Saw' : targets >= 6 && has('Scattergun') ? 'Scattergun' : state.anchor && has('Hot Shot|Air Anchor') ? pickAction(job.actions, 'Hot Shot|Air Anchor', level).name : state.drill && has('Drill') ? 'Drill' : aoe && has('Spread Shot') ? 'Spread Shot|Scattergun' : has('Clean Shot') ? 'Clean Shot|Heated Clean Shot' : 'Split Shot|Heated Split Shot');
      if (state.reassemble) add('reassemble', 'Reassemble a strong ready weaponskill', [...(strongTool === 'Clean Shot|Heated Clean Shot' ? ['Split Shot|Heated Split Shot', 'Slug Shot|Heated Slug Shot'] : []), 'Reassemble', strongTool, ...(strongTool === 'Chain Saw' ? ['Excavator'] : [])], 'Complete any low-level combo setup first, then weave Reassemble immediately before the target. It does not enhance Full Metal Field or Bioblaster’s damage over time.');
      const tools = ['Chain Saw', 'Excavator', aoe && has('Bioblaster') ? 'Bioblaster' : 'Drill', 'Hot Shot|Air Anchor'].filter(name => !state.reassemble || name !== strongTool && !(strongTool === 'Chain Saw' && name === 'Excavator') && !(strongTool === 'Drill' && name === 'Bioblaster') && !(strongTool === 'Air Anchor' && name === 'Hot Shot|Air Anchor') && !(strongTool === 'Hot Shot' && name === 'Hot Shot|Air Anchor'));
      const readyTools = tools.filter(name => name === 'Chain Saw' || name === 'Excavator' ? state.saw : name === 'Drill' || name === 'Bioblaster' ? state.drill : state.anchor && targets < 6);
      if (readyTools.length) add('tools', 'Use ready tools before Hypercharge', readyTools, 'Use tools as they become available. Drill and Bioblaster share charges: select one. Excavator is granted by Chain Saw. These are cooldown priorities, not one fixed opener.');
      if (state.metal || state.stabilizer) add('metal', 'Spend Full Metal Machinist', ['Full Metal Field'], 'Use before the readiness granted by Barrel Stabilizer expires.');
      if (state.shots) weave('shots', ['Gauss Round|Double Check', 'Ricochet|Checkmate'], 'Spend one selected ready charge of each ability before Hypercharge restores more. Weave refunded charges between fast shots without clipping.');
      if (heatPlan !== 'none') {
        const crossbow = aoe && has('Auto Crossbow') && Number(state.targets) >= (state.cleave ? level >= 94 ? 6 : level >= 92 ? 22 : 4 : 3);
        const shot = crossbow ? 'Auto Crossbow' : 'Heat Blast|Blazing Shot';
        add('heat', 'Complete the selected Hypercharge window', ['Hypercharge', ...(heatPlan === 'wildfire' ? ['Wildfire'] : []), times(shot, 5, '1.5s recast · single weave'), ...(heatPlan === 'wildfire' ? [targets >= (level >= 92 && state.cleave ? 3 : 4) && has('Spread Shot') ? 'Spread Shot|Scattergun' : 'Split Shot|Heated Split Shot'] : [])], 'Weave Hypercharge, then Wildfire if selected. Five fast shots plus the next weaponskill give six Wildfire hits within ten seconds. Use only one shot ability between fast GCDs, alternating the refunded abilities as available; Auto Crossbow does not refund their cooldowns.');
      }
      if (state.flamethrower) add('flamethrower', 'Channel on the stationary pack', [times('Flamethrower', 1, 'Up to 10s · stop when a stronger tool becomes available')], 'Use after ready tools and usable Heat. Remain still with enemies in the cone; stop when movement or a higher priority requires it.');
      add('filler', 'Build Heat and Battery', targets >= (level >= 92 && state.cleave ? 3 : 4) && has('Spread Shot') ? ['Spread Shot|Scattergun'] : heatPlan === 'wildfire' ? ['Slug Shot|Heated Slug Shot', 'Clean Shot|Heated Clean Shot', 'Split Shot|Heated Split Shot'] : ['Split Shot|Heated Split Shot', 'Slug Shot|Heated Slug Shot', 'Clean Shot|Heated Clean Shot'], 'Repeat the filler combo while tools and burst resources are unavailable. After Wildfire’s sixth hit starts Split Shot, continue with Slug Shot rather than resetting that combo.');
      if (aoe) notes.push(level >= 94 ? 'At 94+, Blazing Shot wins through five tightly grouped targets when both refunded shot abilities hit the entire pack. Auto Crossbow wins at six. The main-target-only choice assumes no shot-ability splash hits.' : level >= 92 ? 'At 92–93, use Blazing Shot through 21 tightly grouped targets when both refunded shot abilities hit the entire pack. Auto Crossbow wins at 22; at 21 their potency is equal. At 94, stronger Auto Crossbow reduces the threshold to six.' : 'Before 92, use Heat Blast / Blazing Shot on three tightly grouped targets when refunded Ricochet hits the pack. Auto Crossbow wins at four or more. If shot abilities hit only the primary target, Auto Crossbow wins at three.');
      break;
    }
    case 'DNC': {
      if (state.pull && state.standard) add('standard', 'Land the prepared Standard Finish', [times('Standard Finish', 1, 'After the two prepared dance steps')], 'Land the dance finish prepared before combat on the pull, then begin the selected Technical window. Hold its granted Last Dance for the damage buffs below.');
      if (state.technical) add('technical', 'Start Technical Step', ['Technical Step', times('Technical Finish', 1, 'After four highlighted steps'), 'Devilment'], 'Perform the four highlighted dance steps between Step and Finish. Devilment is a weave after the finish.');
      if (state.technical && has('Tillana')) {
        const spendFirst = state.esprit;
        add('technical-follow', 'Use the granted burst follow-ups', [...(spendFirst ? [has('Dance of the Dawn') ? 'Dance of the Dawn' : 'Saber Dance'] : []), 'Tillana', has('Dance of the Dawn') && !spendFirst ? 'Dance of the Dawn' : 'Saber Dance', 'Starfall Dance'], spendFirst ? 'Spend held Esprit before Tillana adds 50, then spend the new gauge. Starfall is granted by Devilment. This avoids wasting Tillana’s gauge.' : 'Tillana grants 50 Esprit, funding Dance of the Dawn at 100 or Saber Dance below 100. Starfall is granted by Devilment.');
      }
      if (state.pull && state.standard) add('standard-follow', 'Spend the prepared dance’s Last Dance', ['Last Dance'], 'The opening Standard Finish granted this follow-up. Spend it inside the selected Technical / Devilment buffs.');
      const follow = { tillana: 'Tillana', starfall: 'Starfall Dance', last: 'Last Dance', finishing: 'Finishing Move', dawn: 'Dance of the Dawn' }[state.finish];
      if (follow) add('finish', 'Use the selected ready follow-up', [follow, ...(state.finish === 'finishing' ? ['Last Dance'] : [])], 'Use before its readiness expires. Tillana grants 50 Esprit, so make gauge space first. Finishing Move grants Last Dance.');
      if (state.esprit && state.finish !== 'dawn' && !(state.technical && has('Tillana'))) add('esprit', 'Spend Esprit', ['Saber Dance'], 'Spend at 80+ outside burst or at 50+ during raid buffs.');
      if (state.fan3) weave('fan3', ['Fan Dance III'], 'Spend Threefold Fan Dance before another proc can overwrite it.');
      if (state.feather) weave('feather', [targets >= 2 && has('Fan Dance II') ? 'Fan Dance II' : 'Fan Dance'], 'Spend spare feathers under buffs or before overcap. Recheck Fan Dance III if it procs.');
      if (state.flow) add('flow', 'Spend Silken / Flourishing Flow', [aoe && has('Bloodshower') ? 'Bloodshower' : 'Fountainfall'], 'Use the proc before another Fountain / Bladeshower can overwrite it.');
      if (state.symmetry) add('symmetry', 'Spend Silken / Flourishing Symmetry', [aoe && has('Rising Windmill') ? 'Rising Windmill' : 'Reverse Cascade'], 'Use the proc before another Cascade / Windmill can overwrite it.');
      if (state.flourish) add('flourish', 'Use Flourish and its new procs', ['Flourish', 'Fan Dance III', 'Fan Dance IV', aoe ? 'Bloodshower' : 'Fountainfall', aoe ? 'Rising Windmill' : 'Reverse Cascade', ...(has('Finishing Move') ? ['Finishing Move', 'Last Dance'] : [])], 'Selected held procs have been spent first. Flourish grants another set, including Fourfold Fan Dance at 86 and Finishing Move at 96. Finishing Move replaces this window’s ordinary Standard Step.');
      if (state.standard && !state.pull && state.finish !== 'finishing' && !(state.flourish && has('Finishing Move'))) add('standard', 'Use Standard Step', ['Standard Step', times('Standard Finish', 1, 'After two highlighted steps'), 'Last Dance'], 'Perform the two highlighted dance steps between Step and Finish. Spend its granted Last Dance at 92+. Finishing Move replaces this dance when ready.');
      add('filler', 'Use the base combo', aoe && has('Windmill') ? ['Windmill', 'Bladeshower'] : ['Cascade', 'Fountain'], 'Recheck procs after each weaponskill. The proc actions are not guaranteed combo steps.');
      notes.push('Before combat, assign Closed Position to your chosen Dance Partner when available.');
      break;
    }
    case 'BLM': {
      const multi = targets >= 2;
      const thunder = targets >= 3 && has('Thunder II') ? 'Thunder II|Thunder IV|High Thunder II' : 'Thunder|Thunder III|High Thunder';
      const polyglot = multi || !has('Xenoglossy') ? 'Foul' : 'Xenoglossy';
      const extras = [...(state.dot ? [times(thunder, 1, 'Thunderhead · refresh DoT')] : []), ...(state.polyglot ? [polyglot] : [])];
      let names;
      if (multi && level >= 58) {
        const ice = [targets === 2 ? 'Blizzard IV' : 'Freeze', ...(extras.length ? extras : state.paradox ? ['Paradox'] : state.phase === 'cycle' ? [] : [times(targets === 2 ? 'Blizzard IV' : 'Freeze', 1, 'Wait for Transpose cooldown')]), 'Transpose'];
        const fire = [times('Flare', 2), 'Flare Star', ...(state.manafont ? ['Manafont', times('Flare', 2), 'Flare Star'] : []), 'Transpose'];
        names = state.phase === 'fire' ? [...extras, ...fire] : [...ice, ...fire];
      } else if (multi && level >= 12) {
        const ice = level >= 40 ? [times('Freeze', 2), ...extras, 'Transpose'] : level >= 35 ? [times('Blizzard II', state.phase === 'ice' ? 1 : 2), ...extras] : [times('Blizzard II', 1, 'Until full MP'), ...extras, 'Transpose'];
        const fire = level >= 50 ? ['Fire II', 'Flare', ...(state.manafont ? ['Manafont', 'Flare'] : []), 'Transpose'] : [times('Fire II', level >= 35 && state.phase !== 'fire' ? 4 : 3), ...(state.manafont ? ['Manafont', times('Fire II', 3)] : []), ...(level < 35 ? ['Transpose'] : [])];
        names = !has('Fire II') ? ['Blizzard II', ...extras] : level >= 40 && level < 50 ? state.dot ? ['Transpose', times('Fire II', 3), 'Transpose', ...extras, 'Freeze'] : ['Freeze', ...extras] : state.phase === 'fire' ? [...extras, ...fire] : [...ice, ...fire];
      } else {
        const ice = level < 35 ? [times('Blizzard', 1, 'Until full MP'), ...extras, 'Transpose'] : [...(state.phase === 'ice' ? [] : ['Blizzard III']), ...extras, level >= 58 ? 'Blizzard IV' : times('Blizzard', 1, 'Until full MP'), ...(state.paradox ? ['Paradox'] : []), ...(state.firestarter ? ['Transpose', times('Fire III', 1, 'Firestarter proc')] : ['Fire III'])];
        const fire = level >= 90 ? state.firestarter ? [times('Fire IV', 3), 'Paradox', times('Fire IV', 3), 'Flare Star', 'Despair'] : ['Paradox', times('Fire IV', 6), 'Flare Star', 'Despair'] : level >= 60 ? [times('Fire IV', 7), 'Despair'] : [times('Fire', 1, 'Until low MP')];
        const extended = [...(state.phase === 'fire' ? [...extras, ...(state.firestarter ? [times('Fire III', 1, 'Firestarter proc')] : [])] : []), ...fire, ...(state.manafont ? ['Manafont', ...(level >= 90 ? ['Paradox', times('Fire IV', 6), 'Flare Star', 'Despair'] : fire)] : []), ...(level < 35 ? ['Transpose'] : [])];
        names = state.phase === 'fire' ? extended : [...ice, ...extended];
      }
      if (state.phase === 'cycle' && multi && level >= 40) {
        if (level < 50) names.unshift('Blizzard II');
        else names.unshift('Blizzard II|High Blizzard II');
      }
      if (state.phase === 'loop' && multi && level >= 40) {
        if (level < 50) names = [times('Transpose', 1, 'Entry from Astral Fire'), times('Freeze', 4, 'Restore full MP before Transpose'), ...names];
        else names.unshift(times('Transpose', 1, 'Entry from Astral Fire'));
      }
      if (!aoe && state.phase === 'loop' && state.moving && names[0] === 'Blizzard III') names.unshift('Transpose');
      if (state.phase === 'loop' && state.manafont) {
        // Spend the ready cooldown in the existing fire phase, before its ice entry.
        const start = names.indexOf('Manafont');
        const end = names.indexOf('Transpose', start);
        const extension = names.splice(start, (end < 0 ? names.length : end) - start);
        names.unshift(...extension);
      }
      add('cycle', 'Your selected elemental sequence', blackMageCooldowns(blackMageSupport(names, job, level, state), job, level, mode, state), 'Follow the actions from your selected starting state. Ley Lines and Amplifier use available instant-spell or fast-transition weaves, including during ice. A cast-only selection explicitly marks any required clip. Use ready Manafont before leaving Astral Fire. Triplecast protects fire casts. Swiftcast can support Transpose → Blizzard III; without instant-cast support, cast Blizzard III directly.', 'sequence');
      if (aoe) notes.push('Neutral starts include Blizzard II / High Blizzard II to establish Umbral Ice. After the final Transpose, continue from Freeze rather than replaying the one-time neutral entry spell. The extra ice filler waits out Transpose’s five-second cooldown. Move Triplecast earlier only when the mechanic specifically requires movement during ice.');
      break;
    }
    case 'SMN': {
      if (state.buffs) weave('buffs', ['Searing Light', 'Searing Flash'], 'Align Searing Light with party buffs; it grants one Searing Flash at 96.');
      if (state.aether) weave('aether', [aoe && has('Painflare') ? 'Painflare' : 'Fester|Necrotize'], 'Spend available Aetherflow in buffs or before the next Energy Drain.');
      if (state.drain && state.ruin4) add('ruin4-before-drain', 'Spend held Further Ruin before refreshing it', ['Ruin IV'], 'Use the selected old proc before the new Energy Drain / Siphon grants another.');
      if (state.drain) add('drain', 'Generate and spend two new Aetherflow stacks', [aoe && has('Energy Siphon') ? 'Energy Siphon' : 'Energy Drain', times(aoe && has('Painflare') ? 'Painflare' : 'Fester|Necrotize', 2)], 'The included drain supplies exactly these two stacks. Any separately selected held stack was spent first. Weave the spenders without clipping the GCD.', 'weave');
      const demi = state.demi === 'solar' ? 'Summon Solar Bahamut' : state.demi === 'phoenix' ? 'Summon Phoenix' : 'Aethercharge|Dreadwyrm Trance|Summon Bahamut';
      if (state.phase === 'demi' || state.summon) {
        if (state.phase !== 'demi') add('summon', 'Start the selected demi / trance', [demi], 'Requires Carbuncle and combat. Prioritize the ready demi over leftover attunement to avoid losing uses. Aethercharge uses a GCD; at 58+ activation is woven.', level < 58 ? 'gcd' : 'weave');
        const filler = level < 58 ? aoe && has('Outburst') ? 'Outburst' : 'Ruin|Ruin II|Ruin III' : state.demi === 'solar' ? aoe ? 'Umbral Flare' : 'Umbral Impulse' : state.demi === 'phoenix' ? aoe ? 'Brand of Purgatory' : 'Fountain of Fire' : aoe ? 'Astral Flare' : 'Astral Impulse';
        const abilities = state.demi === 'solar' ? ['Sunflare', 'Enkindle Solar Bahamut'] : state.demi === 'phoenix' ? ['Enkindle Phoenix'] : ['Deathflare', 'Enkindle Bahamut'];
        add('demi', 'Spend the active demi phase', [filler, ...abilities, times(filler, level >= 58 ? 5 : 4)], 'Weave the granted abilities after an early phase GCD, while the demi / trance is still active. Then finish the remaining phase casts before expiry. Cast count assumes a full new phase.');
      } else if (!['fresh', 'between'].includes(state.phase)) {
        const st = { ruby: 'Ruby Ruin|Ruby Ruin II|Ruby Ruin III|Ruby Rite', topaz: 'Topaz Ruin|Topaz Ruin II|Topaz Ruin III|Topaz Rite', emerald: 'Emerald Ruin|Emerald Ruin II|Emerald Ruin III|Emerald Rite' };
        const multi = { ruby: 'Ruby Outburst|Ruby Disaster|Ruby Catastrophe', topaz: 'Topaz Outburst|Topaz Disaster|Topaz Catastrophe', emerald: 'Emerald Outburst|Emerald Disaster|Emerald Catastrophe' };
        const spell = aoe && has(multi[state.phase]) ? multi[state.phase] : st[state.phase];
        add('attunement', 'Spend the selected attunement', state.phase === 'ruby' ? [times(spell, 2), 'Crimson Cyclone', 'Crimson Strike'] : state.phase === 'topaz' && level >= 86 ? Array.from({ length: 4 }, () => [spell, 'Mountain Buster']).flat() : [times(spell, 4, state.phase === 'emerald' ? '1.5s recast · single weave' : ''), ...(state.phase === 'emerald' ? ['Slipstream'] : [])], 'Start with all attunement charges. Emerald spells have a 1.5-second recast: weave only one ability between them. Mountain Buster is a weave after each Topaz Rite; Crimson follow-ups and Slipstream require level 86.');
      } else if (state.phase !== 'fresh') add('primal', 'Use the selected primal gem', [{ topaz: 'Summon Topaz|Summon Titan|Summon Titan II', ruby: 'Summon Ruby|Summon Ifrit|Summon Ifrit II', emerald: 'Summon Emerald|Summon Garuda|Summon Garuda II' }[state.primal] || 'Summon Ruby'], 'Use the selected unspent gem, then change Current summon phase to its attunement. Spend it fully before choosing another.');
      if (state.ruin4 && !state.drain || state.drain && has('Ruin IV') && !state.summon && state.phase !== 'demi') add('ruin4', 'Spend Further Ruin between demis', ['Ruin IV'], 'Use the selected ready instant cast or the new drain’s proc outside a demi phase. Do not interrupt Crimson Cyclone → Crimson Strike.');
      if (state.drain && has('Ruin IV') && (state.summon || state.phase === 'demi')) notes.push('Energy Drain / Siphon also grants Further Ruin. Hold it until the current demi ends, then select Further Ruin ready between phases.');
      add('filler', 'Fill only when phases are exhausted', [aoe && has('Outburst') ? 'Outburst|Tri-disaster' : 'Ruin|Ruin II|Ruin III'], 'Summon Carbuncle before combat. At 100: Solar → Bahamut → Solar → Phoenix, with three primals between each demi.');
      break;
    }
    case 'RDM': {
      const long = state.mana === 'white' ? 'Veraero|Veraero III' : 'Verthunder|Verthunder III';
      const instant = aoe && has('Scatter') ? 'Scatter|Impact' : long;
      const impactFirst = state.impact && state.dualcast && aoe && has('Impact');
      if (state.buffs || state.fleche || state.contre || state.corps || state.engagement) weave('buffs', [...(state.buffs ? ['Embolden', 'Vice of Thorns'] : []), ...(state.fleche ? ['Fleche'] : []), ...(state.contre ? ['Contre Sixte'] : []), ...(state.corps ? ['Corps-a-corps'] : []), ...(state.engagement ? ['Engagement'] : [])], 'Embolden grants Vice of Thorns at 92. Spread ready abilities across legal weave slots; reserve movement charges when the encounter needs them.');
      if (state.acceleration) add('acceleration', 'Use the ready Acceleration charge', ['Acceleration', 'Grand Impact', times(instant, 1, 'Instant · Acceleration')], 'At 96+, spend Grand Impact before the transformed Jolt III / Impact button. The long spell then consumes Acceleration and guarantees its matching single-target proc. Recheck that proc afterwards.');
      if (impactFirst) add('impact', 'Spend Grand Impact before the transformed Impact', ['Grand Impact'], 'Grand Impact temporarily replaces Impact and leaves Dualcast available. Spend it first, then use the instant Impact.');
      if (state.dualcast && (state.melee || state.manafication)) add('dualcast', 'Use Dualcast before the melee combo', [times(instant, 1, 'Instant · Dualcast')], 'A weaponskill would cancel the held Dualcast. Spend it on the long spell before starting melee.');
      if (state.manafication) weave('manafication', ['Manafication', 'Prefulgence'], 'Manafication funds one free combo and grants Prefulgence at 100. It cancels an unfinished combo; use only between combos.');
      if (state.melee || state.manafication) {
        const finisher = state.mana === 'white' && has('Verholy') ? 'Verholy' : 'Verflare';
        const combo = [...(aoe && has('Enchanted Moulinet') ? ['Enchanted Moulinet', 'Enchanted Moulinet Deux', 'Enchanted Moulinet Trois'] : ['Enchanted Riposte', 'Enchanted Zwerchhau', 'Enchanted Redoublement']), finisher, 'Scorch', 'Resolution'];
        add('melee', state.manafication && state.melee ? 'Use free and separately funded melee combos' : 'Complete the enchanted melee combo', state.manafication && state.melee ? [...combo, ...combo] : combo, 'Manafication pays for one combo; selected held mana funds a separate combo. Choose the finisher for lower mana. A single missing proc can change the finisher choice.');
      }
      const heldDualcast = state.dualcast && !state.melee && !state.manafication;
      if (state.impact && !impactFirst) add('impact', 'Spend Grand Impact Ready', ['Grand Impact'], 'Use the granted instant spell before the buff expires. Grand Impact does not consume Dualcast, Swiftcast or Acceleration.');
      const short = state.acceleration && !aoe ? state.mana === 'white' ? 'Verstone' : 'Verfire' : state.mana === 'white' ? state.verstone ? 'Verstone' : state.verfire ? 'Verfire' : 'Jolt|Jolt II|Jolt III' : state.verfire ? 'Verfire' : state.verstone ? 'Verstone' : 'Jolt|Jolt II|Jolt III';
      add('filler', 'Build balanced mana', !has('Jolt') ? ['Riposte'] : heldDualcast ? [times(instant, 1, 'Instant · Dualcast')] : aoe && has('Scatter') ? [has('Verthunder II') ? state.mana === 'white' && has('Veraero II') ? 'Veraero II' : 'Verthunder II' : 'Scatter', 'Scatter|Impact'] : [short, ...(has(long) ? [long] : [])], 'Hardcast a short spell, then Dualcast the long spell for lower mana. Before the short AoE spells unlock, hardcast Scatter and Dualcast the next Scatter. A weaponskill cancels held Dualcast; Grand Impact leaves it available. At level 1 use Riposte.');
      if (heldDualcast && (state.verfire || state.verstone)) notes.push('Your held Verfire / Verstone procs can coexist with Dualcast. The first action stays the instant long spell; recheck those saved procs for the following short cast.');
      break;
    }
    case 'PCT': {
      const additive = pictomancerColors(job.actions, level, targets);
      const subtractive = pictomancerColors(job.actions, level, targets, true);
      let hue = ({ none: 0, one: 1, two: 2 })[state.hues];
      const colors = (names, count) => Array.from({ length: count }, () => { const name = names[hue % names.length]; hue = (hue + 1) % names.length; return name; });
      const swiftOnEntry = state.pull && state.moving && !state.palette && !state.buffs;
      if (state.pull) {
        const creature = { none: 'Pom Motif', pom: 'Pom Motif', wing: 'Wing Motif', claw: 'Claw Motif', fang: 'Maw Motif' }[state.muse];
        add('setup', 'Paint all canvases before combat, then engage', [...(!state.prepared ? [times(creature, 1, 'Paint before combat'), ...(!['ready', 'active'].includes(state.hammer) ? [times('Hammer Motif', 1, 'Paint before combat')] : []), times('Starry Sky Motif', 1, 'Paint before combat')] : []), ...(swiftOnEntry ? ['Swiftcast'] : []), { ...times(has('Rainbow Drip') ? 'Rainbow Drip' : colors(additive, 1)[0], 1, swiftOnEntry ? 'Instant · Swiftcast · start combat' : 'Precast to start combat'), entry: true }], 'Paint one creature, one weapon, and one landscape on the three separate canvases before the pull. Filled canvases are skipped. Only one creature motif fits at a time. Precast Rainbow Drip when unlocked; a lower-level color opener advances Aetherhues before the muses.');
      }
      if (state.buffs) weave('buffs', ['Starry Muse'], 'Requires a painted landscape. Stand in the field for accelerated Subtractive casts.');
      if (state.muse !== 'none') weave('muse', [{ pom: 'Pom Muse', wing: 'Winged Muse', claw: 'Clawed Muse', fang: 'Fanged Muse' }[state.muse], ...(state.muse === 'wing' ? ['Mog of the Ages'] : state.muse === 'fang' ? ['Retribution of the Madeen'] : [])], 'Use the selected painted creature’s actual muse. Wing / Maw completes its portrait; prepare the next motif during downtime.');
      if (state.prism || (state.buffs && has('Star Prism'))) add('prism', 'Spend Starstruck', ['Star Prism'], 'Use the granted Star Prism under Starry Muse.');
      if (state.rainbow) add('rainbow', 'Spend Rainbow Bright', ['Rainbow Drip'], 'Use the instant, reduced-recast spell before readiness expires.');
      if (state.hammer !== 'none') add('hammer', 'Use the hammer combo', [...(state.hammer === 'prepare' && !state.pull ? [times('Hammer Motif', 1, 'Paint first · instant outside combat')] : []), ...(['prepare', 'ready'].includes(state.hammer) ? ['Striking Muse'] : []), ...(level >= 86 ? ['Hammer Stamp', 'Hammer Brush', 'Polishing Hammer'] : [times('Hammer Stamp', 3)])], 'Hammer Motif paints the weapon. In combat, Striking Muse consumes the painting and grants three Hammer Time stacks. The hammer spells spend those stacks; an already-active selection skips setup casts.');
      if (state.black) add('black', 'Spend Black Paint', ['Comet in Black'], 'Use under buffs, for movement, or before another Subtractive Palette would overwrite the charge.');
      if (state.white) add('white', 'Use White Paint for movement', ['Holy in White'], 'Use the selected movement spell when stronger instant casts are unavailable.');
      if (state.palette || state.buffs) add('palette', 'Use the Subtractive combo', ['Subtractive Palette', ...(state.moving ? ['Swiftcast'] : []), ...colors(subtractive, 3), 'Comet in Black'], 'Subtractive Palette preserves Aetherhues and grants three casts. Follow this rotated order on the same color button. Spend existing Black Paint first; the new Thunder supplies Paint for Comet. Swiftcast protects the first Subtractive cast.');
      const extraColor = Boolean(state.buffs && has('Rainbow Drip') && level < 100 && !state.black && !state.white);
      if (extraColor) add('hyperphantasia', 'Consume the fifth Hyperphantasia stack', colors(additive, 1), 'Three Subtractive casts and Comet consumed four stacks. This next legal color grants Rainbow Bright; Star Prism supplies that fifth cast at level 100 instead.');
      if (state.buffs && has('Rainbow Drip')) add('rainbow-earned', 'Spend the new Rainbow Bright', [times('Rainbow Drip', 1, 'Instant · five Hyperphantasia stacks consumed')], 'The preceding five eligible spells grant this instant, reduced-recast Rainbow Drip. Stand in Starry Muse while consuming Hyperphantasia.');
      add('filler', 'Continue the color cycle', [...(state.moving && !swiftOnEntry && !state.palette && !state.buffs ? ['Swiftcast'] : []), ...colors(additive, additive.length - Number(extraColor))], 'Continue from the current Aetherhues stage, including the opening attack and any Subtractive casts above. These names are successive transformations of the same hotbar button. Recheck Paint, Palette, and muses as they become ready.');
      break;
    }
    case 'BLU': {
      if (state.moon) add('moon', 'Begin the selected Moon Flute window', ['Moon Flute'], 'Use your equipped burst spells during Waxing Nocturne. Waning Nocturne prevents actions afterwards; this list covers only the selected basic loadout.');
      if (aoe && state.freezePlan !== 'none') add('freeze', state.freezePlan === 'ultra' ? 'Freeze and defeat the susceptible pack' : 'Use the equipped pack-freeze spell', ["The Ram's Voice", ...(state.freezePlan === 'ultra' ? ['Ultravibration'] : [])], 'The combined choice confirms both equipped spells, ready Ultravibration, and susceptible enemies. Skip the instant-death setup on immune targets.');
      if (state.dotPlan !== 'none') add('dot', 'Refresh Song of Torment', [...(state.dotPlan === 'bristled' ? ['Bristle'] : []), 'Song of Torment'], 'This choice includes its equipped spells and a DoT that needs refreshing. Bristle enhances Song of Torment.');
      add('filler', 'Use your equipped damage filler', [state.sonic ? 'Sonic Boom' : 'Water Cannon'], 'Water Cannon is the initial learned-spell fallback. Select Sonic Boom only when learned and equipped.');
      notes.push('Blue Mage has loadout-dependent rotations. These switches cover a basic damage / pack setup; specialist Moon Flute openers require a complete equipped spell list.');
      break;
    }
    case 'BST': {
      if (state.familiar !== 'active') add('summon', 'Summon your equipped familiar', [{ first: 'First Battlehorn', second: 'Second Battlehorn', third: 'Third Battlehorn' }[state.familiar]], 'Use the selected equipped battlehorn before building familiar TP.');
      if (state.charge) weave('charge', ['Shield Charge'], 'Spend one selected ready charge; reserve a charge when movement requires it.');
      if (state.tempered) weave('tempered', ['Tempered Release'], 'The active familiar supplies One with Nature. The controlled ability and its effect depend on the equipped familiar.');
      if (state.trick) weave('trick', ['Trick'], 'Spend the familiar’s selected 100+ TP. It grants the familiar skill’s affinity; the following player instinct uses a separate player TP gauge.');
      if (state.tp) {
        const next = { none: 'Avalanche Axe', volant: 'Avalanche Axe', rampant: 'Mistral Axe', durant: 'Spinning Axe', eldritch: 'Gale Axe' }[state.affinity];
        if (has(next)) add('instinct', 'Use the next clockwise affinity', [next], state.affinity === 'none' ? 'Start a Rampant chain. Player instinctual skills consume all player TP.' : 'Use within seven seconds of the previous affinity. Coordinate with a familiar instinctual skill using its separate TP.');
        else notes.push('The next clockwise player skill is not unlocked. Use an appropriate familiar affinity or start a new chain with an unlocked instinctual skill.');
      }
      add('filler', 'Build TP alongside your familiar', ['Smash Axe', 'Axeblade Bite', 'Shieldsplitter'], 'Repeat the unlocked combo until the player has 100 TP. Familiar TP is independent; familiar commands depend on the equipped familiar.');
      notes.push('Clockwise chain: Volant → Rampant → Durant → Eldritch → Volant. Only use an instinctual skill when its owner has at least 100 TP.');
      break;
    }
  }
  if (job.id !== 'PCT') includeCombatEntry(job, rows, controls, state, input, level, targets >= (['BRD', 'SCH'].includes(job.id) ? 2 : 3) ? 'aoe' : 'single');
  if (job.role === 'limited') notes.push('Introductory setup only. No matching public Balance guide is available for this limited job; use Icy Veins and official mechanics. Familiar-specific Beastmaster finishers, Rally loops and horn swaps, and full Blue Mage loadouts require the original guide.');
  return { controls, state, references: rotationReferences(job, level), rulesReviewedAt: RULES_REVIEWED_AT, rows: annotatePrerequisites(job, rows, state, level, mode), notes, presentation: job.id === 'BLM' ? 'sequence' : 'priority', source: job.guides.find(guide => guide.type === (level >= job.cap ? 'basic-guide' : 'leveling-guide'))?.url || job.official };
}

export function rotationControls(job, level, input = {}, mode = 'single') {
  return buildRotation(job, level, mode, input).controls;
}
