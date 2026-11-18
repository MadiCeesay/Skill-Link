import { describe, it, expect } from 'vitest';
import { hasContact } from '../../src/modules/conversations/contact.service.js';

// PURA changed Africell, Comium and QCell numbers from 7 to 9 digits on 4 September 2026
// (e.g. 220 3123456 became 220 833123456). Both formats must stay inside SkillLink.
describe('chat contact filter', () => {
  it.each([
    '+220 833123456', '+220833123456', '00220 877 123 456', '+220 (87) 712-3456',
    'call me 877123456', 'my number is 877 123 456', 'try 8 7 7 1 2 3 4 5 6', 'number: 877-123-456',
    '+220 3123456', 'call 3123456', '312 34 56',
    'email me at worker@example.com', 'wa.me/2203123456',
  ])('blocks %s', text => expect(hasContact(text)).toBe(true));

  it.each([
    'I can do it for GMD 650', 'The price is 1500 dalasi', 'Room is 3.5 x 4 metres', 'I need 200 bricks and 12 bags',
    'Come at 10:30 on 18/11/2026', 'It will take 2 to 3 days', 'Budget GMD 125000',
    'I have 12 years of experience', 'Booking 4d6d809 is confirmed',
  ])('allows %s', text => expect(hasContact(text)).toBe(false));
});
