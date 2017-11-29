import {ErrorCode} from "./builder";

export class HubError extends Error {
  constructor(message: string, private code: ErrorCode) {
    super(message);

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, HubError.prototype);
  }
}
