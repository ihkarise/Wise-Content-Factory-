import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  definePublishingProvider,
  PublishingManager,
  createFacebookProvider,
  createInstagramProvider,
  createThreadsProvider,
  createYoutubeProvider,
  createLinkedinProvider,
  createXProvider,
} from '../src/index.js';

function parseUrl(url) {
  const u = new URL(url);
  return { pathname: u.pathname, params: Object.fromEntries(u.searchParams.entries()) };
}

function jsonResponse(body, { ok = true, status = 200, headers = {} } = {}) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: { get: (key) => headers[key.toLowerCase()] ?? null },
  };
}

// --- publishingProviderInterface -----------------------------------------

test('definePublishingProvider throws when a required function is missing', () => {
  assert.throws(() => definePublishingProvider({ id: 'broken', platform: 'broken' }), /missing required function/);
});

test('definePublishingProvider defaults getAnalytics to a not-implemented stub', async () => {
  const provider = definePublishingProvider({
    id: 'x', platform: 'x',
    authenticate: async () => ({ authenticated: true }),
    createDraft: async () => ({}),
    schedulePublish: async () => ({}),
    publishNow: async () => ({}),
    getUploadStatus: async () => ({}),
  });
  await assert.rejects(provider.getAnalytics('123'), /not implemented/);
});

// --- PublishingManager ------------------------------------------------

test('PublishingManager registers by platform and dispatches actions', async () => {
  const manager = new PublishingManager();
  manager.registerProvider(
    definePublishingProvider({
      id: 'fb', platform: 'facebook',
      authenticate: async () => ({ authenticated: true }),
      createDraft: async () => ({ platformPostId: 'draft-1' }),
      schedulePublish: async () => ({ platformPostId: 'sched-1' }),
      publishNow: async (content) => ({ platformPostId: 'pub-1', text: content.text }),
      getUploadStatus: async () => ({ status: 'published' }),
    })
  );
  const result = await manager.publish('facebook', 'publishNow', { text: 'hello' });
  assert.equal(result.platformPostId, 'pub-1');
  assert.equal(result.text, 'hello');
});

test('PublishingManager throws a clear error for an unregistered platform', async () => {
  const manager = new PublishingManager();
  await assert.rejects(manager.publish('facebook', 'publishNow', {}), /No publishing provider registered/);
});

test('PublishingManager treats an unavailable (unconfigured) provider as not usable', async () => {
  const manager = new PublishingManager();
  manager.registerProvider(
    definePublishingProvider({
      id: 'fb', platform: 'facebook', healthStatus: 'unavailable',
      authenticate: async () => ({}), createDraft: async () => ({}), schedulePublish: async () => ({}),
      publishNow: async () => ({}), getUploadStatus: async () => ({}),
    })
  );
  await assert.rejects(manager.publish('facebook', 'publishNow', {}), /unavailable/);
});

test('PublishingManager.publishToMany never lets one platform failure abort the others', async () => {
  const manager = new PublishingManager();
  manager.registerProvider(
    definePublishingProvider({
      id: 'ok', platform: 'ok-platform',
      authenticate: async () => ({}), createDraft: async () => ({}), schedulePublish: async () => ({}),
      publishNow: async () => ({ platformPostId: 'ok-1' }), getUploadStatus: async () => ({}),
    })
  );
  manager.registerProvider(
    definePublishingProvider({
      id: 'bad', platform: 'bad-platform',
      authenticate: async () => ({}), createDraft: async () => ({}), schedulePublish: async () => ({}),
      publishNow: async () => { throw new Error('rate limited'); }, getUploadStatus: async () => ({}),
    })
  );
  const results = await manager.publishToMany(['ok-platform', 'bad-platform'], 'publishNow', { text: 'hi' });
  assert.equal(results['ok-platform'].ok, true);
  assert.equal(results['ok-platform'].result.platformPostId, 'ok-1');
  assert.equal(results['bad-platform'].ok, false);
  assert.match(results['bad-platform'].error, /rate limited/);
});

// --- Facebook --------------------------------------------------------

test('facebook provider is unavailable without pageId/accessToken', () => {
  const provider = createFacebookProvider({});
  assert.equal(provider.healthStatus, 'unavailable');
});

test('facebook provider: authenticate, draft, schedule, publish, status', async () => {
  const calls = [];
  const fakeFetch = async (url) => {
    const { pathname, params } = parseUrl(url);
    calls.push({ pathname, params });
    if (pathname === '/v19.0/page1') return jsonResponse({ id: 'page1', name: 'Test Page' });
    if (pathname === '/v19.0/page1/feed') return jsonResponse({ id: `post-${calls.length}` });
    if (pathname === '/v19.0/post-3') return jsonResponse({ id: 'post-3', status_type: 'added' });
    throw new Error(`unexpected url ${url}`);
  };
  const provider = createFacebookProvider({ pageId: 'page1', accessToken: 'fb-token', fetchImpl: fakeFetch });

  const auth = await provider.authenticate();
  assert.equal(auth.accountId, 'page1');

  const draft = await provider.createDraft({ text: 'draft text' });
  assert.equal(draft.status, 'draft');
  assert.equal(calls[1].params.published, 'false');
  assert.equal(calls[1].params.scheduled_publish_time, undefined);

  const scheduled = await provider.schedulePublish({ text: 'later' }, '2030-01-01T00:00:00Z');
  assert.equal(scheduled.status, 'scheduled');
  assert.equal(scheduled.nativelyScheduled, true);
  assert.ok(calls[2].params.scheduled_publish_time);

  const status = await provider.getUploadStatus('post-3');
  assert.equal(status.status, 'added');
});

