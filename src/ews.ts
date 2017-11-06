import {
  AutodiscoverService, CalendarView, ConnectingIdType, DateTime,
  EwsLogging, ExchangeService, ExchangeVersion, Folder,
  ImpersonatedUserId, Item, Uri, WebCredentials, WellKnownFolderName,
} from "ews-javascript-api";
import {Cache} from "./cache";
import {
  ICalender, ICalenderNotification, IMeetingInfo,
  ITimelineEntry, ITimelineRequest, ITimePoint,
} from "./calender";
import {PanLPath} from "./path";
import {CalenderType, ICalenderConfig} from "./persist";

export class EWSCalender implements ICalender {
  private service: ExchangeService;

  constructor(private notify: ICalenderNotification,
              private cache: Cache, config: ICalenderConfig) {
    EwsLogging.DebugLogEnabled = true;
    // TODO: auto detect exchange server version

    this.service = new ExchangeService(ExchangeVersion.Exchange2010);
    this.service.Credentials = new WebCredentials(
      config.username, config.password);
    this.service.Url = new Uri(config.address);
  }

  public async getTimeline(path: PanLPath, req: ITimelineRequest)
    : Promise<ITimelineEntry[]> {
    // TODO: get timeline from cache first
    // await cache.getTimeline(`${address}:${req.dayOffset}`);
    // Cannot find timeline from cache, get from server
    const view = new CalendarView(
      DateTime.Now.Add(-14, "day"), DateTime.Now.Add(14, "day"));
    this.service.ImpersonatedUserId =
    new ImpersonatedUserId(ConnectingIdType.SmtpAddress,
      await this.cache.getRoomAddress(path));
    const ret = await this.service.FindAppointments(
      WellKnownFolderName.Calendar, view);
    // TODO: save to cache with expiry. For today's timeline,
    // the expiry time will be the end of today
    throw new Error("Method not implemented.");
  }

  public async getMeetingInfo(path: PanLPath, id: ITimePoint):
  Promise<IMeetingInfo> {
    throw new Error("Method not implemented.");
  }

  public async createBooking(path: PanLPath, id: ITimePoint, duration: number):
  Promise<void> {
    throw new Error("Method not implemented.");
  }

  public async extendMeeting(path: PanLPath, id: ITimePoint, duration: number):
  Promise<void> {
    throw new Error("Method not implemented.");
  }

  public async endMeeting(path: PanLPath, id: ITimePoint): Promise<void> {
    throw new Error("Method not implemented.");
  }

  public async cancelMeeting(path: PanLPath, id: ITimePoint): Promise<void> {
    throw new Error("Method not implemented.");
  }

  public async cancelUnclaimedMeeting(path: PanLPath, id: ITimePoint):
  Promise<void> {
    throw new Error("Method not implemented.");
  }

}
