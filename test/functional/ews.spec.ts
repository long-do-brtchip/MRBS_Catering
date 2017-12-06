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
import {ICalendarEvent} from "../../src/interface";
import {log} from "../../src/log";
import {PanLPath} from "../../src/path";
import {CalendarType, Persist} from "../../src/persist";
const startOfDay = moment().startOf("day");

class CalendarEventConsumer implements ICalendarEvent {
  constructor(private evt: EventEmitter) {
  }

  public async onCalMgrReady(): Promise<void> {
    return;
  }

  public async onCalMgrError(err: Error): Promise<void> {
    this.evt.emit("error", err);
    return;
  }

  public async onAdd(path: PanLPath, entry: ITimelineEntry): Promise<void> {
    this.evt.emit("add", path, entry);
    return;
  }

  public async onDelete(path: PanLPath, id: number): Promise<void> {
    this.evt.emit("delete", path, id);
    return;
  }

  public async onUpdate(path: PanLPath, id: number): Promise<void> {
    this.evt.emit("update", path, id);
    return;
  }

  public async onEndTimeChanged(path: PanLPath, entry: ITimelineEntry):
  Promise<void> {
    this.evt.emit("endTimeChange", path, entry);
    return;
  }
}

describe.skip("EWS module", () => {
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

  before(async function init() {
    use(chaiAsPromised);
    this.timeout(10000);
    cache = await Cache.getInstance();
    await cache.flush();
    cache.setExpiry(60);
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

  async function clearMeeting() {
    // clear all calendar before start
    const req = {
      id: startOfDay.valueOf(),
      lookForward: true,
      maxCount: 100,
    };
    const entries = await cal.getTimeline(path, req);
    const task: any[] = [];
    for (const entry of entries) {
      task.push(ews.cancelMeeting(roomAddress, entry.start, email));
    }
    await Promise.all(task);
  }

  after(async function cleanup() {
    await cal.disconnect();
    await cache.flush();
    await cache.stop();
    await db.stop();
  });

  describe("EWS Timeline", () => {
    function minuteBased(x: number): number {
      return moment(x).second(0).millisecond(0).valueOf();
    }

    it("should able create booking", async function createBooking() {
      this.slow(10000);
      await cache.flush();
      await cache.addConfigured(path, room);

      const req = {
        id: startOfDay.valueOf(),
        lookForward: true,
        maxCount: 1,
      };
      const entry = {
        start: minuteBased(moment().valueOf()),
        end: minuteBased(moment().add(1, "hours").valueOf())
          .valueOf(),
      };
      await ews.createBooking(roomAddress, entry, email);
      expect(await cal.getTimeline(path, req)).to.eql([entry]);
    }).timeout(10000);

    it("should able extend meeting", async function extendBooking() {
      this.slow(100000);
      const req = {
        id: startOfDay.valueOf(),
        lookForward: true,
        maxCount: 1,
      };
      const entries = await cal.getTimeline(path, req);
      const entryExtend = {
        start: entries[0].start,
        end: entries[0].end + 3600000,
      };
      await ews.extendMeeting(roomAddress, entryExtend, email);
      await cache.flush();
      await cache.addConfigured(path, room);
      // may be bug if minute move to next when update
      expect(await cal.getTimeline(path, req)).to.eql([entryExtend]);
    }).timeout(100000);

    it("should able end meeting", async function testCase() {
      this.slow(100000);
      const req = {
        id: startOfDay.valueOf(),
        lookForward: true,
        maxCount: 1,
      };
      const entries = await cal.getTimeline(path, req);
      const entryExtend = {
        start: entries[0].start,
        end: minuteBased(moment().valueOf()),
      };
      await ews.endMeeting(roomAddress, entries[0].start, email);
      await cache.flush();
      await cache.addConfigured(path, room);
      expect(await cal.getTimeline(path, req)).to.eql([entryExtend]);
    }).timeout(100000);

    it("should able verify attendee that single address",
      async function testCase() {
      this.slow(100000);
      const attendee = "tokyo-room@hanhzz.onmicrosoft.com";
      const req = {
        id: startOfDay.valueOf(),
        lookForward: true,
        maxCount: 1,
      };
      const entries = await cal.getTimeline(path, req);
      const entryExtend = {
        start: entries[0].start,
        end: minuteBased(moment().valueOf()),
      };
      expect(await ews.isAttendeeInMeeting(roomAddress,
        entries[0].start, attendee)).to.eql(true);
    }).timeout(100000);

    it("should able verify attendee into email-group",
      async function testCase() {
      this.slow(100000);
      const emailGroup = "list365@hanhzz.onmicrosoft.com";
      const emailMember = "user2@hanhzz.onmicrosoft.com";
      const req = {
        id: startOfDay.valueOf(),
        lookForward: true,
        maxCount: 1,
      };
      const entries = await cal.getTimeline(path, req);
      const entryExtend = {
        start: entries[0].start,
        end: minuteBased(moment().valueOf()),
      };
      await addAttendee(roomAddress,
        await cache.getMeetingUid(roomAddress, entries[0].start), emailGroup);
      expect(await ews.isAttendeeInMeeting(roomAddress,
        entries[0].start, emailMember)).to.eql(true);
    }).timeout(100000);

    it("should able cancel meeting", async function cancelBooking() {
      this.slow(100000);
      const req = {
        id: startOfDay.valueOf(),
        lookForward: true,
        maxCount: 1,
      };
      const entries = await cal.getTimeline(path, req);
      await ews.cancelMeeting(roomAddress, entries[0].start, email);
      await cache.flush();
      await cache.addConfigured(path, room);
      expect(await cal.getTimeline(path, req)).to.eql([]);
    }).timeout(100000);

    it("should able received create meeting notification",
      async function test() {
        this.slow(100000);
        await cache.flush();
        await cache.addConfigured(path, room);
        const entry = {
          start: minuteBased(moment().valueOf()),
          end: minuteBased(moment().add(1, "hours").valueOf())
            .valueOf(),
        };
        const req = {
          id: startOfDay.valueOf(),
          lookForward: true,
          maxCount: 1,
        };
        // for create showkey of day
        await ews.createBooking(roomAddress, entry, email);
        const entries = await cal.getTimeline(path, req);
        await ews.cancelMeeting(roomAddress, entries[0].start, email);
        // remove timeline and meeting but remain shadow_key
        await cache.removeTimelineEntry(roomAddress, entries[0].start);

        // open stream notification
        await ews.onRoomOnline(roomAddress);
        await ews.createBooking(roomAddress, entry, email);

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("add event timeout"));
          }, 8000);

          evt.on("add",
            async (path2: PanLPath, entry2: ITimelineEntry) => {
              try {
                // Compare , then call accept, or reject
                const roomMail = await cache.getRoomAddress(path2);
                await cache.getMeetingUid(roomMail, entry2.start);
                resolve();
              } catch (error) {
                reject(error);
              }
              clearTimeout(timeout);
            });
        });

        await ews.onRoomOffline(roomAddress);
      }).timeout(100000);

    it("should able received update subject notification",
      async function test() {
        this.slow(100000);
        const newSubject = "Test update subject";
        const req = {
          id: startOfDay.valueOf(),
          lookForward: true,
          maxCount: 1,
        };
        const entries = await cal.getTimeline(path, req);
        const entry = entries[0];
        // open stream notification
        await ews.onRoomOnline(roomAddress);
        // manual update
        await updateSubject(roomAddress,
          await cache.getMeetingUid(roomAddress, entry.start), newSubject);

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("onUpdate meeting's subject event timeout"));
          }, 8000);

          evt.on("update", async (path2: PanLPath, id: number) => {
              try {
                // Compare , then call accept, or reject
                const roomMail = await cache.getRoomAddress(path2);
                const meetingSubject =
                  (await cache.getMeetingInfo(roomMail, id)).subject;
                if (meetingSubject === newSubject) {
                  resolve();
                } else {
                  reject(new Error("meeting subject not matching"));
                }
              } catch (error) {
                reject(error);
              }
              clearTimeout(timeout);
            });
        });

        await ews.onRoomOffline(roomAddress);
      }).timeout(100000);

    it("should able received update endTime notification",
      async function test() {
        this.slow(100000);
        const req = {
          id: startOfDay.valueOf(),
          lookForward: true,
          maxCount: 1,
        };
        const entries = await cal.getTimeline(path, req);
        const entryExtend = {
          start: entries[0].start,
          end: entries[0].end + 1800000, // extend 30M
        };
        // open stream notification
        await ews.onRoomOnline(roomAddress);
        // manual update
        await ews.extendMeeting(roomAddress, entryExtend, email);
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("endTimeChange event timeout"));
          }, 8000);

          evt.on("endTimeChange",
            async (path2: PanLPath, entry2: ITimelineEntry) => {
              try {
                // Compare , then call accept, or reject
                const roomMail = await cache.getRoomAddress(path2);
                const end =
                  await cache.getTimelineEntryEndTime(roomMail, entry2.start);
                if (end === entryExtend.end) {
                  resolve();
                } else {
                  reject(new Error(`endTimeChange ${moment(end).calendar()} ` +
                    "doesn't match expected " +
                    moment(entryExtend.end).calendar()));
                }
              } catch (error) {
                reject(error);
              }
              clearTimeout(timeout);
            });
        });

        await ews.onRoomOffline(roomAddress);
      }).timeout(100000);

    it("should able received update startTime notification",
      async function test() {
        this.slow(110000);
        const req = {
          id: startOfDay.valueOf(),
          lookForward: true,
          maxCount: 1,
        };
        const entries = await cal.getTimeline(path, req);
        const start = entries[0].start;
        const startExtend = start + 900000; // extend 15p

        // open stream notification
        await ews.onRoomOnline(roomAddress);
        // manual update
        await updateStartTime(roomAddress,
          await cache.getMeetingUid(roomAddress, start), startExtend);

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("update meeting's StartTime event timeout"));
          }, 8000);

          evt.on("delete",
            async (path2: PanLPath, entry2: ITimelineEntry) => {
              try {
                // Compare , then call accept, or reject
                const roomMail = await cache.getRoomAddress(path2);
                const endTime =
                  await cache.getTimelineEntryEndTime(roomMail, entry2.start);
                if (!endTime) {
                  resolve();
                } else {
                  reject(new Error("Update StartTime can not remove old one"));
                }
              } catch (error) {
                reject(error);
              }
              clearTimeout(timeout);
            });
        });

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("update meeting's StartTime event timeout"));
          }, 2000);

          evt.on("add",
            async (path2: PanLPath, entry2: ITimelineEntry) => {
              try {
                // Compare , then call accept, or reject
                const roomMail = await cache.getRoomAddress(path2);
                const endTime =
                  await cache.getTimelineEntryEndTime(roomMail, entry2.start);
                if (endTime === entry2.end) {
                  resolve();
                } else {
                  reject(new Error("Update StartTime add new one"));
                }
              } catch (error) {
                reject(error);
              }
              clearTimeout(timeout);
            });
        });

        await ews.onRoomOffline(roomAddress);
      }).timeout(11000);

    it("should able received cancel meeting notification",
      async function test() {
        this.slow(100000);
        const req = {
          id: startOfDay.valueOf(),
          lookForward: true,
          maxCount: 1,
        };
        const entries = await cal.getTimeline(path, req);
        const entry = entries[0];
        // open stream notification
        await ews.onRoomOnline(roomAddress);
        await ews.cancelMeeting(roomAddress, entry.start, email);

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Cancel meeting's event timeout"));
          }, 8000);

          evt.on("delete",
            async (path2: PanLPath, entry2: ITimelineEntry) => {
              try {
                // Compare , then call accept, or reject
                const roomMail = await cache.getRoomAddress(path2);
                const endTime =
                  await cache.getTimelineEntryEndTime(roomMail, entry2.start);
                if (!endTime) {
                  resolve();
                } else {
                  reject(new Error("Cancel can not remove old"));
                }
              } catch (error) {
                reject(error);
              }
              clearTimeout(timeout);
            });
        });
        await ews.onRoomOffline(roomAddress);
      }).timeout(100000);
  });
});

