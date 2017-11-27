import {expect, use} from "chai";
import chaiAsPromised = require("chai-as-promised");
import moment = require("moment");
import {Cache} from "../../src/cache";
import {CalendarManager, ITimelineEntry} from "../../src/calendar";
import {Database} from "../../src/database";
import {Room} from "../../src/entity/hub/room";
import {log} from "../../src/log";
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

describe("EWS module", () => {
  let cal: CalendarManager;
  let cache: Cache;
  let db: Database;
  const path = new PanLPath(88, 88);
  const room = new Room("tokyo@hanhzz.onmicrosoft.com", "Tokyo Room");
  const consumer = new CalendarEventConsumer();

  before(async () => {
    use(chaiAsPromised);
    cache = await Cache.getInstance();
    await cache.flush();
    cache.setExpiry(15);
    await cache.addConfigured(path, room);
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
  });

  after(async function cleanup() {
    await cal.disconnect();
    await cache.flush();
    await cache.stop();
    await db.stop();
  });

  describe("EWS Timeline", () => {
    it("Setup and clean up meeting should not be part of unit test");
  });
});
