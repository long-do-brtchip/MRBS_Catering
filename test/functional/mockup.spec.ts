import {assert, expect} from "chai";
import {EventEmitter} from "events";
import {Cache} from "../../src/cache";
import {
  CalendarManager, IMeetingInfo, ITimelineEntry, ITimelineRequest, ITimePoint,
} from "../../src/calendar";
import {PanLPath} from "../../src/path";
import {CalendarType, Persist} from "../../src/persist";
import {MessageParser} from "../../src/recv";

describe("Mockup calendar module", () => {
  let cache: Cache;
  let cal: CalendarManager;
  let persist: Persist;
  const evt = new EventEmitter();
  const path = new PanLPath(1, 1);

  before(async () => {
    persist = await Persist.getInstance();
    await persist.setCalendarConfig({
      type: CalendarType.MOCKUP,
      address: "",
      username: "",
      password: "",
      readonly: false});
    cache = await Cache.getInstance();
    cal = new CalendarManager(cache, persist, evt);
  });
  after(async () => {
    await cache.stop();
    await persist.stop();
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
