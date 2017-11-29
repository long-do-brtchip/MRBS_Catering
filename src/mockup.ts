import moment = require("moment");
import {ErrorCode} from "./builder";
import {Cache} from "./cache";
import {ICalendar, ICalendarNotification, ITimelineEntry} from "./calendar";
import {PanLPath} from "./path";
import {IHubConfig} from "./persist";

export class MockupCalendar implements ICalendar {
  constructor(private notify: ICalendarNotification,
              private cache: Cache,
              private configHub: IHubConfig) {
  }

  public async getTimeline(room: string, id: number)
  : Promise<boolean> {
    const dayStart = moment(id).startOf("day");
    const entries: ITimelineEntry[] = [
      {start: dayStart.hour(8).valueOf(), end: dayStart.hour(9).valueOf()},
      {start: dayStart.hour(18).valueOf(), end: dayStart.hour(23).valueOf()},
    ];

    await Promise.all(entries.map((entry) => [
        this.cache.setMeetingInfo(room, entry.start, {
          subject: `Test meeting ${moment(entry.start).calendar()}`,
          organizer: "Tester",
        })]));
    await this.cache.setTimeline(room, id, entries);
    return true;
  }

  public async createBooking(room: string, entry: ITimelineEntry,
                             email: string): Promise<ErrorCode> {
    const organizer = email ? email : "PanL";
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
    info.subject = email ? `Extended by ${email}: ${info.subject}` :
                   `Extended: ${info.subject}`;
    await this.cache.setMeetingInfo(room, entry.start, info);
    await this.notify.onEndTimeChangeNofication(room, entry);
    return ErrorCode.ERROR_SUCCESS;
  }

  public async endMeeting(room: string, id: number, email: string):
  Promise<ErrorCode> {
    const entry: ITimelineEntry = {
      start: id,
      end: moment().valueOf(),
    };
    const info = await this.cache.getMeetingInfo(room, id);
    info.subject = email ? `Ended by ${email}: ${info.subject}` :
                   `Ended: ${info.subject}`;
    await this.cache.setMeetingInfo(room, id, info);
    await this.notify.onEndTimeChangeNofication(room, entry);
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

  public async isAttendeeInMeeting(room: string, id: number,
                                   email: string): Promise<boolean> {
    const attendees = ["passcode@test.com", "rfid@test.com"];
    return -1 !== attendees.indexOf(email);
  }

  public async disconnect(): Promise<void> {
    return;
  }
}
