import 'dotenv/config';
import { BskyAgent } from '@atproto/api';

const API_URL = 'https://api.cantinas.pt/api/v1/menus';

function resolveCredentials(userEnvKey, passEnvKey) {
  const user = process.env.BSKY_USER || process.env[userEnvKey];
  const pass = process.env.BSKY_PASS || process.env[passEnvKey];

  if (!user || !pass) {
    throw new Error(
      `Missing Bluesky credentials. Set BSKY_USER/BSKY_PASS or ${userEnvKey}/${passEnvKey}.`
    );
  }

  return { user, pass };
}

async function getMenu() {
  const res = await fetch(API_URL);

  if (!res.ok) {
    throw new Error(`Cantinas API request failed (${res.status}).`);
  }

  return await res.json();
}

function formatMeal(meal) {
  if (!meal?.items?.length) return null;

  const normalizeText = (text = '') =>
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  const isStrikeItem = item => {
    const normalized = normalizeText(item?.text || '');
    return normalized.includes('greve') && normalized.includes('funcao publica');
  };

  const strikeMessage = '⚠️ Greve da Função Pública. Serviço indisponível nesta refeição.';
  if (meal.items.every(isStrikeItem)) {
    return strikeMessage;
  }

  const map = {
    soup: '🥣',
    fish: '🐟',
    meat: '🍖',
    vegetarian: '🌱',
    diet: '🥗',
    other: '🍽️'
  };

  return meal.items
    .map(item => (isStrikeItem(item) ? strikeMessage : `${map[item.category] || '🍽️'} ${item.text}`))
    .join('\n');
}

function buildPosts(canteen) {
  const day = canteen.days?.[0];
  if (!day) return [];

  const now = new Date();
  const weekdayRaw = now.toLocaleDateString('pt-PT', { weekday: 'long' });
  const weekday = weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1);
  const dayMonth = now.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'long'
  });
  const formattedDate = `${weekday}, ${dayMonth}`;

  const posts = [];

  const lunch = day.meals.find(
    meal => meal.service === 'lunch' && meal.status === 'available'
  );

  if (lunch) {
    const lunchText = formatMeal(lunch);
    if (lunchText) {
      posts.push(`𝗔𝗹𝗺𝗼𝗰𝗼 • ${formattedDate}\n\n${lunchText}`);
    }
  }

  const dinner = day.meals.find(
    meal => meal.service === 'dinner' && meal.status === 'available'
  );

  if (dinner) {
    const dinnerText = formatMeal(dinner);
    if (dinnerText) {
      posts.push(`𝗝𝗮𝗻𝘁𝗮𝗿 • ${formattedDate}\n\n${dinnerText}`);
    }
  }

  return posts;
}

async function postAll(posts, credentials) {
  if (!posts.length) {
    console.log('No meals available to post today.');
    return;
  }

  const agent = new BskyAgent({
    service: 'https://bsky.social'
  });

  await agent.login({
    identifier: credentials.user,
    password: credentials.pass
  });

  for (const post of posts) {
    console.log('Posting:\n', post);

    await agent.post({
      text: post,
      createdAt: new Date().toISOString()
    });
  }
}

export async function runCanteen({ canteenId, canteenName, userEnvKey, passEnvKey }) {
  try {
    console.log(`Fetching menu for ${canteenName}...`);

    const data = await getMenu();
    const canteen = data?.canteens?.find(item => item.id === canteenId);

    if (!canteen) {
      console.log(`${canteenName} was not found in API response.`);
      return;
    }

    const credentials = resolveCredentials(userEnvKey, passEnvKey);
    const posts = buildPosts(canteen);

    console.log('\nGenerated posts:\n');
    posts.forEach(post => {
      console.log('-----');
      console.log(post);
    });

    await postAll(posts, credentials);

    console.log('\nPosted successfully.');
  } catch (error) {
    console.error('Error:', error);
    process.exitCode = 1;
  }
}
