import {assert, expect, use} from "chai";
import chaiAsPromised = require("chai-as-promised");
import {MessageBuilder} from "../../src/builder";
import {IMeetingInfo, ITimeline, ITimelineEntry} from "../../src/calender";
import {PanLPath} from "../../src/path";

describe("Outgoing Message Builder module", () => {
  before(async () => {
    use(chaiAsPromised);
  });

  describe("build buffer", () => {
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
    it("should build correct timeline with single entry", () => {
      const [hdr, ...entry] = MessageBuilder.buildTimeline({
        dayOffset: 1,
        entries: [{start: 1, end: 2}],
      });
      expect(entry.length).to.equal(1);
      expect(entry[0].byteLength).to.equal(4);
    });
    it("should build correct timeline with two entries", () => {
      const [hdr, ...entries] = MessageBuilder.buildTimeline({
        dayOffset: 1,
        entries: [{start: 1, end: 2}, {start: 3, end: 4}],
      });
      expect(entries.length).to.equal(2);
      expect(entries[0].byteLength).to.equal(4);
      expect(entries[1].byteLength).to.equal(4);
    });
  });
});
