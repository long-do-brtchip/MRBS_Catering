export class HubError extends Error {
  constructor(message: string, private code: string) {
    super(message);

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, HubError.prototype);
  }
}
