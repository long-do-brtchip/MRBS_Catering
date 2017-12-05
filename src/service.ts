import moment = require("moment");
import {Auth} from "./auth";
import {ErrorCode, MessageBuilder} from "./builder";
import {Cache} from "./cache";
import {CalendarManager, ITimelineEntry, ITimelineRequest} from "./calendar";
import {Database} from "./database";
import {IAgentEvent, ICalendarEvent,
  IMessageTransport, IPanLEvent} from "./interface";
import {log} from "./log";
import {PanLPath} from "./path";
import {IHubConfig, IPanlConfig, Persist} from "./persist";
import {TcpSocket} from "./socket";
import {Transmit} from "./xmit";

export class PanLService implements IAgentEvent, IPanLEvent, ICalendarEvent {
  public static async getInstance():
  Promise<[PanLService, () => Promise<void>]> {
    const db = await Database.getInstance();
    const cache = await Cache.getInstance();
    const cal = new CalendarManager(cache,
      await Persist.getHubConfig(),
      await Persist.getPanlConfig(),
    );
    const transport = new TcpSocket(0xF7D1);
    const service = new PanLService(cache, cal, transport);
    await service.start();

    return [service, async () => {
      await service.stop();
      await cache.stop();
      await db.stop();
    }];
  }

  private tx: Transmit;
  private newDayJob: NodeJS.Timer;

  public constructor(private cache: Cache,
                     private cal: CalendarManager,
                     private transport: IMessageTransport) {
    this.tx = new Transmit(this.transport);
    this.setupNewDayTask();
  }

  public async start() {
    await this.transport.start(this, this);
    await this.cal.connect(this);
  }

  public async stop(): Promise<void> {
    clearTimeout(this.newDayJob);
    await this.transport.stop();
    await this.cal.disconnect();
  }

  // Agent events
  public async onAgentConnected(agent: number): Promise<void> {
    const msgs = [
      MessageBuilder.buildExpectedFirmwareVersion(),
      MessageBuilder.buildUUID(),
      MessageBuilder.buildLangID(),
      MessageBuilder.buildTimeFormat(),
      MessageBuilder.buildAccessRight(await Persist.getPanlConfig()),
      // Build SetTime at last to minimize the latency
      MessageBuilder.buildTime(),
    ];
    /* Broadcast init settings to single agent */
    try {
      log.debug(`Broadcast init settings to agent ${agent}`);
      this.tx.broadcastImmediately(agent, msgs);
    } catch (err) {
      log.warn(`Broadcast init settings failed for agent ${agent}: ${err}`);
    }
  }

  public async onAgentEnd(id: number): Promise<void> {
    log.debug(`Agent ${id} end notification`);
    await this.cache.removeAgent(id);
  }

  public async onAgentError(id: number, err: Error): Promise<void> {
    log.info(`Agent ${id} error: ${err}`);
  }

  public async onTxDrain(id: number): Promise<void> {
    this.tx.onDrain(id);
  }

  public async onDeviceChange(id: number): Promise<void> {
    await this.cache.removeAgent(id);
    await this.onAgentConnected(id);
  }

  //  PanL events
  public async onReportUUID(path: PanLPath, uuid: Buffer): Promise<void> {
    const room = await Persist.findPanlRoom(uuid);

    if (room !== undefined) {
      log.verbose(`Connect ${path} to room ${room.name}`);
      await this.cache.addConfigured(path, room);
      if (this.cal.connected) {
        await this.initPanel(path);
      } else {
        await this.cache.addPending(path);
      }
    } else {
      this.showUnconfigured(path,
        await this.cache.addUnconfigured(path, uuid));
    }
  }

  public async onStatus(path: PanLPath, status: number): Promise<void> {
    log.error("TODO: Method onStatus not implemented.");
  }

  public async onGetTime(path: PanLPath): Promise<void> {
    // Must not be combined with other messages to minimize the latency
    try {
      this.tx.sendImmediately(path, [MessageBuilder.buildTime()]);
    } catch (err) {
      log.warn(`Failed to send time to ${path}: ${err}`);
    }
  }

  public async onRequestFirmware(path: PanLPath): Promise<void> {
    // TODO: Broadcast assets and firmware
    log.error("TODO: Method onRequestFirmware not implemented.");
  }

  public async onPasscode(path: PanLPath, code: number): Promise<void> {
    log.debug(`Path ${path} requests passcode authentication`);
    try {
      await this.processAuthResult(path, await Auth.authByPasscode(code));
    } catch (err) {
      log.warn(`Failed to process passcode for ${path}: ${err}`);
    }
  }

  public async onRFID(path: PanLPath, epc: Buffer): Promise<void> {
    try {
      await this.processAuthResult(path, await Auth.authByRFID(epc));
    } catch (err) {
      log.warn(`Failed to process RFID for ${path}: ${err}`);
    }
  }