test('facebook provider posts to /photos when mediaType is image', async () => {
  const calls = [];
  const fakeFetch = async (url) => {
    const { pathname, params } = parseUrl(url);
    calls.push({ pathname, params });
    return jsonResponse({ id: 'photo-1', post_id: 'post-from-photo' });
  };
  const provider = createFacebookProvider({ pageId: 'page1', accessToken: 'fb-token', fetchImpl: fakeFetch });
  const result = await provider.publishNow({ text: 'caption', mediaType: 'image', mediaUrls: ['https://img.example/a.png'] });
  assert.equal(calls[0].pathname, '/v19.0/page1/photos');
  assert.equal(calls[0].params.url, 'https://img.example/a.png');
  assert.equal(result.platformPostId, 'photo-1');
});

// --- Instagram ---------------------------------------------------------

test('instagram provider: createDraft only creates a container, publishNow creates and publishes', async () => {
  const calls = [];
  const fakeFetch = async (url) => {
    const { pathname, params } = parseUrl(url);
    calls.push(pathname);
    if (pathname === '/v19.0/igUser/media') return jsonResponse({ id: 'container-1' });
    if (pathname === '/v19.0/igUser/media_publish') return jsonResponse({ id: 'media-1' });
    throw new Error(`unexpected ${url}`);
  };
  const provider = createInstagramProvider({ igUserId: 'igUser', accessToken: 'ig-token', fetchImpl: fakeFetch });

  const draft = await provider.createDraft({ text: 'caption', mediaType: 'image', mediaUrls: ['https://img.example/a.png'] });
  assert.equal(draft.platformPostId, 'container-1');
  assert.equal(draft.status, 'draft');
  assert.deepEqual(calls, ['/v19.0/igUser/media']);

  const published = await provider.publishNow({ text: 'caption', mediaType: 'image', mediaUrls: ['https://img.example/a.png'] });
  assert.equal(published.platformPostId, 'media-1');
  assert.equal(published.nativelyScheduled, true);
  assert.deepEqual(calls, ['/v19.0/igUser/media', '/v19.0/igUser/media', '/v19.0/igUser/media_publish']);
});

test('instagram provider schedulePublish is honest about not natively scheduling', async () => {
  const fakeFetch = async () => jsonResponse({ id: 'container-2' });
  const provider = createInstagramProvider({ igUserId: 'igUser', accessToken: 'ig-token', fetchImpl: fakeFetch });
  const result = await provider.schedulePublish({ text: 'x' }, '2030-01-01T00:00:00Z');
  assert.equal(result.nativelyScheduled, false);
  assert.match(result.note, /no native scheduled-publish/i);
});

// --- Threads -------------------------------------------------------------

test('threads provider follows the same container + publish flow as instagram', async () => {
  const calls = [];
  const fakeFetch = async (url) => {
    const { pathname } = parseUrl(url);
    calls.push(pathname);
    if (pathname === '/v1.0/threadsUser/threads') return jsonResponse({ id: 'thread-container-1' });
    if (pathname === '/v1.0/threadsUser/threads_publish') return jsonResponse({ id: 'thread-post-1' });
    throw new Error(`unexpected ${url}`);
  };
  const provider = createThreadsProvider({ threadsUserId: 'threadsUser', accessToken: 'th-token', fetchImpl: fakeFetch });
  const result = await provider.publishNow({ text: 'a thread post' });
  assert.equal(result.platformPostId, 'thread-post-1');
  assert.deepEqual(calls, ['/v1.0/threadsUser/threads', '/v1.0/threadsUser/threads_publish']);
});

// --- YouTube ------------------------------------------------------------

test('youtube provider uploads via the resumable flow and supports native scheduling', async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url, method: init?.method });
    if (url.includes('/upload/youtube/v3/videos')) {
      const body = JSON.parse(init.body);
      assert.equal(body.status.privacyStatus, 'private');
      assert.equal(body.status.publishAt, '2030-01-01T00:00:00Z');
      return jsonResponse({}, { headers: { location: 'https://upload.example/resumable/abc' } });
    }
    if (url === 'https://upload.example/resumable/abc') {
      return jsonResponse({ id: 'video-1' });
    }
    if (url === 'https://cdn.example/source.mp4') {
      return { ok: true, arrayBuffer: async () => new TextEncoder().encode('fake-video-bytes').buffer };
    }
    throw new Error(`unexpected ${url}`);
  };
  const provider = createYoutubeProvider({ accessToken: 'yt-token', fetchImpl: fakeFetch });
  const result = await provider.schedulePublish(
    { title: 'My Video', text: 'description', mediaUrls: ['https://cdn.example/source.mp4'] },
    '2030-01-01T00:00:00Z'
  );
  assert.equal(result.platformPostId, 'video-1');
  assert.equal(result.nativelyScheduled, true);
  assert.equal(calls.length, 3);
});

