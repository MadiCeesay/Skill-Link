// Additive specification update. Does not change application data.
import { readFileSync, writeFileSync } from 'node:fs';
const file = new URL('../docs/openapi.json', import.meta.url);
const doc = JSON.parse(readFileSync(file, 'utf8'));
const schemas = doc.components.schemas;
const money = { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER };
const budget = { type: 'object', additionalProperties: false, required: ['minAmountBututs', 'maxAmountBututs'],
  description: 'Optional customer budget guide. Positive safe integer bututs, maximum >= minimum. Never the agreed price.',
  properties: { minAmountBututs: money, maxAmountBututs: money } };
const quote = { type: 'object', properties: { revision: { type: 'integer' }, amountBututs: money,
  note: { type: 'string', maxLength: 2000 }, expiresAt: { type: 'string', format: 'date-time' }, createdAt: { type: 'string', format: 'date-time' } } };
const write = schemas.DirectProposalWrite;
write.required = write.required.filter(k => k !== 'agreedAmountBututs');
Object.assign(write.properties, {
  pricingMode: { type: 'string', enum: ['REQUEST_QUOTE', 'LISTED_PRICE'] }, budget,
  listedAmountBututs: { ...money, description: 'Required with LISTED_PRICE; server verifies the current FIXED listing exactly matches.' },
  attachments: { type: 'array', maxItems: 5, uniqueItems: true, items: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
});
write.description = 'Use REQUEST_QUOTE without agreedAmountBututs, optionally budget/photos; or LISTED_PRICE with listedAmountBututs. Legacy clients without pricingMode must supply agreedAmountBututs. Requests do not hold a schedule.';
Object.assign(schemas.DirectProposal.properties, {
  pricingMode: write.properties.pricingMode, budget, attachments: write.properties.attachments,
  listedPrice: { type: 'object', properties: { type: { type: 'string', enum: ['FIXED'] }, amountBututs: money } },
  quoteRevision: { type: 'integer' }, quotes: { type: 'array', items: quote },
});
schemas.DirectProposal.required = schemas.DirectProposal.required?.filter(k => k !== 'agreedAmountBututs');
schemas.DirectProposal.properties.status.enum = ['PENDING', 'QUOTED', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED'];
schemas.DirectProfessionalQuoteWrite = { type: 'object', additionalProperties: false, required: ['amountBututs', 'revision'], properties: {
  amountBututs: money, revision: { type: 'integer', minimum: 0, maximum: 100 }, note: quote.properties.note,
  expiresAt: { type: 'string', format: 'date-time', description: 'Future time no later than the request deadline. Defaults to request deadline.' },
} };
schemas.DirectProfessionalQuoteAccept = { type: 'object', additionalProperties: false, required: ['revision'], properties: { revision: { type: 'integer', minimum: 1, maximum: 100 } } };
const original = doc.paths['/direct-proposals/{id}/accept'].post;
function action(path, summary, role, schema) {
  const operation = structuredClone(original);
  operation.summary = summary;
  operation.description = 'Roles: ' + role + '. ' + (path.endsWith('/accept-quote') ? 'Accept the current unexpired quote atomically with booking creation. Same accepted revision is idempotent. Rechecks eligibility, schedule and conflicts; authoritative amount comes from stored quote.' : 'Requires an open private quote request. Changes are serialized with acceptance and cancellation.');
  operation.requestBody = { required: true, content: { 'application/json': { schema: schema ? { $ref: '#/components/schemas/' + schema } : { type: 'object', additionalProperties: false } } } };
  delete operation.operationId;
  doc.paths[path] = { post: operation };
}
action('/direct-proposals/{id}/quote', 'Send or revise a formal private quote', 'WORKER', 'DirectProfessionalQuoteWrite');
action('/direct-proposals/{id}/accept-quote', 'Accept current private quote and create booking', 'CUSTOMER', 'DirectProfessionalQuoteAccept');
action('/direct-proposals/{id}/decline-quote', 'Decline quote and close private request', 'CUSTOMER');
const access = structuredClone(doc.paths['/direct-proposals/{id}'].get);
access.summary = 'Access a protected photo linked to a private proposal';
access.description = 'CUSTOMER or assigned WORKER only. Verifies proposal membership and attachment ownership. Returns a short-lived protected link; precise address/coordinates remain private.';
access.parameters.push({ name: 'mediaId', in: 'path', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } });
access.responses['200'] = { description: 'Temporary media access', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { url: { type: 'string', format: 'uri' }, expiresAt: { type: 'integer' } } } } } } } };
doc.paths['/direct-proposals/{id}/attachments/{mediaId}/access'] = { get: access };
writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
console.log('Flexible pricing API specification updated.');
