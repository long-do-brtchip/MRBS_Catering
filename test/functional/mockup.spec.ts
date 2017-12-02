import {assert, expect} from "chai";
import {EventEmitter} from "events";
import moment = require("moment");
import {Cache} from "../../src/cache";
import {CalendarManager, ITimelineEntry} from "../../src/calendar";
import {Database} from "../../src/database";
import {Room} from "../../src/entity/hub/room";
import {ICalendarEvent} from "../../src/interface";
import {PanLPath} from "../../src/path";
import {CalendarType, Persist} from "../../src/persist";

class CalendarEventConsumer implements ICalendarEvent {
  public async onCalMgrReady(): Promise<void> {
    return;
  }

  public async onCalMgrError(err: Error): Promise<void> {
    return;
  }

  public async onAdd(path: PanLPath, entry: ITimelineEntry): Promise<void> {
    return;
  }

  public async onDelete(path: PanLPath, id: number): Promise<void> {
    return;
  }

  public async onUpdate(path: PanLPath, id: number): Promise<void> {
    return;
  }

  public async onEndTimeChanged(path: PanLPath, entry: ITimelineEntry):
  Promise<void> {
    return;
  }
}

describe("Mockup calendar module", () => {
  let cache: Cache;
  let cal: CalendarManager;
  let db: Database;
  const evt = new EventEmitter();
  const path = new PanLPath(1, 1);
  const consumer = new CalendarEventConsumer();

  before(async () => {
    db = await Database.getInstance();
    await Persist.setCalendarConfig({
      type: CalendarType.MOCKUP,
      address: "",
      username: "",
      password: "",
      readonly: false});
    cache = await Cache.getInstance();
    cal = new CalendarManager(cache, await Persist.getHubConfig(),
                              await Persist.getPanlConfig());
  });
  after(async () => {
    await cal.disconnect();
    await cache.stop();
    await db.stop();
  });

  const at = (s: string) => moment(s).valueOf();
  const roomName = "sentosa@ftdichip.com";
  describe("getTimeline", () => {
    const id = at("2017-12-01 14:30");
    it("should able to connect", async () => {
      await cal.connect(consumer);
      assert(cal);
      assert(cal.connected);
      const room = await Persist.findRoom(roomName);
      if (!room) {
        assert(0);
      } else {
        await cache.addConfigured(path, room);
      }
      expect(room).to.not.equal(undefined);
    });
    it("should return two busy slots by default", async () => {
      assert(cal !== undefined);
      const req = {
        id : moment(id).startOf("day").valueOf(),
        lookForward: true,
        maxCount: 255,
      };
      const entires = await cal.getTimeline(path, req);
      expect(entires.length).to.equal(2);
    });
    it("should only return one busy slot in the morning", async () => {
      assert(cal !== undefined);
      const req = {id, lookForward: false, maxCount: 255};
      const entires = await cal.getTimeline(path, req);
      expect(entires.length).to.equal(1);
    });
    it("should only return one busy slot in the afternoon", async () => {
      assert(cal !== undefined);
      const req = {id, lookForward: true, maxCount: 255};
      const entires = await cal.getTimeline(path, req);
      expect(entires.length).to.equal(1);
    });
  });
  describe("meeting", () => {
    it("should be able to create meeting", async () => {
      const id = at("2017-11-01 14:30");
      const end = at("2017-11-01 16:30");
      const req = {id, lookForward: true, maxCount: 255};

      await cache.setAuthSuccess(path, "panl@ftdichip.com");
      // Remove all timelines first
      await cache.setTimeline(roomName, id, []);
      let entries = await cal.getTimeline(path, req);
      expect(entries.length).to.equal(0);
      await cal.createBooking(path, {start: id, end});
      entries = await cal.getTimeline(path, req);
      expect(entries.length).to.equal(1);
      await cal.createBooking(path, {start: id, end});
      entries = await cal.getTimeline(path, req);
      expect(entries.length).to.equal(1);
    });
  });
});
