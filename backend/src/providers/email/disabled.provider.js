// Optional email adapter. No addresses, templates or credentials reach business DTOs.
export class DisabledEmailProvider {
  async send() {
    return { delivered: false };
  }
}