  public async onGetTimeline(
    path: PanLPath, req: ITimelineRequest): Promise<void> {
    const method = req.lookForward ? "from" : "before";
    log.debug(`Path ${path} requests ${req.maxCount} slots ${method} ` +
      moment(req.id).calendar());
    try {
      this.tx.send(path, MessageBuilder.buildTimeline(
        await this.cal.getTimeline(path, req), req.id));
    } catch (err) {
      log.warn(`Not able to get timeline for ${path}: ${err}`);
    }
  }

  public async onGetMeetingInfo(
    path: PanLPath, id: number, getBody: boolean): Promise<void> {
    if (getBody) {
      log.error("TODO: Parameter getBody not implemented.");
    }
    log.debug(`Path ${path} requests meeting info ${moment(id).calendar()}`);
    try {
      this.tx.send(path, MessageBuilder.buildMeetingInfo(
        await this.cal.getMeetingInfo(path, id)));
    } catch (err) {
      log.warn(`Not able to get meeting info for ${path}: ${err}`);
    }
  }

  public async onCreateBooking(path: PanLPath, entry: ITimelineEntry):
  Promise<void> {
    log.debug(`Path ${path} create meeting for ` +
      moment(entry.start).calendar());
    try {
      this.tx.send(path, [MessageBuilder.buildErrorCode(
        await this.cal.createBooking(path, entry))]);
    } catch (err) {
      log.warn(`Create booking failed for ${path}: ${err}`);
    }
  }

  public async onExtendMeeting(path: PanLPath, entry: ITimelineEntry):
  Promise<void> {
    log.debug(`Path ${path} extend meeting for ` +
      moment(entry.start).calendar());
    try {
      this.tx.send(path, [MessageBuilder.buildErrorCode(
        await this.cal.extendMeeting(path, entry))]);
    } catch (err) {
      log.warn(`Extend meeting failed for ${path}: ${err}`);
    }
  }

  public async onCancelUnclaimedMeeting(path: PanLPath, id: number):
  Promise<void> {
    if (path.dest === MessageBuilder.BROADCAST_ADDR) {
      log.error(`Invalid sender from agent ${path.agent}.`);
    }
    log.debug(`Path ${path} cancel unclaimed for ${moment(id).calendar()}`);
    try {
      this.tx.send(path, [MessageBuilder.buildErrorCode(
        await this.cal.cancelUnclaimedMeeting(path, id))]);
    } catch (err) {
      log.warn(`Cancel unclaimed meeting failed for ${path}: ${err}`);
    }
  }

  public async onEndMeeting(path: PanLPath, id: number):
  Promise<void> {
    log.debug(`Path ${path} end meeting for ${moment(id).calendar()}`);
    try {
      this.tx.send(path, [MessageBuilder.buildErrorCode(
        await this.cal.endMeeting(path, id))]);
    } catch (err) {
      log.warn(`End meeting failed for ${path}: ${err}`);
    }
  }

  public async onCancelMeeting(path: PanLPath, id: number):
  Promise<void> {
    log.debug(`Path ${path} cancel meeting for ${moment(id).calendar()}`);
    try {
      this.tx.send(path, [MessageBuilder.buildErrorCode(
        await this.cal.cancelMeeting(path, id))]);
    } catch (err) {
      log.warn(`Cancel meeting failed for ${path}: ${err}`);
    }
  }

  public async onCheckClaimMeeting(path: PanLPath, id: number):
  Promise<void> {
    log.debug(`Path ${path} want to claim for ${moment(id).calendar()}`);
    try {
      this.tx.send(path, [MessageBuilder.buildErrorCode(
        await this.cal.checkClaimMeeting(path, id))]);
    } catch (err) {
      log.warn(`Claim meeting failed for ${path}: ${err}`);
    }
  }

  // Calendar events
  public async onCalMgrReady(): Promise<void> {
    log.info("Calendar manager is online");
    await this.cache.consumePending((path) => {
      this.initPanel(path);
    });
  }

  public async onCalMgrError(err: Error): Promise<void> {
    log.error(`Failed to start Calendar Manager ${err},` +
      `will try again in 30seconds`);
    setTimeout(this.cal.connect.bind(this.cal), 30 * 1000);
  }

  public async onAdd(path: PanLPath, entry: ITimelineEntry): Promise<void> {
    try {
      this.tx.send(path, [MessageBuilder.buildAddMeeting(entry)]);
    } catch (err) {
      log.warn(`Add meeting notification failed for ${path}: ${err}`);
    }
  }

  public async onDelete(
    path: PanLPath, id: number): Promise<void> {
    try {
      this.tx.send(path, [MessageBuilder.buildDeleteMeeting(id)]);
    } catch (err) {
      log.warn(`Delete meeting notification failed for ${path}: ${err}`);
    }
  }

