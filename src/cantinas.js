import 'dotenv/config';
import { BskyAgent } from '@atproto/api';

const API_URL = 'https://api.cantinas.pt/api/v1/menus';
const POST_LIMIT = 300;
const EXCLUDED_CANTEEN_IDS = new Set(['tresde']);

const BOLD_MAP = {
  a: '𝗮', b: '𝗯', c: '𝗰', d: '𝗱', e: '𝗲', f: '𝗳', g: '𝗴', h: '𝗵', i: '𝗶', j: '𝗷',
  k: '𝗸', l: '𝗹', m: '𝗺', n: '𝗻', o: '𝗼', p: '𝗽', q: '𝗾', r: '𝗿', s: '𝘀', t: '𝘁',
  u: '𝘂', v: '𝘃', w: '𝘄', x: '𝘅', y: '𝘆', z: '𝘇',
  A: '𝗔', B: '𝗕', C: '𝗖', D: '𝗗', E: '𝗘', F: '𝗙', G: '𝗚', H: '𝗛', I: '𝗜', J: '𝗝',
  K: '𝗞', L: '𝗟', M: '𝗠', N: '𝗡', O: '𝗢', P: '𝗣', Q: '𝗤', R: '𝗥', S: '𝗦', T: '𝗧',
  U: '𝗨', V: '𝗩', W: '𝗪', X: '𝗫', Y: '𝗬', Z: '𝗭',
  0: '𝟬', 1: '𝟭', 2: '𝟮', 3: '𝟯', 4: '𝟰', 5: '𝟱', 6: '𝟲', 7: '𝟳', 8: '𝟴', 9: '𝟵'
};

function toUnicodeBold(text = '') {
  return [...text].map(char => BOLD_MAP[char] || char).join('');
}

function resolveCredentials() {
  const user = process.env.BSKY_USER || process.env.BSKY_USER_CANTINAS;
  const pass = process.env.BSKY_PASS || process.env.BSKY_PASS_CANTINAS;

  if (!user || !pass) {
    throw new Error(
      'Missing Bluesky credentials. Set BSKY_USER/BSKY_PASS or BSKY_USER_CANTINAS/BSKY_PASS_CANTINAS.'
    );
  }

  return { user, pass };
}

async function getMenus() {
  const res = await fetch(API_URL);

  if (!res.ok) {
    throw new Error(`Cantinas API request failed (${res.status}).`);
  }

  return await res.json();
}

function getFormattedDate() {
  const now = new Date();
  const weekdayRaw = now.toLocaleDateString('pt-PT', { weekday: 'long' });
  const weekday = weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1);
  const dayMonth = now.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'long'
  });

  return `${weekday}, ${dayMonth}`;
}

function toMealLines(items = []) {
  const map = {
    soup: '🥣',
    fish: '🐟',
    meat: '🍖',
    vegetarian: '🌱',
    diet: '🥗',
    other: '🍽️'
  };

  return items.map(item => `${map[item.category] || '🍽️'} ${item.text}`);
}

function splitPost(title, lines) {
  const posts = [];
  let current = `${title}\n\n`;

  for (const line of lines) {
    const candidate = `${current}${line}\n`;

    if (candidate.length > POST_LIMIT) {
      posts.push(current.trimEnd());
      current = `${title} (cont.)\n\n${line}\n`;

      if (current.length > POST_LIMIT) {
        // Guard rail for unusually long menu item text.
        posts.push(current.slice(0, POST_LIMIT));
        current = `${title} (cont.)\n\n`;
      }

      continue;
    }

    current = candidate;
  }

  if (current.trim()) {
    posts.push(current.trimEnd());
  }

  return posts;
}

function buildThreadPosts(canteens) {
  const formattedDate = getFormattedDate();
  const mealPosts = [];

  const sorted = [...canteens]
    .filter(canteen => !EXCLUDED_CANTEEN_IDS.has(canteen.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'));

  for (const canteen of sorted) {
    const day = canteen.days?.[0];
    if (!day?.meals?.length) continue;

    const availableMeals = day.meals.filter(meal => meal.status === 'available');
    for (const meal of availableMeals) {
      const lines = toMealLines(meal.items);
      if (!lines.length) continue;

      const serviceLabel = meal.service === 'lunch' ? 'Almoço' : meal.service === 'dinner' ? 'Jantar' : 'Refeicao';
      const title = `📍 ${toUnicodeBold(canteen.name)} • ${serviceLabel} • ${formattedDate}`;

      mealPosts.push(...splitPost(title, lines));
    }
  }

  if (!mealPosts.length) {
    return [];
  }

  const intro = `Ementas disponíveis de ${formattedDate}.`;

  return [intro, ...mealPosts];
}

async function postThread(posts, credentials) {
  if (!posts.length) {
    console.log('No meals available to post today.');
    return;
  }

  console.log('\nGenerated thread posts:\n');
  posts.forEach((post, index) => {
    console.log(`----- [${index + 1}/${posts.length}]`);
    console.log(post);
  });

  const isDryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
  if (isDryRun) {
    console.log('\nDRY_RUN enabled. Skipping Bluesky publish.');
    return;
  }

  const agent = new BskyAgent({
    service: 'https://bsky.social'
  });

  await agent.login({
    identifier: credentials.user,
    password: credentials.pass
  });

  const root = await agent.post({
    text: posts[0],
    createdAt: new Date().toISOString()
  });

  let parent = root;

  for (const post of posts.slice(1)) {
    parent = await agent.post({
      text: post,
      createdAt: new Date().toISOString(),
      reply: {
        root: {
          uri: root.uri,
          cid: root.cid
        },
        parent: {
          uri: parent.uri,
          cid: parent.cid
        }
      }
    });
  }
}

async function run() {
  try {
    console.log('Fetching menus for all canteens...');

    const data = await getMenus();
    const canteens = data?.canteens || [];

    const credentials = resolveCredentials();
    const posts = buildThreadPosts(canteens);

    await postThread(posts, credentials);

    console.log('\nDone.');
  } catch (error) {
    console.error('Error:', error);
    process.exitCode = 1;
  }
}

run();
