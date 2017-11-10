import {assert, expect, use} from "chai";
import chaiAsPromised = require("chai-as-promised");
import {Cache} from "../../src/cache";
import {PanLPath} from "../../src/path";
import {sleep} from "../../utils/testUtil";

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
  });
  const path1 = new PanLPath(1, 1);
  const path2 = new PanLPath(1, 2);
  describe("Configured ID", () => {
    it("should linked to room name and address", async () => {
      const path4 = new PanLPath(1, 4);
      await cache.addUnconfigured(path1,
        new Buffer([0x04, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]));
      await cache.addConfigured(
        path1, {address: "test1@ftdi.local", name: "Test Room 1"});
      await cache.addConfigured(
        path2, {address: "test2@ftdi.local", name: "Test Room 2"});
      await cache.addConfigured(
        path4, {address: "test4@ftdi.local", name: "Test Room 4"});
      expect(await cache.getRoomAddress(path1)).equal("test1@ftdi.local");
      expect(await cache.getRoomAddress(path2)).equal("test2@ftdi.local");
      expect(await cache.getRoomName(path1)).equal("Test Room 1");
      expect(await cache.getRoomName(path2)).equal("Test Room 2");
    });
    it("linked room address shall be removed after agent disconnected",
      async () => {
      await cache.removeAgent(1);
      expect(cache.getRoomAddress(path1)).to.be.rejectedWith(Error);
      expect(cache.getRoomAddress(path2)).to.be.rejectedWith(Error);
      expect(cache.getRoomName(path1)).to.be.rejectedWith(Error);
      expect(cache.getRoomName(path2)).to.be.rejectedWith(Error);
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
    it("undefined is returned for a day without cache", async () => {
      await cache.flush();
      const point = {dayOffset: 0, minutesOfDay: 0};
      const req = {
        id: point,
        lookForward: true,
        maxCount: 2,
      };
      expect(await cache.getTimeline(path1, req)).to.deep.equal(undefined);
    });
    it("zero length array is returned for a day been cached but no meeting",
      async () => {
      await cache.flush();
      const point = {dayOffset: 0, minutesOfDay: 0};
      const req = {
        id: point,
        lookForward: false,
        maxCount: 2,
      };
      const timeline = [{start: 480, end: 510}, {start: 590, end: 620}];

      await cache.setTimeline(path1, 0, timeline);
      expect(await cache.getTimeline(path1, req)).to.deep.equal([]);
    });
    it(`The returned timeline returns correct number of entries after
    setTimelineEntry insert a new entry, and sorted by startTime`, async () => {
      await cache.flush();
      const point = {dayOffset: 0, minutesOfDay: 400};
      const point1 = {dayOffset: 0, minutesOfDay: 450};
      const point2 = {dayOffset: 0, minutesOfDay: 720};
      const point3 = {dayOffset: 0, minutesOfDay: 590};

      const req = {
        id: point,
        lookForward: true, // searching after point
        maxCount: 100,
      };

      // 8h, 12h, 9h50
      const expectResult = [
        {start: 450, end: 480},
        {start: 590, end: 620},
        {start: 720, end: 740}];

      await Promise.all([
        cache.setTimelineEntry(path2, point3, 30),
        cache.setTimelineEntry(path2, point2, 20),
        cache.setTimelineEntry(path2, point1, 30),
      ]);

      expect(await cache.getTimeline(path2, req)).to.deep.equal(expectResult);
    });
    it("The returned timeline returns correct number of entries after" +
    "setTimelineEntry modify an entry, and sorted by startTime", async () => {
      await cache.flush();
      const point = {dayOffset: 0, minutesOfDay: 400};
      const point1 = {dayOffset: 0, minutesOfDay: 450};
      const point2 = {dayOffset: 0, minutesOfDay: 720};
      const point3 = {dayOffset: 0, minutesOfDay: 590};

      const req = {
        id: point,
        lookForward: true, // searching after point
        maxCount: 100,
      };

      // 8h, 12h, 9h50
      const expectResult = [
        {start: 450, end: 480},
        {start: 590, end: 620},
        {start: 720, end: 800}];

      await Promise.all([
        cache.setTimelineEntry(path2, point1, 30),
        cache.setTimelineEntry(path2, point2, 20),
        cache.setTimelineEntry(path2, point3, 30),
        cache.setTimelineEntry(path2, point2, 80),
      ]);

      expect(await cache.getTimeline(path2, req)).to.deep.equal(expectResult);
    });
    it("The returned timeline returns correct number of entries after" +
     "removeTimelineEntry delete an entry, and sorted by startTime",
      async () => {
      await cache.flush();
      const point = {dayOffset: 0, minutesOfDay: 130};
      const point1 = {dayOffset: 0, minutesOfDay: 450};
      const point2 = {dayOffset: 0, minutesOfDay: 720};
      const point3 = {dayOffset: 0, minutesOfDay: 590};
      const point4 = {dayOffset: 0, minutesOfDay: 900};

      const req = {
        id: point,
        lookForward: true, // searching after point
        maxCount: 100,
      };

      // 8h, 12h, 9h50
      const expectResult = [
        // {start: 450, end: 480},
        {start: 590, end: 670},
        {start: 720, end: 750},
        {start: 900, end: 980},
        ];

      await Promise.all([
        cache.setTimelineEntry(path2, point1, 30),
        cache.setTimelineEntry(path2, point2, 30),
        cache.setTimelineEntry(path2, point3, 80),
        cache.setTimelineEntry(path2, point4, 80),
      ]);

      await cache.removeTimelineEntry(path2, point1);
      expect(await cache.getTimeline(path2, req)).to.deep.equal(expectResult);
    });
    it("Request with a timepoint at which doesn't have any meeting can return" +
      "all the meetings before the timepoint", async () => {
      await cache.flush();
      const point = {dayOffset: 0, minutesOfDay: 800};
      const point1 = {dayOffset: 0, minutesOfDay: 450};
      const point2 = {dayOffset: 0, minutesOfDay: 720};
      const point3 = {dayOffset: 0, minutesOfDay: 590};
      const point4 = {dayOffset: 0, minutesOfDay: 900};

      const req = {
        id: point,
        lookForward: false, // searching before point
        maxCount: 100,
      };

      // 8h, 12h, 9h50
      const expectResult = [
        {start: 450, end: 480},
        {start: 590, end: 670},
        {start: 720, end: 750},
        // {start: 900, end: 980},
        ];

      await Promise.all([
        cache.setTimelineEntry(path2, point1, 30),
        cache.setTimelineEntry(path2, point2, 30),
        cache.setTimelineEntry(path2, point3, 80),
        cache.setTimelineEntry(path2, point4, 80),
      ]);

      expect(await cache.getTimeline(path2, req)).to.deep.equal(expectResult);
    });
    it(`Request with a timepoint at which doesn't have any meeting can return
      all the meetings after the timepoint`, async () => {
      await cache.flush();
      const point = {dayOffset: 0, minutesOfDay: 700};
      const point1 = {dayOffset: 0, minutesOfDay: 450};
      const point2 = {dayOffset: 0, minutesOfDay: 720};
      const point3 = {dayOffset: 0, minutesOfDay: 590};
      const point4 = {dayOffset: 0, minutesOfDay: 900};

      const req = {
        id: point,
        lookForward: true, // searching after point
        maxCount: 100,
      };

      // 8h, 12h, 9h50
      const expectResult = [
        // {start: 450, end: 480},
        // {start: 590, end: 670},
        {start: 720, end: 750},
        {start: 900, end: 980},
      ];

      await Promise.all([
        cache.setTimelineEntry(path2, point1, 30),
        cache.setTimelineEntry(path2, point2, 30),
        cache.setTimelineEntry(path2, point3, 80),
        cache.setTimelineEntry(path2, point4, 80),
      ]);

      expect(await cache.getTimeline(path2, req)).to.deep.equal(expectResult);
    });
    it(`When look backwards, the requested timepoint should not be included`,
      async () => {
      await cache.flush();
      const point = {dayOffset: 0, minutesOfDay: 590};
      const point1 = {dayOffset: 0, minutesOfDay: 450};
      const point2 = {dayOffset: 0, minutesOfDay: 720};
      const point3 = {dayOffset: 0, minutesOfDay: 590};
      const point4 = {dayOffset: 0, minutesOfDay: 900};

      const req = {
        id: point,
        lookForward: true, // searching after point
        maxCount: 100,
      };

      const expectResult = [
        // {start: 450, end: 480},
        // {start: 590, end: 670},
        {start: 720, end: 750},
        {start: 900, end: 980},
        ];

      await Promise.all([
        cache.setTimelineEntry(path2, point1, 30),
        cache.setTimelineEntry(path2, point2, 30),
        cache.setTimelineEntry(path2, point3, 80),
        cache.setTimelineEntry(path2, point4, 80),
      ]);

      expect(await cache.getTimeline(path2, req)).to.deep.equal(expectResult);
    });
    it(`When look forwards, the requested timepoint should be included`,
      async () => {
      await cache.flush();
      const point = {dayOffset: 0, minutesOfDay: 720};
      const point1 = {dayOffset: 0, minutesOfDay: 450};
      const point2 = {dayOffset: 0, minutesOfDay: 720};
      const point3 = {dayOffset: 0, minutesOfDay: 590};
      const point4 = {dayOffset: 0, minutesOfDay: 900};

      const req = {
        id: point,
        lookForward: false, // searching before point
        maxCount: 100,
      };

      const expectResult = [
        {start: 450, end: 480},
        {start: 590, end: 670},
        {start: 720, end: 750},
        // {start: 900, end: 980},
      ];

      await Promise.all([
        cache.setTimelineEntry(path2, point1, 30),
        cache.setTimelineEntry(path2, point2, 30),
        cache.setTimelineEntry(path2, point3, 80),
        cache.setTimelineEntry(path2, point4, 80),
      ]);

      expect(await cache.getTimeline(path2, req)).to.deep.equal(expectResult);
    });
    it("should return undefined after timeline expired",
      async function expiryTest() {
      this.slow(5000);
      await cache.flush();
      cache.setExpiry(1);
      const pathx = new PanLPath(99, 99);
      const point = {dayOffset: 1, minutesOfDay: 120};
      const point1 = {dayOffset: 1, minutesOfDay: 450};

      const req = {
        id: point,
        lookForward: true, // searching after point
        maxCount: 100,
      };

      await cache.setTimelineEntry(pathx, point1, 30);
      await sleep(1190);
      expect(await cache.getTimeline(pathx, req)).equal(undefined);
    });
    // Set timeline expire to 2 seconds, one second later get timeline
    // but do not get meeting info, expect meeting info,
    // meeting id and timeline all should exists after another one second,
    // expect all should not exists one second later.
    it("Should expired meetingInfo and meetingId when timeline expired",
      async function expiredAll() {
      this.slow(10000);
      await cache.flush();
      cache.setExpiry(2);

      const point = {dayOffset: 1, minutesOfDay: 300};
      const point1 = {dayOffset: 1, minutesOfDay: 350};
      const point2 = {dayOffset: 1, minutesOfDay: 520};
      const point3 = {dayOffset: 1, minutesOfDay: 680};
      const req = {
        id: point,
        lookForward: true,
        maxCount: 100,
      };
      const p1 = {start: 350, end: 510 };
      const p2 = {start: 520, end: 530 };
      const p3 = {start: 680, end: 740 };
      const timeline = [p1, p2, p3];
      const expectResult = [p1, p2, p3];
      const m1 = {subject: "Meeting_1", organizer: "TanNguyen" };
      const m2 = {subject: "Meeting_2", organizer: "TanNguyen" };
      const m3 = {subject: "Meeting_3", organizer: "TanNguyen" };

      Promise.all([
        await cache.setTimeline(path1, 1, timeline),
        await cache.setMeetingInfo(path1, point1, m1),
        await cache.setMeetingInfo(path1, point2, m2),
        await cache.setMeetingInfo(path1, point3, m3),
        await cache.setMeetingId(path1, point1, "meeting_id_1"),
        await cache.setMeetingId(path1, point2, "meeting_id_2"),
        await cache.setMeetingId(path1, point3, "meeting_id_3"),
      ]);

      await sleep(1000);
      // 1 second later
      expect(await cache.getTimeline(path1, req)).to.deep.equal(expectResult);
      await sleep(500);
      // 1.5 second later
      expect(await cache.getMeetingInfo(path1, point1)).to.deep.equal(m1);
      expect(await cache.getMeetingId(path1, point1)).equal("meeting_id_1");
      await sleep(1600);
      // 3.1 second later
      // https://github.com/chaijs/chai/issues/415
      expect(cache.getMeetingInfo(path1, point2))
        .to.be.rejectedWith("Meeting info not found");

      expect(cache.getMeetingId(path1, point2))
        .to.be.rejectedWith("Meeting Id not found");
    }).timeout(5000);
  });
  describe("Day Offset", () => {
    it("should be able to setDayOffset");
    it("should be able to getDayOffset");
  });
});