  public async onUpdate(
    path: PanLPath, id: number): Promise<void> {
    try {
      this.tx.send(path, [MessageBuilder.buildUpdateMeeting(id)]);
    } catch (err) {
      log.warn(`Update meeting notification failed for ${path}: ${err}`);
    }
  }

  public async onEndTimeChanged(path: PanLPath, entry: ITimelineEntry):
  Promise<void> {
    try {
      this.tx.send(path, [MessageBuilder.buildMeetingEndTimeChanged(entry)]);
    } catch (err) {
      log.warn(`Extend meeting notification failed for ${path}: ${err}`);
    }
  }

  //  Private methods
  private async initPanel(path: PanLPath): Promise<void> {
    const now = moment();
    const epoch = now.valueOf();
    const minutesOfDay = now.diff(now.clone().startOf("day"), "minutes");
    const reqBefore: ITimelineRequest = {
      id: epoch,
      lookForward: false,
      maxCount: 1,
    };
    const reqAfter: ITimelineRequest = {
      id: epoch,
      lookForward: true,
      maxCount: 5,
    };

    try {
      const room = await this.cache.getRoomAddress(path);
      const [name, entriesBefore, entriesAfter] = await Promise.all([
        this.cache.getRoomName(room),
        this.cal.getTimeline(path, reqBefore),
        this.cal.getTimeline(path, reqAfter),
      ]);
      const ignoreBefore = entriesBefore.length === 0 ||
        minutesOfDay >= entriesBefore[0].end;
      const entries = ignoreBefore
        ? entriesAfter : entriesBefore.concat(entriesAfter);
      log.debug(`Request ${path} set room name to ${name}, busy slot(s): ` +
        entries.length);

      this.tx.send(path, [
        ...MessageBuilder.buildRoomName(name),
        ...await this.getUpToTwoNewMeetingInfos(room, epoch, entries),
      ]);
    } catch (err) {
      log.warn(`Init panel failed for ${path}: ${err}`);
    }
  }

  private showUnconfigured(path: PanLPath, id: number) {
    log.debug(`Request ${path} show id ${id}`);
    try {
      this.tx.send(path, [
        MessageBuilder.buildUnconfiguredID(id),
      ]);
    } catch (err) {
      log.warn(`Show Unconfigured ID failed for ${path}: ${err}`);
    }
  }

  private async processAuthResult(path: PanLPath, email: string):
  Promise<void> {
    if (email.length === 0) {
      const msg = [MessageBuilder.buildErrorCode(ErrorCode.ERROR_AUTH_ERROR)];
      this.tx.send(path, msg);
      return;
    }
    await this.cache.setAuthSuccess(path, email);
  }

  private onNewDayTask(): void {
    try {
      this.tx.broadcastToAllImmediately([MessageBuilder.buildTime()]);
      this.updateMeetingInfoForAllPanls();
      this.setupNewDayTask();
    } catch (err) {
      log.debug("Failed to start new day task:", err);
    }
  }

  private setupNewDayTask(): void {
    const now = moment();
    this.newDayJob = setTimeout(
      this.onNewDayTask.bind(this), moment().endOf("day").diff(now));
  }

  private async updateMeetingInfoForAllPanls(): Promise<void> {
    const dayStart = moment().startOf("day").valueOf();
    const rooms = await this.cache.getOnlineRooms();
    for (const room of rooms) {
      const paths = await this.cache.getRoomPanLs(room);
      if (paths.length === 0) {
        continue;
      }
      const entries = await this.cal.getTimeline(paths[0],
        {id: dayStart, lookForward: true, maxCount: 5});
      const msgs = await this.getUpToTwoNewMeetingInfos(
        room, dayStart, entries);
      for (const path of paths) {
        this.tx.send(path, msgs);
      }
    }
  }

  private async getUpToTwoNewMeetingInfos(room: string, id: number,
                                          entries: ITimelineEntry[]):
  Promise<Buffer[]> {
    let msgs;
    if (entries.length === 0) {
      msgs = [...MessageBuilder.buildTimeline(entries, id)];
    } else if (entries.length === 1) {
      msgs = [...MessageBuilder.buildTimeline(entries, id),
        ...MessageBuilder.buildMeetingInfo(
          await this.cache.getMeetingInfo(room, entries[0].start)),
      ];
    } else {
      const info = await Promise.all([
        this.cache.getMeetingInfo(room, entries[0].start),
        this.cache.getMeetingInfo(room, entries[1].start),
      ]);
      msgs = [
        ...MessageBuilder.buildTimeline(entries, id),
        ...MessageBuilder.buildMeetingInfo(info[0]),
        ...MessageBuilder.buildMeetingInfo(info[1]),
      ];
    }
    return msgs;
  }
}
