import {assert, expect} from "chai";
import {EventEmitter} from "events";
import {Cache} from "../../src/cache";
import {
  CalendarManager, ITimePoint,
} from "../../src/calendar";
import {Database} from "../../src/database";
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
    cal = new CalendarManager(cache, consumer);
  });
  after(async () => {
    await cache.stop();
    await db.stop();
  });

  describe("getTimeline", () => {
    it("should able to connect", async () => {
      await cal.connect();
      assert(cal);
      assert(cal.connected);
    });
    it("should return two busy slots by default", async () => {
      assert(cal !== undefined);
      const req = {id: {dayOffset: 0, minutesOfDay: 0},
                   lookForward: true, maxCount: 255};
      const entires = await cal.getTimeline(path, req);
      expect(entires.length).to.equal(2);
    });
    it("should only return one busy slot in the morning", async () => {
      assert(cal !== undefined);
      const req = {id: {dayOffset: 0, minutesOfDay: 16 * 60},
                   lookForward: false, maxCount: 255};
      const entires = await cal.getTimeline(path, req);
      expect(entires.length).to.equal(1);
    });
    it("should only return one busy slot in the afternoon", async () => {
      assert(cal !== undefined);
      const req = {id: {dayOffset: 0, minutesOfDay: 16 * 60},
                   lookForward: true, maxCount: 255};
      const entires = await cal.getTimeline(path, req);
      expect(entires.length).to.equal(1);
    });
  });
});
