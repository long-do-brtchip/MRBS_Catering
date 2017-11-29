import {expect, use} from "chai";
import chaiAsPromised = require("chai-as-promised");
import {ErrorCode} from "../../src/builder";
import {Cache} from "../../src/cache";
import {CalendarManager, ITimePoint} from "../../src/calendar";
import {Database} from "../../src/database";
import {Room} from "../../src/entity/hub/room";
import {PanLPath} from "../../src/path";
import {CalendarType, Persist} from "../../src/persist";
import {ICalendarEvent} from "../../src/service";
import {sleep} from "../../utils/testUtil";

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
    await init();
  });

  async function init() {
    cache = await Cache.getInstance();
    await cache.flush();
    cache.setExpiry(15);
    cache.addConfigured(path1, new Room(
      "tokyo@hanhzz.onmicrosoft.com", "Tokyo Room"));

    db = await Database.getInstance();

    await Persist.setCalendarConfig({
      type: CalendarType.OFFICE365,
      address: "https://outlook.office365.com/EWS/Exchange.asmx",
      username: "tan@hanhzz.onmicrosoft.com",
      password: "T@nt3sting",
      readonly: false,
    });
    cal = new CalendarManager(cache, consumer, await Persist.getHubConfig(),
      await Persist.getPanlConfig());
    await cal.connect();
  }
  after(async () => {
    await cache.stop();
    await db.stop();
  });

  describe("EWS Timeline", () => {
    it("Clean up meeting after test", async function extendMeeting() {
      this.slow(40000);
      await cache.flush();
      cache.setExpiry(3);
      cache.addConfigured(path1, new Room(
        "tokyo@hanhzz.onmicrosoft.com", "Tokyo Room"));
      async function clearMeeting(dayOffset: number) {

        const point = {dayOffset, minutesOfDay: 0};

        const req = {
          id: point,
          lookForward: true,
          maxCount: 100,
        };

        const timeline = await cal.getTimeline(path1, req);
        // console.log("dayOffset: ", dayOffset, timeline);
        for (const time of timeline) {
          const point2 = {dayOffset, minutesOfDay: time.start};
          try {
            await cal.cancelMeeting(path1, point2);
          } catch (error) {
            // log
          }
        }
      }

      for (let i = 0; i < 20; i++) {
        await clearMeeting(i);
      }

    }).timeout(40000);
  });
});
