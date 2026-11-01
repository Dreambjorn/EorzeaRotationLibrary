import { createHash } from 'node:crypto';
import { openAsBlob } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const api = 'https://www.virustotal.com/api/v3';
const categories = ['malicious', 'suspicious', 'undetected', 'harmless', 'timeout', 'confirmed-timeout', 'failure', 'type-unsupported'];
const errorCodes = new Set(['BadRequestError', 'InvalidArgumentError', 'NotAvailableYet', 'AuthenticationRequiredError', 'UserNotActiveError', 'WrongCredentialsError', 'ForbiddenError', 'NotFoundError', 'AlreadyExistsError', 'FailedDependencyError', 'QuotaExceededError', 'TooManyRequestsError', 'TransientError', 'DeadlineExceededError']);

export async function scanRelease(filename, expectedHash, { apiKey = process.env.VIRUSTOTAL_API_KEY, fetcher = fetch, pause = sleep, now = Date.now, log = () => {} } = {}) {
  if (!apiKey?.trim()) throw new Error('Set the VIRUSTOTAL_API_KEY repository Actions secret before releasing.');
  if (!/^[a-f0-9]{64}$/.test(expectedHash || '')) throw new Error('The release SHA256 is missing or invalid.');
  const file = await openAsBlob(filename);
  if (!file.size || file.size > 650_000_000) throw new Error('VirusTotal requires a nonempty file no larger than 650 MB.');
  const hash = createHash('sha256');
  for await (const chunk of file.stream()) hash.update(chunk);
  if (hash.digest('hex') !== expectedHash) throw new Error('The release EXE does not match its SHA256.');

  const deadline = now() + 15 * 60_000;
  let nextRequest = now();
  async function request(stage, url, options = {}) {
    let transientRetries = 0;
    for (let attempt = 0; ; attempt++) {
      const wait = Math.max(0, nextRequest - now());
      if (now() + wait >= deadline) throw new Error('VirusTotal did not finish within 15 minutes.');
      if (wait) await pause(wait);
      nextRequest = now() + 20_000;
      log(`VirusTotal ${stage}: ${options.method || 'GET'} attempt ${attempt + 1}.`);
      let response;
      try {
        response = await fetcher(url, { ...options, headers: { 'x-apikey': apiKey }, redirect: 'error', signal: AbortSignal.timeout(Math.min(180_000, deadline - now())) });
      } catch {
        throw new Error(`The VirusTotal ${stage} request failed or timed out.`);
      }
      log(`VirusTotal ${stage}: HTTP ${response.status}.`);
      // Analysis reads can return 404 while processing continues.
      if (stage === 'analysis-status' && response.status === 404) {
        await response.body?.cancel();
        continue;
      }
      if ((response.status === 429 || response.status >= 500) && transientRetries < 2) {
        transientRetries++;
        await response.body?.cancel();
        nextRequest = now() + (response.status === 429 ? 60_000 : 20_000);
        continue;
      }
      if (!response.ok) {
        let code;
        try { code = (await response.json()).error?.code; } catch {}
        // Error messages can contain signed upload URLs, so retain only known codes.
        const detail = errorCodes.has(code) ? ` (${code})` : '';
        throw new Error(`VirusTotal ${stage} returned HTTP ${response.status}${detail}.`);
      }
      try { return await response.json(); } catch { throw new Error(`VirusTotal ${stage} returned an invalid JSON response.`); }
    }
  }

  let upload = api + '/files';
  if (file.size > 32 * 1024 * 1024) {
    const result = await request('upload-url', api + '/files/upload_url');
    let url;
    try { url = new URL(result.data); } catch { throw new Error('VirusTotal returned an invalid upload URL.'); }
    const trustedHost = url.hostname === 'virustotal.com' || url.hostname.endsWith('.virustotal.com');
    if (!['http:', 'https:'].includes(url.protocol) || !trustedHost || url.port || url.username || url.password) {
      throw new Error('VirusTotal returned an unexpected upload origin: ' + url.origin + '.');
    }
    // Upload hosts and paths come from the API; signed tokens must stay intact.
    url.protocol = 'https:';
    upload = url.href;
  }
  const form = new FormData();
  form.set('file', file, path.basename(filename));
  const submission = await request('file-upload', upload, { method: 'POST', body: form });
  const id = submission.data?.id;
  if (submission.data?.type !== 'analysis' || typeof id !== 'string' || !id) throw new Error('VirusTotal did not return an analysis ID.');

  let analysis;
  do {
    const result = await request('analysis-status', api + '/analyses/' + encodeURIComponent(id));
    if (result.data?.id !== id || result.data?.type !== 'analysis') throw new Error('VirusTotal returned a different analysis.');
    analysis = result.data.attributes;
    if (!['queued', 'in-progress', 'completed'].includes(analysis?.status)) throw new Error('VirusTotal returned an invalid analysis status.');
  } while (analysis.status !== 'completed');

  const stats = Object.fromEntries(categories.map(category => [category, analysis.stats?.[category]]));
  if (Object.values(stats).some(value => !Number.isSafeInteger(value) || value < 0) || stats.malicious + stats.suspicious + stats.undetected + stats.harmless === 0) {
    throw new Error('VirusTotal completed without valid engine results.');
  }
  if (!Number.isSafeInteger(analysis.date) || analysis.date <= 0 || !Number.isFinite(new Date(analysis.date * 1000).getTime())) throw new Error('VirusTotal returned an invalid analysis date.');
  const report = await request('file-report', api + '/files/' + expectedHash);
  if (report.data?.type !== 'file' || report.data.id !== expectedHash || report.data.attributes?.sha256 !== expectedHash) throw new Error('The VirusTotal report does not match the release EXE.');
  return { sha256: expectedHash, url: 'https://www.virustotal.com/gui/file/' + expectedHash + '/detection', status: 'completed', analyzedAt: new Date(analysis.date * 1000).toISOString(), stats };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [filename, expectedHash, output] = process.argv.slice(2);
    if (!filename || !output) throw new Error('Usage: node scripts/virustotal.mjs <EXE> <SHA256> <report.json>');
    const report = await scanRelease(filename, expectedHash, { log: message => console.log(message) });
    await writeFile(output, JSON.stringify(report, null, 2) + '\n');
    console.log('VirusTotal analysis completed: ' + report.url);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
