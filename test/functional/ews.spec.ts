import {expect, use} from "chai";
import chaiAsPromised = require("chai-as-promised");
import {Cache} from "../../src/cache";
import {CalendarManager, ITimePoint} from "../../src/calendar";
import {Database} from "../../src/database";
import {Room} from "../../src/entity/hub/room";
import {PanLPath} from "../../src/path";
import {CalendarType, Persist} from "../../src/persist";
import {ICalendarEvent} from "../../src/service";

class CalendarEventConsumer implements ICalendarEvent {
  public async onCalMgrReady(): Promise<void> {
    return;
  }

  public async onCalMgrError(err: Error): Promise<void> {
    return;
  }

  public async onAdd(path: PanLPath, id: ITimePoint, duration: number):
  Promise<void> {
    return;
  }

  public async onDelete(path: PanLPath, id: ITimePoint): Promise<void> {
    return;
  }

  public async onUpdate(path: PanLPath, id: ITimePoint): Promise<void> {
    return;
  }

  public async onExtend(path: PanLPath, id: ITimePoint, newDuration: number):
  Promise<void> {
    return;
  }
}

describe("EWS module", () => {
  let cal: CalendarManager;
  let cache: Cache;
  let db: Database;
  const path1 = new PanLPath(88, 88);
  const consumer = new CalendarEventConsumer();

  before(async () => {
    use(chaiAsPromised);
    cache = await Cache.getInstance();
    await cache.flush();
    cache.setExpiry(15);
    cache.addConfigured(path1, new Room(
      "tokyo@hanhzz.onmicrosoft.com", "Tokyo Room"));

    db = await Database.getInstance();

    Persist.setCalendarConfig({
      type: CalendarType.OFFICE365,
      address: "https://outlook.office365.com/EWS/Exchange.asmx",
      username: "tan@hanhzz.onmicrosoft.com",
      password: "T@nt3sting",
      readonly: false,
    });
    cal = new CalendarManager(cache, consumer, await Persist.getHubConfig(),
                              await Persist.getPanlConfig());
    await cal.connect();

  });
  after(async () => {
    await cache.stop();
    await db.stop();
  });

  describe("EWS Timeline", () => {
    it("should return exactly timeline by request",
      async function getTimeline() {
        this.slow(10000);
        const point = {dayOffset: 0, minutesOfDay: 0};
        const req = {
          id: point,
          lookForward: true,
          maxCount: 100,
        };
        const expectResult = [
          {start: 960, end: 1020},
          {start: 1080, end: 1110},
        ];

        // working comment because manual handle before test
        // expect(await cal.getTimeline(path1, req)).
        // to.deep.equal(expectResult);
      }).timeout(10000);
    it("should return empty timeline array", async function getTimeline() {
      this.slow(10000);
      const point = {dayOffset: -10, minutesOfDay: 0};
      const req = {
        id: point,
        lookForward: true,
        maxCount: 100,
      };

      // working comment because manual handle before test
      // expect(await cal.getTimeline(path1, req)).to.deep.equal([]);
    }).timeout(10000);
    it("should return exactly timeline by request from cache",
      async function getTimeline() {
        const point = {dayOffset: 0, minutesOfDay: 0};
        const req = {
          id: point,
          lookForward: true,
          maxCount: 100,
        };
        const expectResult = [
          {start: 960, end: 1020},
          {start: 1080, end: 1110},
        ];

        // working comment because manual handle before test
        // expect(await cal.getTimeline(path1, req)).to.deep.equal(expectResult)
      });
    it("should able create booking", async function createBooking() {
      this.slow(10000);
      const point = {dayOffset: 8, minutesOfDay: 8 * 60};
      const req = {
        id: point,
        lookForward: true,
        maxCount: 100,
      };
      const expectResult = [
        {start: 8 * 60, end: 9 * 60},
      ];

      await cal.createBooking(path1, point, 60);
      expect(await cal.getTimeline(path1, req)).to.deep.equal(expectResult);
      await cal.cancelMeeting(path1, point);
    }).timeout(10000);
    it("should able extend meeting", async function extendMeeting() {
      this.slow(10000);
      const point = {dayOffset: 13, minutesOfDay: 8 * 60};
      const req = {
        id: point,
        lookForward: true,
        maxCount: 100,
      };
      const expectResult = [
        {start: 8 * 60, end: 8 * 60 + 10 + 30},
      ];

      await cal.createBooking(path1, point, 10);
      // get for cache meeting Id
      await cal.getTimeline(path1, req);

      await cal.extendMeeting(path1, point, 30);
      // remove cache for get again
      await cache.removeTimelineEntry(path1, point);
      expect(await cal.getTimeline(path1, req)).to.deep.equal(expectResult);
      await cal.cancelMeeting(path1, point);
      await cache.removeTimelineEntry(path1, point);
    }).timeout(10000);

    it("should throw exception when end meeting earlier than StartDate",
      async function extendMeeting() {
        this.slow(1000);
        const point = {dayOffset: 6, minutesOfDay: 8 * 60};
        expect(cal.endMeeting(path1, point)).to.be.rejectedWith(Error);

        // expect(await cache.getMeetingInfo(path1, point)).to.deep.equal();
      }).timeout(10000);

    it("should able endMeeting meeting", async function extendMeeting() {
      this.slow(10000);
      const now = new Date();
      const minutesOfDay = (now.getHours() * 60) + now.getMinutes();

      const hour = now.getHours();
      const point = {dayOffset: 0, minutesOfDay: hour * 60};
      const point2 = {dayOffset: 0, minutesOfDay: hour * 60}; // plus buffer
      const req = {
        id: point2,
        lookForward: true,
        maxCount: 1,
      };

      await cal.createBooking(path1, point, 50);
      // get for cache meeting Id
      await cal.getTimeline(path1, req);

      await cal.endMeeting(path1, point);
      // remove cache for get again
      await cache.removeTimelineEntry(path1, point);
      const timline = await cal.getTimeline(path1, req) || [{end: -1}];
      expect(timline[0].end).to.lte(minutesOfDay);
      await cal.cancelMeeting(path1, point);
      await cache.removeTimelineEntry(path1, point);
    }).timeout(10000);

    it("should able cancel meeting", async function extendMeeting() {
      this.slow(10000);
      const point = {dayOffset: 11, minutesOfDay: 10 * 60};

      const req = {
        id: point,
        lookForward: true,
        maxCount: 100,
      };
      const expectResult = [
        {start: 10 * 60, end: 11 * 60},
      ];

      await cal.createBooking(path1, point, 60);
      // check create successfully
      expect(await cal.getTimeline(path1, req)).to.deep.equal(expectResult);

      await cal.cancelMeeting(path1, point);
      // clear internal cache
      await cache.removeTimelineEntry(path1, point);
      // check remove successfully
      expect(await cal.getTimeline(path1, req)).to.deep.equal([]);
    }).timeout(10000);

    it("should throw error if cancel meeting without organizer" +
      " for CancelCalendarItem action", async function extendMeeting() {
      this.slow(1000);
      const point = {dayOffset: 7, minutesOfDay: 8 * 60};

      // working comment because manual handle before test
      // expect(cal.cancelMeeting(path1, point)).to.be.rejectedWith(Error);
    }).timeout(10000);

    it("should able cancel unclaimed meeting", async function extendMeeting() {
      this.slow(10000);
      const point = {dayOffset: 9, minutesOfDay: 10 * 60};

      const req = {
        id: point,
        lookForward: true,
        maxCount: 100,
      };
      const expectResult = [
        {start: 10 * 60, end: 11 * 60},
      ];

      await cal.createBooking(path1, point, 60);
      // check create successfully
      expect(await cal.getTimeline(path1, req)).to.deep.equal(expectResult);

      await cal.cancelMeeting(path1, point);
      // clear internal cache
      await cache.removeTimelineEntry(path1, point);
      // check remove successfully
      expect(await cal.getTimeline(path1, req)).to.deep.equal([]);
    }).timeout(10000);
  });
});
