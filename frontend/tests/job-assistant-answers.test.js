import { expect, it } from 'vitest';
import { withAnswers } from '../src/components/JobAssistant';

const draft = { description: 'The kitchen tap is leaking.', followUpQuestions: ['Can the tap be turned off completely?', 'Do you have a replacement washer?'] };

it('adds only the answered follow-up questions to the description', () => {
  expect(withAnswers(draft, { 'Can the tap be turned off completely?': ' No ' }).description)
    .toBe('The kitchen tap is leaking.\n\nMore details:\n• Can the tap be turned off completely? No');
});
it('leaves the draft unchanged when nothing was answered', () => {
  expect(withAnswers(draft, { 'Do you have a replacement washer?': '  ' })).toBe(draft);
});
