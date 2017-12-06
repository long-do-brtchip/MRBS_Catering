import {expect, use} from "chai";
import chaiAsPromised = require("chai-as-promised");
import moment = require("moment");
import {MessageBuilder, ErrorCode} from "../../src/builder";
import { MessageBody } from "ews-javascript-api";
import { Buffer } from "buffer";
import { Contains } from "class-validator";
import { IMeetingInfo, ITimelineEntry } from "../../src/calendar";
import { Persist, IPanlConfig } from "../../src/persist";

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
  describe("builder test", () => {
    const now = moment().valueOf();
    it("build broadcast target", () => {
      const hdr = MessageBuilder.buildBroadcastTarget(10);
      const buf = Buffer.from([0, 255, 10, 0]);
      expect(hdr.byteLength).to.equal(4);
      expect(hdr).to.deep.equal(buf);
    });
    it("build expected fw version", () => {
      const hdr = MessageBuilder.buildExpectedFirmwareVersion();
      expect(hdr.byteLength).to.equal(3);
      const buf = Buffer.from([5, 0, 0]);
      expect(hdr).to.deep.equal(buf);
    });
    it("build time format", () => {
      const hdr = MessageBuilder.buildTimeFormat();
      expect(hdr.byteLength).to.equal(2);
      const buf = Buffer.from([4,0]);
      expect(hdr).to.deep.equal(buf);
    });
    it("build lang ID", () => {
      const hdr = MessageBuilder.buildLangID();
      expect(hdr.byteLength).to.equal(2);
      const buf = Buffer.from([8,0]);
      expect(hdr).to.deep.equal(buf);
    });
    it("build time", () => {
      const hdr = MessageBuilder.buildTime()
      expect(hdr.length).to.equal(5);
    });
    it("build UUID", () => {
      const hdr = MessageBuilder.buildUUID();
      expect(hdr.length).to.equal(1);
      const buf = Buffer.from([23]);
      expect(hdr).to.deep.equal(buf);
    });
    it("build UnconfiguredID", () => {
      const hdr = MessageBuilder.buildUnconfiguredID(65535);
      expect(hdr.length).to.equal(3);
      const buf = Buffer.from([24, 255, 255]);
      expect(hdr).to.deep.equal(buf);
    });
    it("should build incorrect timeline with single entry", () => {
      const id = Number(moment(now).startOf("day").add(129, "days"));
      expect(() => MessageBuilder.buildTimeline(
        [{start: now, end: now}], id)).to.throw(Error);
    });
    it("build MeetingInfo", () => {
      var meetInfo : IMeetingInfo = {
        organizer : "Tester User",
        subject : "Meeting for test phase"};
      const len = 1 + Buffer.from(meetInfo.organizer).byteLength +
      Buffer.from(meetInfo.subject).byteLength;
        const [hdr, ...entries] = MessageBuilder.buildMeetingInfo(meetInfo);
      expect(entries.length).to.equal(2);
      expect(entries[0].byteLength).to.equal(Buffer.from(meetInfo.subject).byteLength);
      expect(entries[1].byteLength).to.equal(Buffer.from(meetInfo.organizer).byteLength);
      expect(hdr.length).to.equal(3);
    });
    it("build Addmeeting", () => {
      var timeLine : ITimelineEntry = {
        start : Number(moment(now)),
        end : Number(moment(now).add(15, "minutes"))
      };
      const entry = MessageBuilder.buildAddMeeting(timeLine);
      expect(entry.byteLength).to.equal(6);
    });
    it("build MeetingEndTimeChanged", () => {
      var timeLine : ITimelineEntry = {
        start : Number(moment(now)),
        end : Number(moment(now).add(15, "minutes"))
      };
      const entry = MessageBuilder.buildMeetingEndTimeChanged(timeLine);
      expect(entry.byteLength).to.equal(6);
    });
    it("build DeleteMeeting", () => {
      const id = Number(moment(now).add(15, "minutes"));
      const entry = MessageBuilder.buildDeleteMeeting(id);
      expect(entry.byteLength).to.equal(4);
    });
    it("build UpdateMeeting", () => {
      const id = Number(moment(now));
      const entry = MessageBuilder.buildUpdateMeeting(id);
      expect(entry.byteLength).to.equal(4);
    });
    it("build Error Code", () => {
      const entry = MessageBuilder.buildErrorCode(ErrorCode.ERROR_SUCCESS);
      expect(entry.byteLength).to.equal(2);
      expect(entry).to.deep.equal(Buffer.from([22, 0]));
    });
    it("build Access Right", () => {
      const iPan = {timeout : 15,
        featureDisabled : {
          extendMeeting : true,
          claimMeeting : true,
          cancelMeeting : true,
          endMeeting : true,
          onSpotBooking : true,
          featureBooking : true,
        },
        authAllowPasscode : {
          extendMeeting : true,
          claimMeeting : true,
          cancelMeeting : true,
          endMeeting : true,
          onSpotBooking : true,
          featureBooking : true,
        },
        authAllowRFID : {
          extendMeeting : true,
          claimMeeting : true,
          cancelMeeting : true,
          endMeeting : true,
          onSpotBooking : true,
          featureBooking : true,
        }
      } as IPanlConfig;
      const entry = MessageBuilder.buildAccessRight(iPan);
      expect(entry.byteLength).to.equal(4);
      const buf = Buffer.from([11, 0x3F, 0x3F, 0x3F]);
      expect(entry).to.deep.equal(buf);
    });
  });
});
