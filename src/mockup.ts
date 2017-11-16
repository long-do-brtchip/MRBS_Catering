import {Cache} from "./cache";
import {
  ICalender, ICalenderNotification, IMeetingInfo,
  ITimelineEntry, ITimelineRequest, ITimePoint,
} from "./calender";
import {PanLPath} from "./path";

export class MockupCalender implements ICalender {
  constructor(private notify: ICalenderNotification,
              private cache: Cache) {
  }

  public async getTimeline(path: PanLPath, dayOffset: number)
  : Promise<boolean> {
    const entries: ITimelineEntry[] = [{start: 60 * 8, end: 60 * 9}];
    this.cache.setMeetingInfo(path,
      {dayOffset, minutesOfDay: 60 * 8},
      {subject: `Test ${dayOffset}-1`, organizer: "Tester"});
    this.cache.setMeetingInfo(path,
      {dayOffset, minutesOfDay: 60 * 8},
      {subject: `Test ${dayOffset}-2`, organizer: "Tester"});
    return true;
  }

  public async createBooking(path: PanLPath, id: ITimePoint, duration: number):
  Promise<void> {
    await Promise.all([
      this.cache.setTimelineEntry(path, id, duration),
      this.cache.setMeetingInfo(path, id,
        {subject: `Meeting booked from PanL`, organizer: "PanL"}),
    ]);
  }

  public async extendMeeting(path: PanLPath, id: ITimePoint, duration: number):
  Promise<void> {
    this.notify.onExtendNotification(path, id, duration);
  }

  public async endMeeting(path: PanLPath, id: ITimePoint): Promise<void> {
    const info = await this.cache.getMeetingInfo(path, id);
    info.subject = `Ended: ${info.subject}`;
    await this.cache.setMeetingInfo(path, id, info);
    this.notify.onUpdateNotification(path, id);
  }

  public async cancelMeeting(path: PanLPath, id: ITimePoint): Promise<void> {
    const info = await this.cache.getMeetingInfo(path, id);
    info.subject = `Cancelled: ${info.subject}`;
    await this.cache.setMeetingInfo(path, id, info);
    this.notify.onUpdateNotification(path, id);
  }

  public async cancelUnclaimedMeeting(path: PanLPath, id: ITimePoint):
  Promise<void> {
    const info = await this.cache.getMeetingInfo(path, id);
    info.subject = `Unclaimed: ${info.subject}`;
    await this.cache.setMeetingInfo(path, id, info);
    this.notify.onUpdateNotification(path, id);
  }
}
