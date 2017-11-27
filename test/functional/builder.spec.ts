import {expect, use} from "chai";
import chaiAsPromised = require("chai-as-promised");
import moment = require("moment");
import {MessageBuilder} from "../../src/builder";

describe("Outgoing Message Builder module", () => {
  before(async () => {
    use(chaiAsPromised);
  });

  describe("build buffer", () => {
    const now = moment().valueOf();
    it("should build correct ASCII meeting room name", () => {
      const [hdr, name] = MessageBuilder.buildRoomName("test");
      expect(name.byteLength).to.equal(4);
    });
    it("should build correct 3-byte UTF8 meeting room name", () => {
      const [hdr, name] = MessageBuilder.buildRoomName("房间");
      expect(name.byteLength).to.equal(6);
    });
    it("should build correct 4-byte UTF8 meeting room name", () => {
      const [hdr, name] = MessageBuilder.buildRoomName("𡇙");
      expect(name.byteLength).to.equal(4);
    });
    it("should build correct timeline without entry", () => {
      const [hdr, ...entry] = MessageBuilder.buildTimeline([], now);
      expect(entry.length).to.equal(0);
    });
    it("should build correct timeline with single entry", () => {
      const [hdr, ...entry] = MessageBuilder.buildTimeline(
        [{start: now, end: now}], now);
      expect(entry.length).to.equal(1);
      expect(entry[0].byteLength).to.equal(4);
    });
    it("should build correct timeline with two entries", () => {
      const [hdr, ...entries] = MessageBuilder.buildTimeline(
        [{start: now, end: now}, {start: now, end: now}], now);
      expect(entries.length).to.equal(2);
      expect(entries[0].byteLength).to.equal(4);
      expect(entries[1].byteLength).to.equal(4);
    });
  });
});
