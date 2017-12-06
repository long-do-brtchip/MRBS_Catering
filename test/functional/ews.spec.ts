import {expect, use} from "chai";
import chaiAsPromised = require("chai-as-promised");
import {EventEmitter} from "events";
import ewsjs = require("ews-javascript-api");
import moment = require("moment");
import {Auth} from "../../src/auth";
import {Cache} from "../../src/cache";
import {CalendarManager, ITimelineEntry} from "../../src/calendar";
import {Database} from "../../src/database";
import {Room} from "../../src/entity/hub/room";
import {EWSCalendar} from "../../src/ews";
import {ICalendarEvent, ICalendarManagerEvent} from "../../src/interface";
import {log} from "../../src/log";
import {PanLPath} from "../../src/path";
import {CalendarType, Persist} from "../../src/persist";

class CalendarEventConsumer implements ICalendarEvent<PanLPath> {
  constructor(private evt: EventEmitter) {
  }

  public async onDelete(path: PanLPath, id: number) {
    this.evt.emit("delete", path, id);
  }

  public async onMeetingUpdate(path: PanLPath, id: number) {
    this.evt.emit("update", path, id);
  }

  public async onEndTimeChange(path: PanLPath, entry: ITimelineEntry) {
    this.evt.emit("endTimeChange", path, entry);
  }

  public async onAdd(path: PanLPath, entry: ITimelineEntry) {
    this.evt.emit("add", path, entry);
  }
}

describe("EWS module", () => {
  let cal: CalendarManager;
  let ews: EWSCalendar;
  let cache: Cache;
  let db: Database;
  const path = new PanLPath(88, 88);
  const roomAddress = "tokyo@hanhzz.onmicrosoft.com";
  const room = new Room(roomAddress, "Tokyo Room");
  const evt: EventEmitter = new EventEmitter();
  const consumer = new CalendarEventConsumer(evt);
  const email = "user@test.com";
  const check = <T>(dest: PanLPath,
                    reason: string,
                    checkFunction: (i: T) => Promise<boolean>) =>
    new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout"));
      }, 9000);
      evt.on(reason, async (p: PanLPath, i: T) => {
        if (p.uid !== dest.uid) {
          return;
        }
        try {
          if (!await checkFunction(i)) {
            return;
          }
          resolve();
          clearTimeout(timeout);
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });
    });

  async function clearMeeting() {
    // clear all calendar before start
    const req = {
      id: moment().startOf("day").valueOf(),
      lookForward: true,
      maxCount: 100,
    };
    const entries = await cal.getTimeline(path, req);
    for (const entry of entries) {
      await ews.cancelMeeting(roomAddress, entry.start, email);
      await check<number>(path, "delete", async (i) => i === entry.start);
    }
  }

  before(async function init() {
    use(chaiAsPromised);
    this.timeout(10000);
    cache = await Cache.getInstance();
    await cache.flush();
    await cache.addConfigured(path, room);
    db = await Database.getInstance();
    await Auth.addEmployee("User", email);
    await Persist.setCalendarConfig({
      type: CalendarType.OFFICE365,
      address: "https://outlook.office365.com/EWS/Exchange.asmx",
      username: "tan@hanhzz.onmicrosoft.com",
      password: "T@nt3sting",
      readonly: false,
    });
    cal = new CalendarManager(cache, await Persist.getHubConfig(),
      await Persist.getPanlConfig());
    ews = new EWSCalendar(cal, cache, await Persist.getCalendarConfig(),
      await Persist.getHubConfig());
    await cal.connect(consumer);
    await clearMeeting();
  });

  after(async function cleanup() {
    await cal.disconnect();
    await cache.flush();
    await cache.stop();
    await db.stop();
  });

  describe("EWS Timeline", () => {
    let entry: ITimelineEntry;
    function minuteBased(x: number): number {
      return moment(x).second(0).millisecond(0).valueOf();
    }
    it("should be able to create booking", async function createBooking() {
      this.slow(10000);
      await cache.addConfigured(path, room);
      entry = {
        start: minuteBased(moment().valueOf()),
        end: minuteBased(moment().add(1, "hours").valueOf()).valueOf(),
      };
      await ews.createBooking(roomAddress, entry, email);
      await check<ITimelineEntry>(path, "add", async (i) => {
        if (i.start !== entry.start) {
          return false;
        }
        if (i.end !== entry.end) {
          throw(new Error("end time not same"));
        }
        return true;
      });
    }).timeout(10000);

    it("should be able to extend meeting", async function extendBooking() {
      this.slow(100000);
      entry.end += moment.duration(1, "hours").asMilliseconds();
      await ews.extendMeeting(roomAddress, entry, email);
      // may be bug if minute move to next when update
      await check<ITimelineEntry>(path, "endTimeChange", async (i) => {
        if (i.start !== entry.start) {
          return false;
        }
        if (i.end !== entry.end) {
          throw(new Error(`end time ${moment(i.end).calendar()}` +
            ` not same as expected ${moment(entry.end).calendar()}`));
        }
        return true;
      });
    }).timeout(100000);

    it("should able verify attendee that single address",
      async function testCase() {
        this.slow(100000);
        const attendee = "tokyo-room@hanhzz.onmicrosoft.com";
        expect(await ews.isAttendeeInMeeting(roomAddress,
          entry.start, attendee)).to.eql(true);
      }).timeout(100000);

    it("should able verify attendee into email-group",
      async function testCase() {
        this.slow(100000);
        const emailGroup = "list365@hanhzz.onmicrosoft.com";
        const emailMember = "user2@hanhzz.onmicrosoft.com";
        await ews.addAttendee(roomAddress, entry.start, emailGroup);
        expect(await ews.isAttendeeInMeeting(roomAddress,
          entry.start, emailMember)).to.eql(true);
      }).timeout(100000);

    it("should able received update subject notification",
      async function test() {
        this.slow(100000);
        const newSubject = "Test update subject";
        ews.updateSubject(roomAddress, entry.start, newSubject);
        await check<number>(path, "update", async (i) => {
          const meetingSubject =
            (await cache.getMeetingInfo(roomAddress, entry.start)).subject;
          return meetingSubject === newSubject;
        });
    }).timeout(100000);

    it("should able received update startTime notification",
      async function test() {
        this.slow(110000);
        const newStart = entry.start +
          moment.duration(15, "minutes").asMilliseconds();
        await ews.updateStartTime(roomAddress, entry.start, newStart);
        await check<number>(path, "delete", async (i) => {
          return i === entry.start;
        });
        await check<ITimelineEntry>(path, "add", async (i) => {
          if (i.start !== newStart) {
            return false;
          }
          entry.start = newStart;
          return i.end === entry.end;
        });
      }).timeout(11000);

    it("should be able to end meeting", async function testCase() {
      this.slow(100000);
      await ews.endMeeting(roomAddress, entry.start, email);
      await check<ITimelineEntry>(path, "endTimeChange", async (i) => {
        if (i.start !== entry.start) {
          return false;
        }
        if (moment().diff(moment(i.end), "minutes") > 1) {
          throw(new Error(`end time ${moment(i.end).calendar()} not correct`));
        }
        entry.end = i.end;
        return true;
      });
    }).timeout(100000);

    it("should able cancel meeting", async function cancelBooking() {
      this.slow(100000);
      log.error("LY]5");
      await ews.cancelMeeting(roomAddress, entry.start, email);
      await check<number>(path, "delete", async (i) => i === entry.start);
    }).timeout(100000);
  });
});
