import { readFile, writeFile } from 'node:fs/promises';
const file = new URL('../docs/openapi.json', import.meta.url);
const document = JSON.parse(await readFile(file, 'utf8'));
document.paths['/bookings/{id}'].get.responses['200'].content['application/json'].schema.properties.data.properties.reviewEligibility = {
  type: 'object', additionalProperties: false,
  description: 'Participant read eligibility. Only the owning customer of a completed, unreviewed booking canReview. No review or private participant fields are exposed.',
  required: ['canReview', 'hasReviewed'],
  properties: { canReview: { type: 'boolean' }, hasReviewed: { type: 'boolean' } },
};
await writeFile(file, JSON.stringify(document, null, 2) + '\n');
