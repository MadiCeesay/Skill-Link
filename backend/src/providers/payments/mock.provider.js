import { randomUUID } from 'node:crypto';
// Simulated only: this adapter never calls a payment network or stores bank details.
export class MockPaymentProvider {
  name = 'mock';
  async checkout({ outcome }) {
    return {
      status: { SUCCESS: 'HELD', FAILURE: 'FAILED', PENDING: 'PENDING' }[
        outcome
      ],
      reference: 'mock_' + randomUUID(),
    };
  }
}