const exchVersion = ewsjs.ExchangeVersion.Exchange2013;
const service = new ewsjs.ExchangeService(exchVersion);

ewsjs.EwsLogging.DebugLogEnabled = false;
service.Credentials = new ewsjs.WebCredentials("tan@hanhzz.onmicrosoft.com",
  "T@nt3sting");
service.Url = new ewsjs.Uri("https://outlook.office365.com/EWS/Exchange.asmx");

async function updateStartTime(address: string, meetingId: string,
                               time: number) {
  service.ImpersonatedUserId =
    new ewsjs.ImpersonatedUserId(ewsjs.ConnectingIdType.SmtpAddress, address);
  const appointment =
    await ewsjs.Appointment.Bind(service, new ewsjs.ItemId(meetingId));
  appointment.Start = new ewsjs.DateTime(time);

  const mode = appointment.IsMeeting ?
    ewsjs.SendInvitationsOrCancellationsMode.SendToAllAndSaveCopy
    : ewsjs.SendInvitationsOrCancellationsMode.SendToNone;

  // Send the update request to the Exchange server.
  return appointment.Update(ewsjs.ConflictResolutionMode.AlwaysOverwrite, mode);
}

async function addAttendee(address: string, meetingId: string,
                           attendeeAddress: string) {
  service.ImpersonatedUserId =
    new ewsjs.ImpersonatedUserId(ewsjs.ConnectingIdType.SmtpAddress, address);
  const appointment =
    await ewsjs.Appointment.Bind(service, new ewsjs.ItemId(meetingId));
  appointment.RequiredAttendees.Add(attendeeAddress);

  const mode = appointment.IsMeeting ?
    ewsjs.SendInvitationsOrCancellationsMode.SendToAllAndSaveCopy
    : ewsjs.SendInvitationsOrCancellationsMode.SendToNone;

  // Send the update request to the Exchange server.
  return appointment.Update(ewsjs.ConflictResolutionMode.AlwaysOverwrite, mode);
}

async function updateSubject(address: string, meetingId: string,
                             subject: string) {
  service.ImpersonatedUserId =
    new ewsjs.ImpersonatedUserId(ewsjs.ConnectingIdType.SmtpAddress, address);
  const appointment =
    await ewsjs.Appointment.Bind(service, new ewsjs.ItemId(meetingId));
  appointment.Subject = subject;

  const mode = appointment.IsMeeting ?
    ewsjs.SendInvitationsOrCancellationsMode.SendToAllAndSaveCopy
    : ewsjs.SendInvitationsOrCancellationsMode.SendToNone;

  // Send the update request to the Exchange server.
  return appointment.Update(ewsjs.ConflictResolutionMode.AlwaysOverwrite, mode);
}
