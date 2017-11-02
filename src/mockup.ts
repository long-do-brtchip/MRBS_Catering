import {Cache} from "./cache";
import {
  ICalender, ICalenderNotification, IMeetingInfo,
  ITimeline, ITimelineRequest,
} from "./calender";
import {PanLPath} from "./path";

export class MockupCalender implements ICalender {
  constructor(private notify: ICalenderNotification,
              private cache: Cache) {
  }

  public async getTimeline(path: PanLPath, req: ITimelineRequest)
  : Promise<ITimeline> {
    return ({
      dayOffset: req.dayOffset,
      entries: [],
    });
  }

  public async getMeetingInfo(
    path: PanLPath, startTime: number): Promise<IMeetingInfo> {
    throw new Error("Method not implemented.");
  }

  public async createBooking(
    path: PanLPath, start: number, end: number): Promise<void> {
    throw new Error("Method not implemented.");
  }

  public async extendMeeting(
    path: PanLPath, start: number, end: number): Promise<void> {
    throw new Error("Method not implemented.");
  }

  public async endMeeting(path: PanLPath, start: number): Promise<void> {
    throw new Error("Method not implemented.");
  }

  public async cancelMeeting(path: PanLPath, start: number): Promise<void> {
    throw new Error("Method not implemented.");
  }

  public async cancelUnclaimedMeeting(
    path: PanLPath, start: number): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
