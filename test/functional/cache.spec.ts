import {assert, expect, use} from "chai";
import chaiAsPromised = require("chai-as-promised");
import moment = require("moment");
import {Cache} from "../../src/cache";
import {ITimelineEntry} from "../../src/calendar";
import {Room} from "../../src/entity/hub/room";
import {log} from "../../src/log";
import {PanLPath} from "../../src/path";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Cache module", () => {
  let cache: Cache;

  before(async () => {
    use(chaiAsPromised);
    cache = await Cache.getInstance();
    await cache.flush();
  });
  after(async () => {
    await cache.stop();
  });

  describe("Unconfigured ID", () => {
    const uuids: Buffer[] = [
      new Buffer([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]),
      new Buffer([0x02, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]),
      new Buffer([0x03, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]),
    ];
    it("flush should reset number", async () => {
      const results = await Promise.all([
        cache.addUnconfigured(new PanLPath(1, 1), uuids[0]),
        cache.addUnconfigured(new PanLPath(1, 2), uuids[1]),
      ]);
      await cache.flush();
      const now = await cache.addUnconfigured(new PanLPath(1, 2), uuids[1]);
      expect(results[0]).to.equal(now);
    });
    it("should increase for new path", async () => {
      await cache.flush();
      const results = await Promise.all([
        cache.addUnconfigured(new PanLPath(1, 1), uuids[0]),
        cache.addUnconfigured(new PanLPath(1, 2), uuids[1]),
        cache.addUnconfigured(new PanLPath(1, 3), uuids[2]),
      ]);
      expect(results[0] + 2).to.equal(results[2]);
    });
    it("should be the same for the same path", async () => {
      expect(await cache.addUnconfigured(new PanLPath(1, 1), uuids[0]))
        .to.equal(await cache.addUnconfigured(new PanLPath(1, 1), uuids[0]));
    });
    it("should be the same after reconnect database", async () => {
      const id = await cache.addUnconfigured(new PanLPath(1, 1), uuids[0]);
      await cache.stop();
      cache = await Cache.getInstance();
      expect(id).to.equal(
        await cache.addUnconfigured(new PanLPath(1, 1), uuids[0]));
      expect(id).to.not.equal(
        await cache.addUnconfigured(new PanLPath(1, 2), uuids[1]));
    });
    it("should be the same after reconnect agent", async () => {
      const id = await cache.addUnconfigured(new PanLPath(1, 1), uuids[0]);
      await cache.removeAgent(1);
      expect(await cache.addUnconfigured(new PanLPath(1, 1), uuids[0]))
        .to.equal(id);
    });
    it("should return unconfigured ID", async () => {
      const id = await cache.addUnconfigured(new PanLPath(1, 1), uuids[0]);
      const ret = await cache.getUnconfigured(id);
      assert(ret);
      if (ret) {
        const [path, uuid] = ret;
        expect(path.dest).to.equal(1);
      }
    });
  });

  const room = "test1@ftdi.local";
  describe("Configured ID", () => {
    const room2 = "test2@ftdi.local";
    const path1 = new PanLPath(1, 1);
    const path2 = new PanLPath(1, 2);
    it("should linked to room name and address", async () => {
      const path4 = new PanLPath(1, 4);
      await cache.addUnconfigured(path1,
        new Buffer([0x04, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]));
      await cache.addConfigured(path1,
        new Room(room, "Test Room 1"));
      await cache.addConfigured(path2,
        new Room(room2, "Test Room 2"));
      await cache.addConfigured(path4,
        new Room("test4@ftdi.local", "Test Room 4"));
      expect(await cache.getRoomAddress(path1)).equal(room);
      expect(await cache.getRoomAddress(path2)).equal(room2);
      expect(await cache.getRoomName(room)).equal("Test Room 1");
      expect(await cache.getRoomName(room2)).equal("Test Room 2");
    });
    it("linked room address shall be removed after agent disconnected",
      async () => {
      await cache.removeAgent(1);
      expect(cache.getRoomAddress(path1)).to.be.rejectedWith(Error);
      expect(cache.getRoomAddress(path2)).to.be.rejectedWith(Error);
      expect(cache.getRoomName(room)).to.be.rejectedWith(Error);
      expect(cache.getRoomName(room2)).to.be.rejectedWith(Error);
    });
    it("should be able to saved to pending list", async () => {
      await cache.addPending(path1);
      await cache.addPending(path2);
      let list = [path1, path2];
      await cache.consumePending((path) => {
        list = list.filter((item) => item.uid !== path.uid);
      });
      expect(list.length).to.equal(0);
    });
  });

  describe("TimeLine", () => {
    const today = (h: number, m: number) =>
      moment().startOf("day").hour(h).minute(m).valueOf();
    const minutesMore = (m: number) => m * 60 * 1000;
    const tomorrow = (h: number, m: number) =>
      moment().startOf("day").add(1, "day").hour(h).minute(m).valueOf();
    const sortAsc = (a: ITimelineEntry, b: ITimelineEntry) => a.start - b.start;
    it("Should return undefined when day without cache", async () => {
      await cache.flush();
      const req = {
        id: moment().startOf("day").valueOf(),
        lookForward: true,
        maxCount: 2,
      };
      expect(await cache.getTimeline(room, req)).to.deep.equal(undefined);
    });
    it("Should return empty array when search range has no meeting",
      async () => {
        await cache.flush();
        const req = {
          id: today(0, 0),
          lookForward: false,
          maxCount: 2,
        };
        const entries = [
          {start: today(6, 40), end: today(7, 40)},
          {start: today(8, 40), end: today(9, 40)},
        ];
        await cache.setTimeline(room, today(0, 0), entries);
        expect(await cache.getTimeline(room, req)).to.deep.equal([]);
    });
    it("Should return timeline sorted by startTime and exactly saved before",
      async () => {
        await cache.flush();
        const req = {
          id: today(6, 40),
          lookForward: true,
          maxCount: 100,
        };
        const entries = [
          {start: today(9, 50), end: today(10, 20)},
          {start: today(12, 0), end: today(12, 20)},
          {start: today(17, 10), end: today(17, 40)},
        ];
        await cache.setTimeline(room, today(0, 0), []);
        await Promise.all(entries.slice(0).reverse().map(
          (e) => cache.setTimelineEntry(room, e)));
        const timeline = await cache.getTimeline(room, req);
        expect(timeline).to.deep.equal(entries);
    });
    it("Should return timeline sorted by startTime and exactly after modified",
      async () => {
        await cache.flush();
        const req = {
          id: today(6, 40),
          lookForward: true,
          maxCount: 100,
        };
        const entries = [
          {start: today(7, 30), end: today(8, 0)},
          {start: today(9, 50), end: today(10, 20)},
          {start: today(12, 0), end: today(12, 40)},
        ];
        const modified = entries.slice(0);
        modified[1].end = modified[1].end + minutesMore(30);
        await cache.setTimeline(room, today(0, 0), modified);
        await cache.setTimelineEntry(room, entries[1]);
        const tl = await cache.getTimeline(room, req);
        expect(tl).to.deep.equal(entries);
    });
    it("Should return timeline sorted by startTime and exactly after removed",
      async () => {
        await cache.flush();
        const req = {
          id: today(2, 10),
          lookForward: true,
          maxCount: 100,
        };
        const entries = [
          {start: today(7, 30), end: today(7, 40)},
          {start: today(12, 0), end: today(12, 20)},
          {start: today(9, 50), end: today(10, 0)},
          {start: today(15, 0), end: today(15, 40)},
        ];
        await cache.setTimeline(room, today(0, 0), entries);
        await cache.removeTimelineEntry(room, entries[0].start);
        entries.shift();
        const tl = await cache.getTimeline(room, req);
        expect(tl).to.deep.equal(entries.sort(sortAsc));
    });
    it("Should return a part of timeline before timepoint when " +
      "look backwards and timepoint do not matching any startTime",
      async () => {
        await cache.flush();
        const req = {
          id: today(13, 20),
          lookForward: false, // searching before point
          maxCount: 100,
        };
        const entries = [
          {start: today(7, 30), end: today(7, 40)},
          {start: today(12, 0), end: today(12, 20)},
          {start: today(9, 50), end: today(10, 0)},
          {start: today(15, 0), end: today(15, 40)},
        ];
        await cache.setTimeline(room, today(0, 0), entries);
        const tl = await cache.getTimeline(room, req);
        entries.pop();
        expect(tl).to.deep.equal(entries.sort(sortAsc));
    });
    it("Should return a part of timeline after timepoint when " +
      "look forwards and timepoint do not matching any startTime",
      async () => {
        await cache.flush();
        const req = {
          id: today(11, 40),
          lookForward: true,
          maxCount: 100,
        };
        const entries = [
          {start: today(7, 30), end: today(7, 40)},
          {start: today(12, 0), end: today(12, 20)},
          {start: today(9, 50), end: today(10, 0)},
          {start: today(15, 0), end: today(15, 40)},
        ];
        await cache.setTimeline(room, today(0, 0), entries);
        entries.sort(sortAsc);
        const tl = await cache.getTimeline(room, req);
        expect(tl).to.deep.equal(entries.slice(2));
    });
    it(`When look backwards, the requested timepoint should not be included`,
      async () => {
        await cache.flush();
        const req = {
          id: today(12, 0),
          lookForward: false,
          maxCount: 100,
        };
        const entries = [
          {start: today(7, 30), end: today(7, 40)},
          {start: today(12, 0), end: today(12, 20)},
          {start: today(9, 50), end: today(10, 0)},
          {start: today(15, 0), end: today(15, 40)},
        ];
        await cache.setTimeline(room, today(0, 0), entries);
        const tl = await cache.getTimeline(room, req);
        expect(tl).to.deep.equal(entries.sort(sortAsc).slice(0, 2));
    });
    it(`When look forwards, the requested timepoint should be included`,
      async () => {
        await cache.flush();
        const req = {
          id: today(9, 50),
          lookForward: true,
          maxCount: 100,
        };
        const entries = [
          {start: today(7, 30), end: today(7, 40)},
          {start: today(12, 0), end: today(12, 20)},
          {start: today(9, 50), end: today(10, 0)},
          {start: today(15, 0), end: today(15, 40)},
        ];
        await cache.setTimeline(room, today(0, 0), entries);
        const tl = await cache.getTimeline(room, req);
        expect(tl).to.deep.equal(entries.sort(sortAsc).slice(1));
    });
    it("Should return fixed timline size by maxCount",
      async () => {
        await cache.flush();
        const entries = [
          {start: today(7, 30), end: today(7, 40)},
          {start: today(12, 0), end: today(12, 20)},
          {start: today(9, 50), end: today(10, 0)},
          {start: today(15, 0), end: today(15, 40)},
        ];
        const req = {
          id: today(12, 20),
          lookForward: false, // searching before point
          maxCount: 1,
        };
        await cache.setTimeline(room, today(0, 0), entries);
        const tl = await cache.getTimeline(room, req);
        expect(tl).to.deep.equal(entries.slice(1, 2));
      });

    it("should return undefined after timeline expired",
      async function expiryTest() {
      this.slow(3000);
      const req = {
        id: tomorrow(0, 0),
        lookForward: true,
        maxCount: 100,
      };
      process.on("unhandledRejection", (r) => log.error(r));
      await cache.flush();
      cache.setExpiry(1);
      await cache.setTimeline(room, tomorrow(0, 0), [
        {start: tomorrow(2, 0), end: tomorrow(2, 30)},
      ]);
      await sleep(1050);
      expect(await cache.getTimeline(room, req)).equal(undefined);
    });
    // Set timeline expire to 2 seconds, one second later get timeline
    // but do not get meeting info, expect meeting info,
    // meeting id and timeline all should exists after another one second,
    // expect all should not exists one second later.
    it("Should expired meetingInfo and meetingId when timeline expired",
      async function expiredAll() {
        this.slow(5000);
        await cache.flush();
        const entries = [
          {start: tomorrow(5, 50), end: tomorrow(7, 40)},
          {start: tomorrow(8, 40), end: tomorrow(8, 50)},
          {start: tomorrow(11, 20), end: tomorrow(12, 35)},
        ];
        const infos = [
          {subject: "Meeting_1", organizer: "TanNguyen"},
          {subject: "Meeting_2", organizer: "TanNguyen"},
          {subject: "Meeting_3", organizer: "TanNguyen"},
        ];
        const req = {
          id: tomorrow(5, 50),
          lookForward: true,
          maxCount: 100,
        };
        cache.setExpiry(1);
        await Promise.all([
          cache.setTimeline(room, tomorrow(0, 0), entries),
          cache.setMeetingInfo(room, entries[2].start, infos[2]),
          cache.setMeetingInfo(room, entries[0].start, infos[0]),
          cache.setMeetingInfo(room, entries[1].start, infos[1]),
        ]);
        await sleep(300);
        // 0.3 second later
        const tl1 = await cache.getTimeline(room, req);
        expect(tl1).to.deep.equal(entries);
        await sleep(800);
        // 0.8 second later
        const info = await cache.getMeetingInfo(room, entries[1].start);
        expect(info).to.deep.equal(infos[1]);
        await sleep(300);
        // 0.3 second later
        expect(cache.getMeetingInfo(room, entries[1].start))
          .to.be.rejectedWith("Meeting info not found");
    }).timeout(8000);
  });
});
