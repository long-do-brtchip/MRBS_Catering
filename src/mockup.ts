import moment = require("moment");
import {Auth} from "./auth";
import {ErrorCode} from "./builder";
import {Cache} from "./cache";
import {ICalendar, ICalendarNotification, ITimelineEntry} from "./calendar";
import {Database} from "./database";
import {Employee} from "./entity/auth/employee";
import {log} from "./log";
import {PanLPath} from "./path";
import {IHubConfig, Persist} from "./persist";

const at = (s: string) => moment(s).valueOf();

interface IFakeAuth {
  email: string;
  name: string;
  passcode?: number;
  rfids?: Buffer[];
}

interface IFakeMeeting {
  timeline: ITimelineEntry;
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
    rfids: [Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])],
  } , {
    email: "fred@ftdichip.com",
    name: "Fred Dart",
    passcode: 0x888888,
    rfids: [
      Buffer.from([1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
      Buffer.from([2, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
    ],
  },
];

const rooms: IFakeRoom[] = [
{
  room: "sentosa@ftdichip.com",
  name: "Sentosa",
  meetings: [{
    timeline: {start: at("2017-12-01 14:30"), end: at("2017-12-01 15:00")},
    subject: "MRBS weekly",
    attendees: [
      "passcode@ftdichip.com", "fred@ftdichip.com", "rfid@ftdichip.com",
    ],
  } , {
    timeline: {start: at("2017-12-02 09:30"), end: at("2017-12-02 10:00")},
    subject: "ID Design",
    attendees: ["rfid@ftdichip.com", "fred@ftdichip.com"],
  } , {
    timeline: {start: at("2017-12-04 09:30"), end: at("2017-12-04 10:00")},
    subject: "Hardware Design",
    attendees: [
      "fred@ftdichip.com", "passcode@ftdichip.com", "rfid@ftdichip.com",
    ],
  }],
},
{
  room: "test@ftdichip.com",
  name: "Test",
  meetings: [{
    timeline: {start: at("2017-12-01 14:30"), end: at("2017-12-01 15:00")},
    subject: "MRBS weekly",
    attendees: [
      "passcode@ftdichip.com", "fred@ftdichip.com", "rfid@ftdichip.com",
    ],
  } , {
    timeline: {start: at("2017-12-02 09:30"), end: at("2017-12-02 10:00")},
    subject: "ID Design",
    attendees: ["rfid@ftdichip.com", "fred@ftdichip.com"],
  } , {
    timeline: {start: at("2017-12-04 09:30"), end: at("2017-12-04 10:00")},
    subject: "Hardware Design",
    attendees: [
      "fred@ftdichip.com", "passcode@ftdichip.com", "rfid@ftdichip.com",
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

  constructor(private notify: ICalendarNotification,
              private cache: Cache, private configHub: IHubConfig) {
    this.addFakeAuthDatas();
    this.addFakeRooms();
  }

  public async getTimeline(room: string, id: number): Promise<boolean> {
    const meetings = MockupCalendar.getMeetings(room);
    if (!meetings) {
      return false;
    }
    const entries: ITimelineEntry[] = [];
    for (const meeting of meetings) {
      if (moment(meeting.timeline.start).isSame(moment(id), "day")) {
        entries.push(meeting.timeline);
        await this.cache.setMeetingInfo(room, meeting.timeline.start, {
          subject: meeting.subject,
          organizer: await Auth.getEmployeeName(meeting.attendees[0]),
        });
      }
    }
    if (entries.length) {
      await this.cache.setTimeline(room, id, entries);
    }
    return true;
  }

  public async createBooking(room: string, entry: ITimelineEntry,
                             email: string): Promise<ErrorCode> {
    const organizer = email ? await Auth.getEmployeeName(email) : "PanL";
    await this.cache.setMeetingInfo(room, entry.start, {
      subject: this.configHub.meetingSubject,
      organizer,
    });
    await this.notify.onAddNotification(room, entry);
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
    await this.notify.onEndTimeChangeNotification(room, entry);
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
    await this.notify.onEndTimeChangeNotification(room, entry);
    return ErrorCode.ERROR_SUCCESS;
  }

  public async cancelMeeting(room: string, id: number, email: string):
  Promise<ErrorCode> {
    await this.notify.onDeleteNotification(room, id);
    return ErrorCode.ERROR_SUCCESS;
  }

  public async cancelUnclaimedMeeting(room: string, id: number):
  Promise<ErrorCode> {
    return this.cancelMeeting(room, id, "");
  }

  public async isAttendeeInMeeting(room: string, id: number, email: string):
  Promise<boolean> {
    const meetings = MockupCalendar.getMeetings(room);
    if (!meetings) {
      return false;
    }
    for (const meeting of meetings) {
      if (meeting.timeline.start === id) {
        return -1 !== meeting.attendees.indexOf(email);
      }
    }
    return false;
  }

  public async disconnect(): Promise<void> {
    const db = await Database.getInstance();
    await db.dropSchemas();
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
          log.silly("Failed to set authentication data,", err);
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
