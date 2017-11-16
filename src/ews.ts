import {
  Appointment, AppointmentSchema, AutodiscoverService,
  CalendarView, ConflictResolutionMode, ConnectingIdType, DateTime,
  EwsLogging, ExchangeService, ExchangeVersion, Folder,
  ImpersonatedUserId, Item, ItemId, PropertySet, SendInvitationsMode,
  SendInvitationsOrCancellationsMode, Uri,
  WebCredentials, WellKnownFolderName,
} from "ews-javascript-api";
import {Cache} from "./cache";
import {
  ICalendar, ICalendarNotification, IMeetingInfo,
  ITimelineEntry, ITimelineRequest, ITimePoint,
} from "./calendar";
import {PanLPath} from "./path";
import {CalendarType, ICalendarConfig, IHubConfig} from "./persist";
import {Time} from "./time";

export class EWSCalendar implements ICalendar {
  private service: ExchangeService;

  constructor(private notify: ICalendarNotification,
              private cache: Cache, config: ICalendarConfig,
              private configHub: IHubConfig) {
    EwsLogging.DebugLogEnabled = true;
    // TODO: auto detect exchange server version

    this.service = new ExchangeService(ExchangeVersion.Exchange2010);
    this.service.Credentials = new WebCredentials(
      config.username, config.password);
    this.service.Url = new Uri(config.address);
  }

  public async getTimeline(path: PanLPath, dayOffset: number):
  Promise<boolean> {
    const result: ITimelineEntry[] = [];
    // Cannot find timeline from cache, get from server
    const view = new CalendarView(
      DateTime.Now.Add(dayOffset - 1, "day"),
      DateTime.Now.Add(dayOffset, "day"));

    await this.impersonationSupport(path);

    const meetingResponse = await this.service.FindAppointments(
      WellKnownFolderName.Calendar, view);

    if (!meetingResponse || !meetingResponse.Items.length) {
      return false;
    }

    const task: any[] = [];
    // extract meeting info
    for (const meeting of meetingResponse.Items) {
      const start: number = meeting.Start.Hour * 60 + meeting.Start.Minute;
      const end: number = meeting.End.Hour * 60 + meeting.End.Minute;
      result.push({start, end});
      // save meetingInfo
      task.push(this.cache.setMeetingInfo(path,
        {dayOffset, minutesOfDay: start},
        {subject: meeting.Subject, organizer: meeting.Organizer.Name}));
      // save meetingId
      task.push(this.cache.setMeetingId(path,
        {dayOffset, minutesOfDay: start},
        meeting.Id.UniqueId));
    }
    task.push(this.cache.setTimeline(path, dayOffset, result));
    await Promise.all(task);

    // cache timeline and cache meeting, async job

    return true;
  }

  public async createBooking(path: PanLPath, id: ITimePoint, duration: number):
  Promise<void> {
    await this.impersonationSupport(path);

    // Create the appointment.
    const appointment = new Appointment(this.service);
    const roomName = await this.cache.getRoomName(path);
    const msStart = Time.getMiliseconds(id.dayOffset, id.minutesOfDay);

    // Set properties on the appointment.
    appointment.Subject = this.configHub.meetingSubject;
    appointment.Start = new DateTime(msStart);
    appointment.End = new DateTime(Time.extendTime(msStart, duration));
    appointment.Location = roomName;

    // Save the meeting to the Calendar folder and send the meeting request.
    await appointment.Save(SendInvitationsMode.SendToNone);

    // Verify that the meeting was created.
    // let item = await Item.Bind(this.service, appointment.Id, new
    // PropertySet(ItemSchema.Subject));
  }

  public async extendMeeting(path: PanLPath, id: ITimePoint, duration: number):
  Promise<void> {
    await this.impersonationSupport(path);

    const meetingId = await this.cache.getMeetingId(path, id);
    const appointmentId = new ItemId(meetingId);

    // Instantiate an meeting object by binding to it by using the ItemId.
    const appointment = await Appointment.Bind(this.service, appointmentId);

    const originMs = appointment.End.TotalMilliSeconds;
    appointment.End = new DateTime(Time.extendTime(originMs, duration));

    // Unless explicitly specified, the default is to use SendToAllAndSave..
    // This can convert an appointment into a meeting. To avoid this,
    // explicitly set SendToNone on non-meetings.
    const mode = appointment.IsMeeting ?
      SendInvitationsOrCancellationsMode.SendToAllAndSaveCopy
      : SendInvitationsOrCancellationsMode.SendToNone;

    // Send the update request to the Exchange server.
    await appointment.Update(ConflictResolutionMode.AlwaysOverwrite, mode);
  }

  public async endMeeting(path: PanLPath, id: ITimePoint): Promise<void> {
    await this.impersonationSupport(path);

    const meetingId = await this.cache.getMeetingId(path, id);
    const appointmentId = new ItemId(meetingId);

    // Instantiate an meeting object by binding to it by using the ItemId.
    const appointment = await Appointment.Bind(this.service, appointmentId);

    appointment.End = DateTime.Now;

    // Unless explicitly specified, the default is to use SendToAllAndSave..
    // This can convert an appointment into a meeting. To avoid this,
    // explicitly set SendToNone on non-meetings.
    const mode = appointment.IsMeeting ?
      SendInvitationsOrCancellationsMode.SendToAllAndSaveCopy
      : SendInvitationsOrCancellationsMode.SendToNone;

    // Send the update request to the Exchange server.
    await appointment.Update(ConflictResolutionMode.AlwaysOverwrite, mode);
  }

  public async cancelMeeting(path: PanLPath, id: ITimePoint): Promise<void> {
    await this.impersonationSupport(path);

    const meetingId = await this.cache.getMeetingId(path, id);
    const appointmentId = new ItemId(meetingId);

    // Instantiate an appointment object by binding to it using the ItemId.
    const meeting = await Appointment.Bind(this.service, appointmentId,
      new PropertySet());

    // Delete the meeting by using the CancelMeeting method.
    await meeting.CancelMeeting("The meeting has been cancelled");
  }

  public async cancelUnclaimedMeeting(path: PanLPath, id: ITimePoint):
  Promise<void> {
    await this.cancelMeeting(path, id);
  }

  private async impersonationSupport(path: PanLPath) {
    this.service.ImpersonatedUserId =
      new ImpersonatedUserId(ConnectingIdType.SmtpAddress,
        await this.cache.getRoomAddress(path));
  }
}
