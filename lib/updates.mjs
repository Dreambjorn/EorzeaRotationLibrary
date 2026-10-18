export const ROTATION_COMPARISON_VERSION = 2;

const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'").replace(/[–—]/g, '-').replace(/\s+/g, ' ').replace(/[.,;:!?]+(?=\s|$)/g, '').trim();
const metadata = /^(?:last updated|updated on|authors?|contributors?|changelog|advertisement|patch applicable|on this page|this guide|welcome|interactive rotation example)/i;

function rotationContent(guide) {
  const blocks = [];
  const parents = [];
  for (const section of guide.sections || []) {
    while (parents.length && parents.at(-1).rank >= section.rank) parents.pop();
    const relevant = /rotation|opener|priority|burst|single.target|multi.target|aoe|damage|cooldown|resource|weav|combo|phase|gauge|proc|movement/i.test(section.title) || parents.at(-1)?.relevant;
    parents.push({ rank: section.rank, relevant });
    if (!relevant) continue;
    for (const block of section.blocks) {
      const text = block.text.replace(/\s+/g, ' ').trim();
      if (!text || metadata.test(text)) continue;
      blocks.push({ section: section.title, text, normalized: normalize(text) });
    }
  }
  for (const widget of guide.widgets || []) blocks.push({ section: widget.title || 'Published rotation example', text: `Published opener sequence: ${widget.rotation}`, normalized: `widget:${widget.rotation}|${widget.dataPath}` });
  return blocks;
}

export function isRotationUpdate(update) {
  return update.kind === 'rotation-guide' && update.comparisonVersion === ROTATION_COMPARISON_VERSION && Boolean(update.changes?.length);
}

export function changedReferences(previous, current, at, fingerprint) {
  const updates = [];
  if (!previous) return updates;
  for (const guide of current.guides) {
    const old = previous.guides?.find(item => item.url === guide.url);
    if (!old || guide.contentError || guide.stale || guide.externalLeveling || old.contentVersion !== ROTATION_COMPARISON_VERSION || guide.contentVersion !== ROTATION_COMPARISON_VERSION) continue;
    const before = rotationContent(old);
    const after = rotationContent(guide);
    const previousSignature = JSON.stringify(before.map(block => block.normalized));
    const signature = JSON.stringify(after.map(block => block.normalized));
    if (previousSignature === signature) continue;
    let start = 0;
    while (start < before.length && start < after.length && before[start].normalized === after[start].normalized) start++;
    let oldEnd = before.length, newEnd = after.length;
    while (oldEnd > start && newEnd > start && before[oldEnd - 1].normalized === after[newEnd - 1].normalized) { oldEnd--; newEnd--; }
    const changes = [{ section: after[start]?.section || before[start]?.section || 'Rotation guidance', before: before.slice(start, oldEnd).map(block => block.text).join('\n').slice(0, 2400), after: after.slice(start, newEnd).map(block => block.text).join('\n').slice(0, 2400) }];
    updates.push({
      id: fingerprint(`${current.id}|${guide.url}|${signature}`).slice(0, 24),
      kind: 'rotation-guide', comparisonVersion: ROTATION_COMPARISON_VERSION,
      job: current.id, source: guide.publisher || 'The Balance', url: guide.url,
      published: guide.lastModified || guide.updated, at,
      summary: 'Rotation guidance changed. Compare the source details before updating library rules.', changes,
    });
  }
  return updates;
}

export function pendingNotifications(jobs, acknowledged = []) {
  const seen = new Set(acknowledged);
  return jobs.flatMap(job => (job.reviewUpdates || []).filter(update => isRotationUpdate(update) && !seen.has(update.id)).map(update => ({ ...update, jobName: job.name })));
}
