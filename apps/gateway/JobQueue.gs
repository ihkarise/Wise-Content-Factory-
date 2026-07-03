/**
 * Async job pattern — required because Apps Script has a hard ~6-minute execution ceiling
 * (Architecture Review Report, Security/Scalability Review #1). A request that might take a
 * while (e.g. video generation once a real media provider is wired up) is enqueued and this
 * function returns immediately with a job id; the frontend polls getJobStatus_ until it's done.
 * Fast requests (most text capabilities today) still go through this path for consistency, and
 * simply complete before the caller even finishes their first poll.
 *
 * Jobs live in CacheService (max ~6h TTL). This is intentionally NOT a durable queue — see the
 * Architecture Review Report, Scalability Review #2 ("no datastore is named anywhere"). Swap this
 * for a real datastore-backed queue before relying on it for anything long-lived or high-volume.
 */

var JOB_TTL_SECONDS = 6 * 60 * 60;

function enqueueJob_(type, payload) {
  var jobId = Utilities.getUuid();
  var job = { id: jobId, type: type, payload: payload, status: 'queued', createdAt: Date.now(), result: null, error: null };
  saveJob_(job);
  return jobId;
}

function getJobStatus_(jobId) {
  var job = loadJob_(jobId);
  if (!job) throw new Error('Unknown job id: ' + jobId);
  return job;
}

function completeJob_(jobId, result) {
  var job = loadJob_(jobId);
  if (!job) return;
  job.status = 'completed';
  job.result = result;
  job.completedAt = Date.now();
  saveJob_(job);
}

function failJob_(jobId, errorMessage) {
  var job = loadJob_(jobId);
  if (!job) return;
  job.status = 'failed';
  job.error = errorMessage;
  job.completedAt = Date.now();
  saveJob_(job);
}

function saveJob_(job) {
  CacheService.getScriptCache().put('job:' + job.id, JSON.stringify(job), JOB_TTL_SECONDS);
}

function loadJob_(jobId) {
  var raw = CacheService.getScriptCache().get('job:' + jobId);
  return raw ? JSON.parse(raw) : null;
}

/**
 * Runs a job's work function inline and records the outcome. In this repo's demo scope, "inline"
 * is synchronous (fast mock/text providers); once a real long-running media provider is wired up,
 * replace the direct call below with handing off to a time-driven trigger
 * (ScriptApp.newTrigger(...).timeBased().everyMinutes(1).create()) that calls this same function.
 */
function runJob_(jobId, workFn) {
  var job = loadJob_(jobId);
  if (!job) return;
  job.status = 'running';
  saveJob_(job);
  try {
    var result = workFn(job.payload);
    completeJob_(jobId, result);
  } catch (err) {
    failJob_(jobId, err && err.message ? err.message : String(err));
  }
}
