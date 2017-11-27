import {
  Appointment, AppointmentSchema, AutodiscoverService,
  CalendarView, ConflictResolutionMode, ConnectingIdType, DateTime,
  EwsLogging, ExchangeService, ExchangeVersion, Folder,
  ImpersonatedUserId, Item, ItemId, PropertySet, SendInvitationsMode,
  SendInvitationsOrCancellationsMode, Uri,
  WebCredentials, WellKnownFolderName,
} from "ews-javascript-api";
import {ErrorCode} from "./builder";
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
    EwsLogging.DebugLogEnabled = false;
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

    const from = DateTime.Now.Date.AddDays(dayOffset); // midnight of dayOffset
    const to = from.AddDays(1);
    const view = new CalendarView(from, to);

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

  public async createBooking(path: PanLPath, id: ITimePoint, duration: number,
                             email: string): Promise<ErrorCode> {
    await this.impersonationSupport(path);

    // Create the appointment.
    const appointment = new Appointment(this.service);
    const roomName = await this.cache.getRoomName(path);
    const roomAdress = await this.cache.getRoomAddress(path);
    const msStart = Time.getMiliseconds(id.dayOffset, id.minutesOfDay);

    // Set properties on the appointment.
    appointment.Subject = this.configHub.meetingSubject;
    appointment.Start = new DateTime(msStart);
    appointment.End = new DateTime(Time.extendTime(msStart, duration));
    appointment.Location = roomName;
    // cancel meeting required
    appointment.RequiredAttendees.Add(roomAdress);

    // Save the meeting to the Calendar folder and send the meeting request.
    await appointment.Save(SendInvitationsMode.SendToNone);

    // Verify that the meeting was created.
    // let item = await Item.Bind(this.service, appointment.Id, new
    // PropertySet(ItemSchema.Subject));
    // TODO: Set correct error code
    return ErrorCode.ERROR_SUCCESS;
  }

  public async extendMeeting(path: PanLPath, id: ITimePoint, duration: number,
                             email: string): Promise<ErrorCode> {
    await this.impersonationSupport(path);

    const meetingId = await this.cache.getMeetingId(path, id);
    const appointmentId = new ItemId(meetingId);
    try {
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
      return ErrorCode.ERROR_SUCCESS;
    } catch (error) {
      // TODO: Set correct error code
      throw new Error(error.message);
    }
  }

  public async endMeeting(path: PanLPath, id: ITimePoint, email: string):
  Promise<ErrorCode> {
    await this.impersonationSupport(path);

    const meetingId = await this.cache.getMeetingId(path, id);
    const appointmentId = new ItemId(meetingId);

    try {
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
      return ErrorCode.ERROR_SUCCESS;
    } catch (error) {
      // TODO: Set correct error code
      throw new Error(error.message);
    }
  }

  public async cancelMeeting(path: PanLPath, id: ITimePoint, email: string):
  Promise<ErrorCode> {
    await this.impersonationSupport(path);

    const meetingId = await this.cache.getMeetingId(path, id);
    const appointmentId = new ItemId(meetingId);

    try {
      // Instantiate an appointment object by binding to it using the ItemId.
      const meeting = await Appointment.Bind(this.service, appointmentId);

      // Delete the meeting by using the CancelMeeting method.
      await meeting.CancelMeeting();
      return ErrorCode.ERROR_SUCCESS;
    } catch (error) {
      // TODO: Set correct error code
      throw new Error(error.message);
    }
  }

  public async cancelUnclaimedMeeting(path: PanLPath, id: ITimePoint):
  Promise<ErrorCode> {
    await this.cancelMeeting(path, id, "");
    // TODO: Set correct error code
    return ErrorCode.ERROR_SUCCESS;
  }

  public async isAttendeeInMeeting(path: PanLPath, id: ITimePoint,
                                   email: string): Promise<boolean> {
    // TODO: Query from Exchange server
    return true;
  }

  private async impersonationSupport(path: PanLPath) {
    this.service.ImpersonatedUserId =
      new ImpersonatedUserId(ConnectingIdType.SmtpAddress,
        await this.cache.getRoomAddress(path));
  }
}