test('youtube provider getUploadStatus reports processing status', async () => {
  const fakeFetch = async (url) => {
    assert.match(url, /\/videos\?part=status,processingDetails&id=video-1$/);
    return jsonResponse({ items: [{ processingDetails: { processingStatus: 'succeeded' } }] });
  };
  const provider = createYoutubeProvider({ accessToken: 'yt-token', fetchImpl: fakeFetch });
  const status = await provider.getUploadStatus('video-1');
  assert.equal(status.status, 'succeeded');
});

// --- LinkedIn ------------------------------------------------------------

test('linkedin provider createDraft/schedulePublish never call the API (no native support)', async () => {
  let calls = 0;
  const fakeFetch = async () => {
    calls += 1;
    return jsonResponse({});
  };
  const provider = createLinkedinProvider({ accessToken: 'li-token', authorUrn: 'urn:li:person:1', fetchImpl: fakeFetch });
  const draft = await provider.createDraft({ text: 'x' });
  assert.equal(draft.platformPostId, null);
  assert.equal(draft.nativelyScheduled, false);
  const scheduled = await provider.schedulePublish({ text: 'x' }, '2030-01-01T00:00:00Z');
  assert.equal(scheduled.nativelyScheduled, false);
  assert.equal(calls, 0);
});

test('linkedin provider publishNow posts a text-only ugcPost', async () => {
  let captured;
  const fakeFetch = async (url, init) => {
    captured = { url, body: JSON.parse(init.body) };
    return jsonResponse({ id: 'urn:li:share:1' });
  };
  const provider = createLinkedinProvider({ accessToken: 'li-token', authorUrn: 'urn:li:person:1', fetchImpl: fakeFetch });
  const result = await provider.publishNow({ text: 'hello LinkedIn' });
  assert.equal(captured.url, 'https://api.linkedin.com/v2/ugcPosts');
  assert.equal(captured.body.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory, 'NONE');
  assert.equal(result.status, 'published');
});

test('linkedin provider publishNow uploads an image asset first', async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push(url);
    if (url.endsWith('/assets?action=registerUpload')) {
      return jsonResponse({
        value: {
          uploadMechanism: { 'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': { uploadUrl: 'https://upload.example/asset' } },
          asset: 'urn:li:digitalmediaAsset:1',
        },
      });
    }
    if (url === 'https://img.example/a.png') return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) };
    if (url === 'https://upload.example/asset') return jsonResponse({});
    if (url.endsWith('/ugcPosts')) {
      const body = JSON.parse(init.body);
      assert.equal(body.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory, 'IMAGE');
      assert.equal(body.specificContent['com.linkedin.ugc.ShareContent'].media[0].media, 'urn:li:digitalmediaAsset:1');
      return jsonResponse({ id: 'urn:li:share:2' });
    }
    throw new Error(`unexpected ${url}`);
  };
  const provider = createLinkedinProvider({ accessToken: 'li-token', authorUrn: 'urn:li:person:1', fetchImpl: fakeFetch });
  await provider.publishNow({ text: 'with image', mediaType: 'image', mediaUrls: ['https://img.example/a.png'] });
  assert.equal(calls.length, 4);
});

// --- X ---------------------------------------------------------------

test('x provider createDraft/schedulePublish never call the API (no native support)', async () => {
  let calls = 0;
  const fakeFetch = async () => { calls += 1; return jsonResponse({}); };
  const provider = createXProvider({ accessToken: 'x-token', fetchImpl: fakeFetch });
  await provider.createDraft({ text: 'x' });
  await provider.schedulePublish({ text: 'x' }, '2030-01-01T00:00:00Z');
  assert.equal(calls, 0);
});

test('x provider publishNow posts a text-only tweet', async () => {
  let captured;
  const fakeFetch = async (url, init) => {
    captured = { url, body: JSON.parse(init.body) };
    return jsonResponse({ data: { id: 'tweet-1', text: 'hi' } });
  };
  const provider = createXProvider({ accessToken: 'x-token', fetchImpl: fakeFetch });
  const result = await provider.publishNow({ text: 'hi' });
  assert.equal(captured.url, 'https://api.x.com/2/tweets');
  assert.equal(result.platformPostId, 'tweet-1');
});

test('x provider is unavailable with no access token', () => {
  const provider = createXProvider({});
  assert.equal(provider.healthStatus, 'unavailable');
});
