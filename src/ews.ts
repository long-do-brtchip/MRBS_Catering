import {
  AutodiscoverService, CalendarView, ConnectingIdType, DateTime,
  EwsLogging, ExchangeService, ExchangeVersion, Folder,
  ImpersonatedUserId, Item, Uri, WebCredentials, WellKnownFolderName,
} from "ews-javascript-api";
import {ICalender, ITimeline, ITimelineRequest} from "./calender";
import {CalenderType, ICalenderConfig} from "./persist";

export class EWSCalender implements ICalender {
  private service: ExchangeService;

  constructor(config: ICalenderConfig) {
    EwsLogging.DebugLogEnabled = true;
    // TODO: auto detect exchange server version

    this.service = new ExchangeService(ExchangeVersion.Exchange2010);
    this.service.Credentials = new WebCredentials(
      config.username, config.password);
    this.service.Url = new Uri(config.address);
  }

  public async getTimeline(address: string, req: ITimelineRequest)
    : Promise<ITimeline> {
    // TODO: get timeline from cache first
    // await cache.getTimeline(`${address}:${req.dayOffset}`);
    // Cannot find timeline from cache, get from server
    const view = new CalendarView(
      DateTime.Now.Add(-14, "day"), DateTime.Now.Add(14, "day"));
    this.service.ImpersonatedUserId =
    new ImpersonatedUserId(ConnectingIdType.SmtpAddress, address);
    const ret = await this.service.FindAppointments(
      WellKnownFolderName.Calendar, view);
    // TODO: save to cache with expiry. For today's timeline,
    // the expiry time will be the end of today
    throw new Error("Method not implemented.");
  }
}
