import {ErrorCode} from "./builder";
import {Cache} from "./cache";
import {
  ICalendar, ICalendarNotification,
  ITimelineEntry, ITimePoint,
} from "./calendar";
import {PanLPath} from "./path";
import {IHubConfig} from "./persist";

export class MockupCalendar implements ICalendar {
  constructor(private notify: ICalendarNotification,
              private cache: Cache,
              private configHub: IHubConfig) {
  }

  public async getTimeline(path: PanLPath, dayOffset: number)
  : Promise<boolean> {
    const entries: ITimelineEntry[] = [
      {start: 60 * 8, end: 60 * 9},
      {start: 60 * 18, end: 60 * 23},
    ];

    await Promise.all(entries.map((entry) => {
      const point: ITimePoint = {dayOffset, minutesOfDay: entry.start};
      return [
        this.cache.setMeetingInfo(path, point,
          {subject: `Test meeting ${dayOffset}`, organizer: "Tester"}),
      ];
    }));
    this.cache.setTimeline(path, dayOffset, entries);
    return true;
  }

  public async createBooking(path: PanLPath, id: ITimePoint, duration: number,
                             email: string): Promise<ErrorCode> {
    const organizer = email ? email : "PanL";
    await Promise.all([
      this.cache.setTimelineEntry(path, id, duration),
      this.cache.setMeetingInfo(path, id, {
        subject: this.configHub.meetingSubject,
        organizer,
      }),
    ]);
    await this.notify.onAddNotification(path, id, duration);
    return ErrorCode.ERROR_SUCCESS;
  }

  public async extendMeeting(path: PanLPath, id: ITimePoint, duration: number,
                             email: string): Promise<ErrorCode> {
    const info = await this.cache.getMeetingInfo(path, id);
    info.subject = email ? `Extended by ${email}: ${info.subject}` :
                   `Extended: ${info.subject}`;
    await Promise.all([
      this.cache.setTimelineEntry(path, id, duration),
      this.cache.setMeetingInfo(path, id, info),
    ]);
    await this.notify.onEndTimeChangeNofication(path, id, duration);
    return ErrorCode.ERROR_SUCCESS;
  }

  public async endMeeting(path: PanLPath, id: ITimePoint, email: string):
  Promise<ErrorCode> {
    const info = await this.cache.getMeetingInfo(path, id);
    info.subject = email ? `Ended by ${email}: ${info.subject}` :
                   `Ended: ${info.subject}`;
    const date = new Date();
    const duration = date.getHours() * 60 + date.getMinutes() -
      id.minutesOfDay;
    await Promise.all([
      this.cache.setTimelineEntry(path, id, duration),
      this.cache.setMeetingInfo(path, id, info),
    ]);
    await this.notify.onEndTimeChangeNofication(path, id, duration);
    return ErrorCode.ERROR_SUCCESS;
  }

  public async cancelMeeting(path: PanLPath, id: ITimePoint, email: string):
  Promise<ErrorCode> {
    await this.cache.removeTimelineEntry(path, id);
    await this.notify.onDeleteNotification(path, id);
    return ErrorCode.ERROR_SUCCESS;
  }

  public async cancelUnclaimedMeeting(path: PanLPath, id: ITimePoint):
  Promise<ErrorCode> {
    return this.cancelMeeting(path, id, "");
  }

  public async isAttendeeInMeeting(path: PanLPath, id: ITimePoint,
                                   email: string): Promise<boolean> {
    const attendees = ["passcode@test.com", "rfid@test.com"];
    return -1 !== attendees.indexOf(email);
  }
}
