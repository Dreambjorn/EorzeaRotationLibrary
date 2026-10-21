export const JOBS = [
  [19, 'PLD', 'Paladin', 'tanks', 'paladin', 1],
  [21, 'WAR', 'Warrior', 'tanks', 'warrior', 1],
  [32, 'DRK', 'Dark Knight', 'tanks', 'dark-knight', 30],
  [37, 'GNB', 'Gunbreaker', 'tanks', 'gunbreaker', 60],
  [24, 'WHM', 'White Mage', 'healers', 'white-mage', 1],
  [28, 'SCH', 'Scholar', 'healers', 'scholar', 1],
  [33, 'AST', 'Astrologian', 'healers', 'astrologian', 30],
  [40, 'SGE', 'Sage', 'healers', 'sage', 70],
  [20, 'MNK', 'Monk', 'melee', 'monk', 1],
  [22, 'DRG', 'Dragoon', 'melee', 'dragoon', 1],
  [30, 'NIN', 'Ninja', 'melee', 'ninja', 1],
  [34, 'SAM', 'Samurai', 'melee', 'samurai', 50],
  [39, 'RPR', 'Reaper', 'melee', 'reaper', 70],
  [41, 'VPR', 'Viper', 'melee', 'viper', 80],
  [23, 'BRD', 'Bard', 'ranged', 'bard', 1],
  [31, 'MCH', 'Machinist', 'ranged', 'machinist', 30],
  [38, 'DNC', 'Dancer', 'ranged', 'dancer', 60],
  [25, 'BLM', 'Black Mage', 'casters', 'black-mage', 1],
  [27, 'SMN', 'Summoner', 'casters', 'summoner', 1],
  [35, 'RDM', 'Red Mage', 'casters', 'red-mage', 50],
  [42, 'PCT', 'Pictomancer', 'casters', 'pictomancer', 80],
  [36, 'BLU', 'Blue Mage', 'limited', 'blue-mage', 1, 80],
  [43, 'BST', 'Beastmaster', 'limited', 'beastmaster', 1, 50],
].map(([number, id, name, role, slug, startsAt, cap = 100]) => ({
  number, id, name, role, slug, startsAt, cap,
  official: `https://na.finalfantasyxiv.com/jobguide/${slug.replaceAll('-', '')}/`,
  guides: role === 'limited' ? [] : ['leveling-guide', 'basic-guide'].map(type => ({
    type, url: `https://www.thebalanceffxiv.com/jobs/${role}/${slug}/${type}/`,
  })),
  icon: `/api/icons/job-${id}.png`,
}));

export const ROLE_NAMES = {
  tanks: 'Tanks', healers: 'Healers', melee: 'Melee DPS',
  ranged: 'Physical ranged', casters: 'Magical ranged', limited: 'Limited jobs',
};

export const normalize = value => value.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9]/g, '');

export function pickAction(actions, names, level) {
  return names.split('|').map(name => actions.find(action => normalize(action.name) === normalize(name)))
    .filter(action => action && action.level <= level).sort((a, b) => b.level - a.level)[0];
}

export const targetCount = (mode, state = {}) => mode === 'single' ? 1 : Math.max(2, Math.min(24, Number(state.targets) || 3));

export function pictomancerColors(actions, level, targets, subtractive = false) {
  const single = subtractive ? ['Blizzard in Cyan', 'Stone in Yellow', 'Thunder in Magenta'] : ['Fire in Red', 'Aero in Green', 'Water in Blue'];
  const multi = subtractive ? ['Blizzard II in Cyan', 'Stone II in Yellow', 'Thunder II in Magenta'] : ['Fire II in Red', 'Aero II in Green', 'Water II in Blue'];
  if (targets < 3) return single.filter(name => pickAction(actions, name, level));
  if (!subtractive && level < 35 && targets >= 4 && pickAction(actions, multi[0], level)) return [multi[0]];
  return single.map((name, index) => {
    const useMulti = subtractive || level < 54 || level >= 74 || targets >= 4 || index === 2;
    return useMulti && pickAction(actions, multi[index], level) ? multi[index] : name;
  }).filter(name => pickAction(actions, name, level));
}

export const RULES_REVIEWED_AT = '2026-10-20';

export function rotationReferences(job, level) {
  const type = level >= job.cap ? 'basic-guide' : 'leveling-guide';
  const balance = job.guides.find(guide => guide.type === type);
  const icy = job.guides.find(guide => guide.type === (level >= job.cap ? 'icy-rotation' : 'icy-leveling'));
  return [
    ...(balance ? [{ publisher: 'The Balance', url: balance.url, patch: balance.patch, published: balance.updated }] : []),
    ...(icy ? [{ publisher: 'Icy Veins', url: icy.url, patch: icy.patch, published: icy.lastModified || icy.updated }] : []),
    { publisher: 'Official action requirements', url: job.official },
  ];
}

export function iconAsset(number) {
  const value = String(number).padStart(6, '0');
  return `https://v2.xivapi.com/api/asset?path=ui/icon/${value.slice(0, 3)}000/${value}_hr1.tex&format=png`;
}
