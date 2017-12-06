import moment = require("moment");
import {Auth} from "./auth";
import {ErrorCode} from "./builder";
import {Cache} from "./cache";
import {ICalendar, ITimelineEntry} from "./calendar";
import {Database} from "./database";
import {Employee} from "./entity/auth/employee";
import {ICalendarEvent} from "./interface";
import {log} from "./log";
import {PanLPath} from "./path";
import {IHubConfig, Persist} from "./persist";

const at = (s: string) => moment(s).valueOf();
export const utRoom = "unittest@ftdichip.com";
export const utQueryTime = at("2018-01-08 14:30");

interface IFakeAuth {
  email: string;
  name: string;
  passcode?: number;
  rfids?: Buffer[];
}

enum Recurring {
  None,
  Weekly,
}

interface IFakeMeeting {
  timeline: ITimelineEntry;
  recurring: Recurring;
  subject: string;
  attendees: string[]; // First person will be organizer
}

interface IFakeRoom {
  room: string;
  name: string;
  meetings: IFakeMeeting[];
}

const auths: IFakeAuth[] = [
  {
    email: "panl@ftdichip.com",
    name: "PanL",
  } , {
    email: "passcode@ftdichip.com",
    name: "Jone Doe",
    passcode: 0x666666,
  } , {
    email: "rfid@ftdichip.com",
    name: "Jane Doe",
    rfids: [Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])],
  } , {
    email: "fred@ftdichip.com",
    name: "Fred Dart",
    passcode: 0x888888,
    rfids: [
      Buffer.from([1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
      Buffer.from([2, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    ],
  },
];

const rooms: IFakeRoom[] = [
{
  // Room for CES demo
  room: "sentosa@ftdichip.com",
  name: "Sentosa",
  meetings: [{
    // Monday, one day before CES 2018
    timeline: {start: at("2018-01-08 08:30"), end: at("2018-01-08 10:00")},
    recurring: Recurring.Weekly,
    subject: "PanL software development weekly meeting",
    attendees: [
      "passcode@ftdichip.com", "fred@ftdichip.com", "rfid@ftdichip.com",
    ],
  } , {
    timeline: {start: at("2018-01-08 17:00"), end: at("2018-01-08 18:00")},
    recurring: Recurring.None,
    subject: "MRBS weekly",
    attendees: [
      "passcode@ftdichip.com", "fred@ftdichip.com", "rfid@ftdichip.com",
    ],
  } , {
    timeline: {start: at("2018-01-09 09:30"), end: at("2018-01-09 14:00")},
    recurring: Recurring.None,
    subject: "ID Design",
    attendees: ["rfid@ftdichip.com", "fred@ftdichip.com"],
  } , {
    timeline: {start: at("2018-01-10 05:30"), end: at("2018-01-10 23:00")},
    recurring: Recurring.None,
    subject: "Hardware Design",
    attendees: [
      "fred@ftdichip.com", "passcode@ftdichip.com", "rfid@ftdichip.com",
    ],
  }],
},
{
  room: utRoom,
  name: "Unit Test",
  meetings: [{
    timeline: {start: at("2018-01-08 08:30"), end: at("2018-01-08 14:30")},
    recurring: Recurring.Weekly,
    subject: "PanL software development weekly meeting",
    attendees: [
      "passcode@ftdichip.com", "fred@ftdichip.com", "rfid@ftdichip.com",
    ],
  } , {
    timeline: {start: utQueryTime, end: at("2018-01-08 15:00")},
    recurring: Recurring.None,
    subject: "MRBS weekly",
    attendees: [
      "passcode@ftdichip.com", "fred@ftdichip.com", "rfid@ftdichip.com",
    ],
  }],
},
];

export class MockupCalendar implements ICalendar {
  private static getMeetings(room: string): IFakeMeeting[] | undefined {
    for (const r of rooms) {
      if (r.room === room) {
        return r.meetings;
      }
    }
  }

  constructor(private notify: ICalendarEvent<string>,
              private cache: Cache, private configHub: IHubConfig) {
  }

  public async init() {
    await Promise.all([
      this.addFakeAuthDatas(),
      this.addFakeRooms(),
    ]);
  }

  public async getTimeline(room: string, id: number):
  Promise<ITimelineEntry[]> {
    const queryDay = moment(id).startOf("day");
    const meetings = MockupCalendar.getMeetings(room);
    if (!meetings) {
      return [];
    }
    const entries: ITimelineEntry[] = [];

    for (const meeting of meetings) {
      const entryStart = moment(meeting.timeline.start);
      const days = queryDay.diff(entryStart.clone().startOf("day"), "days");

      let entry;
      switch (meeting.recurring) {
      case Recurring.None:
        if (entryStart.valueOf() === queryDay.valueOf()) {
          entry = meeting.timeline;
        }
      case Recurring.Weekly:
        if (entryStart.weekday() === queryDay.weekday()) {
          entry = {
            start: moment(meeting.timeline.start).add(days, "days").valueOf(),
            end: moment(meeting.timeline.end).add(days, "days").valueOf(),
          };
        }
      }
      if (!entry) {
        continue;
      }
      entries.push(entry);
      await Promise.all([
        this.cache.setMeetingUid(room, entry.start,
          meeting.attendees.join(" ")),
        this.cache.setMeetingInfo(room, entry.start, {
          subject: meeting.subject,
          organizer: await Auth.getEmployeeName(meeting.attendees[0]),
        }),
      ]);
    }
    return entries;
  }

  public async createBooking(room: string, entry: ITimelineEntry,
                             email: string): Promise<ErrorCode> {
    const organizer = email ? await Auth.getEmployeeName(email) : "PanL";
    await Promise.all([
      this.cache.setMeetingInfo(room, entry.start, {
        subject: this.configHub.meetingSubject,
        organizer,
      }),
      this.cache.setMeetingUid(room, entry.start, email),
    ]);
    this.notify.onAdd(room, entry);
    return ErrorCode.ERROR_SUCCESS;
  }

  public async extendMeeting(room: string, entry: ITimelineEntry,
                             email: string): Promise<ErrorCode> {
    const info = await this.cache.getMeetingInfo(room, entry.start);

    if (email) {
      const name = await Auth.getEmployeeName(email);
      info.subject = `Extended by ${name}: ${info.subject}`;
    } else {
      info.subject = `Extended: ${info.subject}`;
    }
    await this.cache.setMeetingInfo(room, entry.start, info);
    this.notify.onEndTimeChange(room, entry);
    return ErrorCode.ERROR_SUCCESS;
  }

  public async endMeeting(room: string, id: number, email: string):
  Promise<ErrorCode> {
    const entry: ITimelineEntry = {
      start: id,
      end: moment().valueOf(),
    };
    const info = await this.cache.getMeetingInfo(room, id);
    if (email) {
      const name = await Auth.getEmployeeName(email);
      info.subject = `Ended by ${name}: ${info.subject}`;
    } else {
      info.subject = `Ended: ${info.subject}`;
    }
    await this.cache.setMeetingInfo(room, id, info);
    this.notify.onEndTimeChange(room, entry);
    return ErrorCode.ERROR_SUCCESS;
  }

  public async cancelMeeting(room: string, id: number, email: string):
  Promise<ErrorCode> {
    this.notify.onDelete(room, id);
    return ErrorCode.ERROR_SUCCESS;
  }

  public async cancelUnclaimedMeeting(room: string, id: number):
  Promise<ErrorCode> {
    return this.cancelMeeting(room, id, "");
  }

  public async isAttendeeInMeeting(room: string, id: number, email: string):
  Promise<boolean> {
    const emails: string[] =
      (await this.cache.getMeetingUid(room, id)).split(" ");
    log.silly(`emails: ${emails} compare ${email}`);
    return -1 !== emails.indexOf(email);
  }

  private async addFakeAuthDatas() {
    for (const auth of auths) {
      const employee = await Auth.addEmployee(auth.email, auth.name);
      if (auth.passcode) {
        log.silly(`Add passcode: ${auth.passcode.toString(16)} ` +
          `for emplyee: ${employee.name}`);
        try {
          await Auth.setPasscode(employee, auth.passcode);
        } catch (err) {
          continue;
        }
      }
      if (auth.rfids) {
        for (const rfid of auth.rfids) {
          log.silly(`Add RFID: ${rfid.toString("hex")} ` +
            `for emplyee: ${employee.name}`);
          await Auth.addRFID(employee, rfid);
        }
      }
    }
  }

  private async addFakeRooms() {
    for (const r of rooms) {
      log.silly(`Add room ${r.name}: ${r.room}`);
      Persist.addRoom(r.room, r.name);
    }
  }
}
