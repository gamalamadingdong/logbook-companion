import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { releaseOffer as fallbackOffer } from './_generated-offer.mjs';
import { evaluateUpdateOffer } from '../lib/update-offer.mjs';

function loadReleaseOffer() {
  try {
    return JSON.parse(readFileSync(fileURLToPath(new URL('../dist/release-offer.json', import.meta.url)), 'utf8'));
  } catch {
    return fallbackOffer;
  }
}

function readBody(req) {
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  return req.body ?? {};
}

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'method_not_allowed' });
  try {
    return res.status(200).json(evaluateUpdateOffer(readBody(req), loadReleaseOffer(), 'beta'));
  } catch {
    return res.status(400).json({ message: 'malformed_request' });
  }
}
