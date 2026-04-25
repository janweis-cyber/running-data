import { GITHUB_API_BASE } from './constants';
import { ActivitySummary, ActivityDetail } from './types';

function decodeGitHubContent(content: string): unknown {
  const cleaned = content.replace(/\n/g, '');
  const decoded = atob(cleaned);
  return JSON.parse(decoded);
}

async function fetchGitHub(path: string): Promise<unknown> {
  const url = `${GITHUB_API_BASE}/${path}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.github.v3+json' },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${path}`);
  const envelope = await res.json();
  return decodeGitHubContent(envelope.content);
}

export async function fetchRecentActivities(): Promise<ActivitySummary[]> {
  const data = await fetchGitHub('recent.json') as { activities: ActivitySummary[] };
  return data.activities ?? [];
}

export async function fetchAllActivities(): Promise<ActivitySummary[]> {
  const data = await fetchGitHub('index.json') as { activities: ActivitySummary[] };
  return data.activities ?? [];
}

export async function fetchActivityDetail(id: string): Promise<ActivityDetail> {
  const data = await fetchGitHub(`activities/${id}.json`) as ActivityDetail;
  return data;
}
