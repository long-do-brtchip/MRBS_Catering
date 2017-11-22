import {Cache} from "./cache";
import {
  ICalendar, ICalendarNotification,
  ITimelineEntry, ITimePoint,
} from "./calendar";
import {PanLPath} from "./path";

export class MockupCalendar implements ICalendar {
  private static readonly attendees = ["passcode@test.com", "rfid@test.com"];

  constructor(private notify: ICalendarNotification,
              private cache: Cache) {
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
        this.cache.setMeetingAttendees(path, point, MockupCalendar.attendees),
        this.cache.setMeetingInfo(path, point,
          {subject: `Test meeting ${dayOffset}`, organizer: "Tester"}),
      ];
    }));
    this.cache.setTimeline(path, dayOffset, entries);
    return true;
  }

  public async createBooking(path: PanLPath, id: ITimePoint, duration: number):
  Promise<void> {
    await Promise.all([
      this.cache.setMeetingAttendees(path, id, MockupCalendar.attendees),
      this.cache.setTimelineEntry(path, id, duration),
      this.cache.setMeetingInfo(path, id,
        {subject: `Meeting booked from PanL`, organizer: "PanL"}),
    ]);
  }

  public async extendMeeting(path: PanLPath, id: ITimePoint, duration: number):
  Promise<void> {
    await this.notify.onExtendNotification(path, id, duration);
  }

  public async endMeeting(path: PanLPath, id: ITimePoint): Promise<void> {
    const info = await this.cache.getMeetingInfo(path, id);
    info.subject = `Ended: ${info.subject}`;
    await this.cache.setMeetingInfo(path, id, info);
    await this.notify.onUpdateNotification(path, id);
  }

  public async cancelMeeting(path: PanLPath, id: ITimePoint): Promise<void> {
    const info = await this.cache.getMeetingInfo(path, id);
    info.subject = `Cancelled: ${info.subject}`;
    await this.cache.setMeetingInfo(path, id, info);
    await this.notify.onUpdateNotification(path, id);
  }

  public async cancelUnclaimedMeeting(path: PanLPath, id: ITimePoint):
  Promise<void> {
    const info = await this.cache.getMeetingInfo(path, id);
    info.subject = `Unclaimed: ${info.subject}`;
    await this.cache.setMeetingInfo(path, id, info);
    await this.notify.onUpdateNotification(path, id);
  }
}
