import {assert, expect} from "chai";
import {EventEmitter} from "events";
import moment = require("moment");
import {Cache} from "../../src/cache";
import {CalendarManager, ITimelineEntry} from "../../src/calendar";
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

  public async onAdd(path: PanLPath, entry: ITimelineEntry): Promise<void> {
    return;
  }

  public async onDelete(path: PanLPath, id: number): Promise<void> {
    return;
  }

  public async onUpdate(path: PanLPath, id: number): Promise<void> {
    return;
  }

  public async onExtend(path: PanLPath, entry: ITimelineEntry): Promise<void> {
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
    cal = new CalendarManager(cache, consumer, await Persist.getHubConfig(),
                              await Persist.getPanlConfig());
    cache.addConfigured(path, new Room("test@test.com", "Test"));
  });
  after(async () => {
    await cal.disconnect();
    await cache.stop();
    await db.stop();
  });

  describe("getTimeline", () => {
    const startOfDay = moment().startOf("day");
    it("should able to connect", async () => {
      await cal.connect();
      assert(cal);
      assert(cal.connected);
    });
    it("should return two busy slots by default", async () => {
      assert(cal !== undefined);
      const req = {id: startOfDay.valueOf(),
                   lookForward: true, maxCount: 255};
      const entires = await cal.getTimeline(path, req);
      expect(entires.length).to.equal(2);
    });
    it("should only return one busy slot in the morning", async () => {
      assert(cal !== undefined);
      const req = {id: startOfDay.hour(16).valueOf(),
                   lookForward: false, maxCount: 255};
      const entires = await cal.getTimeline(path, req);
      expect(entires.length).to.equal(1);
    });
    it("should only return one busy slot in the afternoon", async () => {
      assert(cal !== undefined);
      const req = {id: startOfDay.hour(16).valueOf(),
                   lookForward: true, maxCount: 255};
      const entires = await cal.getTimeline(path, req);
      expect(entires.length).to.equal(1);
    });
  });
});
