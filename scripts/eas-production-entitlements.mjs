/**
 * EAS keeps the committed native project. Local builds stay on development APNs.
 * A store build (profile production) switches the entitlement to production.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const profile = process.env.EAS_BUILD_PROFILE ?? '';
if (profile !== 'production') {
  process.stdout.write(`aps-environment unchanged for profile ${profile || 'local'}\n`);
  process.exit(0);
}

const files = [
  'ios/MomentsLocaux/MomentsLocaux.entitlements',
  'ios/MomentsLocaux/MomentsLocaux.paid-team.entitlements',
];

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const next = source.replace(
    /(<key>aps-environment<\/key>\s*<string>)development(<\/string>)/,
    '$1production$2',
  );
  if (next === source) {
    throw new Error(`${file} has no development aps-environment to switch`);
  }
  writeFileSync(file, next);
  process.stdout.write(`${file} aps-environment=production\n`);
}
