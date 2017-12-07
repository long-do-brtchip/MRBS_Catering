import {assert, expect} from "chai";
import {EventEmitter} from "events";
import moment = require("moment");
import {Cache} from "../../src/cache";
import {CalendarManager, ITimelineEntry} from "../../src/calendar";
import {Database} from "../../src/database";
import {Room} from "../../src/entity/hub/room";
import {ICalendarEvent} from "../../src/interface";
import {utQueryTime, utRoom} from "../../src/mockup";
import {PanLPath} from "../../src/path";
import {CalendarType, Persist} from "../../src/persist";

class CalendarEventConsumer implements ICalendarEvent<PanLPath> {
  public async onAdd(path: PanLPath, entry: ITimelineEntry) {
    return;
  }

  public async onDelete(path: PanLPath, id: number) {
    return;
  }

  public async onMeetingUpdate(path: PanLPath, id: number) {
    return;
  }

  public async onEndTimeChange(path: PanLPath, entry: ITimelineEntry) {
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
    await cal.connect(consumer);
    const room = await Persist.findRoom(utRoom);
    if (room) {
      await cache.addConfigured(path, room);
    }
  });
  after(async () => {
    cache.removeAgent(path.agent);
    await cal.disconnect();
    await cache.stop();
    await db.stop();
  });

  const at = (s: string) => moment(s).valueOf();
  describe("getTimeline", () => {
    it("should return two busy slots by default", async () => {
      assert(cal !== undefined);
      const req = {
        id : moment(utQueryTime).startOf("day").valueOf(),
        lookForward: true,
        maxCount: 255,
      };
      expect((await cal.getTimeline(path, req)).length).to.equal(2);
      req.id = moment(req.id).add(1, "week").valueOf();
      expect((await cal.getTimeline(path, req)).length).to.equal(2);
    });
    it("should only return one busy slot in the morning", async () => {
      assert(cal !== undefined);
      const req = {id: utQueryTime, lookForward: false, maxCount: 255};
      expect((await cal.getTimeline(path, req)).length).to.equal(1);
    });
    it("should only return one busy slot in the afternoon", async () => {
      assert(cal !== undefined);
      const req = {id: utQueryTime, lookForward: true, maxCount: 255};
      expect((await cal.getTimeline(path, req)).length).to.equal(1);
    });
  });
  describe("meeting", () => {
    it("should be able to create meeting", async () => {
      const id = at("2017-11-01 14:30");
      const end = at("2017-11-01 16:30");
      const req = {id, lookForward: true, maxCount: 255};

      await cache.setAuthSuccess(path, "panl@ftdichip.com");
      // Remove all timelines first
      await cache.setTimeline(utRoom, id, []);
      expect((await cal.getTimeline(path, req)).length).to.equal(0);
      await cal.createBooking(path, {start: id, end});
      expect((await cal.getTimeline(path, req)).length).to.equal(1);
      await cal.createBooking(path, {start: id, end});
      expect((await cal.getTimeline(path, req)).length).to.equal(1);
    });
  });
});
