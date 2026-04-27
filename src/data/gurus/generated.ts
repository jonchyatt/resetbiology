// AUTO-GENERATED equivalent — guru profiles for /education/gurus/[slug].
// Source-of-truth lives in jarvis at data/gurus/<slug>.json. To refresh, run the
// jarvis sync (or copy <slug>.json files here manually for Phase 1).

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export type GuruChannels = {
  youtube: string | null;
  youtube_channel_handle?: string | null;
  podcast_name?: string | null;
  beehiiv_url?: string | null;
  website?: string | null;
};

export type GuruContentCorpus = {
  youtube_transcripts?: number;
  beehiiv_emails?: number;
  cheat_sheet_pdf?: string;
  total_peptide_mentions?: number;
  covered_peptides_count?: number;
  covered_peptides?: string[];
};

export type GuruSignatureTopic = {
  topic: string;
  evidence: string;
};

export type GuruProfile = {
  slug: string;
  name: string;
  title: string;
  bio: string;
  credentials: string[];
  photo_url: string | null;
  domains: string[];
  channels: GuruChannels;
  content_corpus: GuruContentCorpus;
  signature_topics: GuruSignatureTopic[];
  voice_quote: string | null;
  voice_quote_citation: string | null;
  added_to_library: string;
  library_status: 'active' | 'draft' | 'archived';
};

const DATA_DIR = join(process.cwd(), 'src/data/gurus');

export function getGuru(slug: string): GuruProfile | null {
  const path = join(DATA_DIR, `${slug}.json`);
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

export function listGuruSlugs(): string[] {
  return readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace(/\.json$/, ''));
}

export function listGurus(): GuruProfile[] {
  return listGuruSlugs()
    .map(slug => getGuru(slug))
    .filter((g): g is GuruProfile => g !== null && g.library_status === 'active');
}

export function listGurusByDomain(domain: string): GuruProfile[] {
  return listGurus().filter(g => g.domains.includes(domain));
}

export function listAllDomains(): string[] {
  const set = new Set<string>();
  for (const g of listGurus()) {
    for (const d of g.domains) set.add(d);
  }
  return Array.from(set).sort();
}

export function gurusForPeptide(peptideSlug: string): GuruProfile[] {
  return listGurus().filter(g => g.content_corpus.covered_peptides?.includes(peptideSlug));
}
