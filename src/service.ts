import moment = require("moment");
import {Auth} from "./auth";
import {ErrorCode, MessageBuilder} from "./builder";
import {Cache} from "./cache";
import {CalendarManager, ITimelineEntry, ITimelineRequest} from "./calendar";
import {Database} from "./database";
import {log} from "./log";
import {PanLPath} from "./path";
import {IHubConfig, IPanlConfig, Persist} from "./persist";
import {Transmit} from "./xmit";

export interface IAgentEvent {
  onAgentConnected(agent: number): Promise<void>;
  onDeviceChange(id: number): Promise<void>;
  onAgentEnd(agent: number): Promise<void>;
  onAgentError(agent: number, err: Error): Promise<void>;
  onTxDrain(agent: number): Promise<void>;
}

export interface IPanLEvent {
  onReportUUID(path: PanLPath, uuid: Buffer): Promise<void>;
  onStatus(path: PanLPath, status: number): Promise<void>;
  onGetTime(path: PanLPath): Promise<void>;
  onRequestFirmware(path: PanLPath): Promise<void>;
  onPasscode(path: PanLPath, code: number): Promise<void>;
  onRFID(path: PanLPath, epc: Buffer): Promise<void>;
  onGetTimeline(path: PanLPath, req: ITimelineRequest): Promise<void>;
  onGetMeetingInfo(path: PanLPath, id: number, getBody: boolean):
  Promise<void>;
  onCreateBooking(path: PanLPath, entry: ITimelineEntry): Promise<void>;
  onExtendMeeting(path: PanLPath, entry: ITimelineEntry): Promise<void>;
  onCancelUnclaimedMeeting(path: PanLPath, id: number): Promise<void>;
  onEndMeeting(path: PanLPath, id: number): Promise<void>;
  onCancelMeeting(path: PanLPath, id: number): Promise<void>;
  onCheckClaimMeeting(path: PanLPath, id: number): Promise<void>;
}

export interface ICalendarEvent {
  onCalMgrReady(): Promise<void>;
  onCalMgrError(err: Error): Promise<void>;
  onAdd(path: PanLPath, entry: ITimelineEntry): Promise<void>;
  onDelete(path: PanLPath, id: number): Promise<void>;
  onUpdate(path: PanLPath, id: number): Promise<void>;
  onExtend(path: PanLPath, entry: ITimelineEntry): Promise<void>;
}

export class PanLService implements IAgentEvent, IPanLEvent, ICalendarEvent {
  public static async getInstance(): Promise<PanLService> {
    if (!PanLService.instance) {
      PanLService.db = await Database.getInstance();
      PanLService.cache = await Cache.getInstance();
      PanLService.instance = new PanLService(await Persist.getHubConfig(),
        await Persist.getPanlConfig());
    } else {
      PanLService.instance.addRef();
    }
    return PanLService.instance;
  }

  private static instance: PanLService;
  private static cache: Cache;
  private static db: Database;

  private tx: Transmit;
  private cal: CalendarManager;
  private newDayJob: NodeJS.Timer;

  private constructor(private hub: IHubConfig, private panl: IPanlConfig,
                      private refCnt = 1) {
    this.tx = new Transmit(this, this);
    this.cal = new CalendarManager(PanLService.cache, this, hub, panl);
    this.cal.connect();
    this.setupNewDayTask();
  }

  public async stop(): Promise<void> {
    if (--this.refCnt === 0) {
      clearTimeout(this.newDayJob);
      await this.tx.stop();
      await this.cal.disconnect();
      await PanLService.cache.stop();
      await PanLService.db.stop();
      delete PanLService.instance;
    }
  }

  public async onCalMgrReady(): Promise<void> {
    log.info("Calendar manager is online");
    PanLService.cache.consumePending((path) => {
      this.initPanel(path);
    });
  }

  public async onCalMgrError(err: Error): Promise<void> {
    log.error(`Failed to start Calendar Manager ${err},` +
      `will try again in 30seconds`);
    setTimeout(this.cal.connect.bind(this.cal), 30 * 1000);
  }

  public async onAgentEnd(id: number): Promise<void> {
    log.debug(`Agent ${id} end notification`);
    await PanLService.cache.removeAgent(id);
  }

  public async onAgentError(id: number, err: Error): Promise<void> {
    log.info(`Agent ${id} error: ${err}`);
  }

  public async onTxDrain(id: number): Promise<void> {
    this.tx.onDrain(id);
  }

  public async onDeviceChange(id: number): Promise<void> {
    await PanLService.cache.removeAgent(id);
    await this.onAgentConnected(id);
  }

  public async onReportUUID(path: PanLPath, uuid: Buffer): Promise<void> {
    const room = await Persist.findPanlRoom(uuid);

    if (room !== undefined) {
      log.verbose(`Connect ${path} to room ${room.name}`);
      await PanLService.cache.addConfigured(path, room);
      if (this.cal.connected) {
        await this.initPanel(path);
      } else {
        await PanLService.cache.addPending(path);
      }
    } else {
      this.showUnconfigured(path,
        await PanLService.cache.addUnconfigured(path, uuid));
    }
  }

  public async onStatus(path: PanLPath, status: number): Promise<void> {
    log.error("TODO: Method onStatus not implemented.");
  }

  public async onGetTime(path: PanLPath): Promise<void> {
    // Must not be combined with other messages to minimize the latency
    this.tx.sendImmediately(path, [MessageBuilder.buildTime()]);
  }

  public async onRequestFirmware(path: PanLPath): Promise<void> {
    // TODO: Broadcast assets and firmware
    log.error("TODO: Method onRequestFirmware not implemented.");
  }

  public async onPasscode(path: PanLPath, code: number): Promise<void> {
    await this.processAuthResult(path, await Auth.authByPasscode(code));
  }

  public async onRFID(path: PanLPath, epc: Buffer): Promise<void> {
    await this.processAuthResult(path, await Auth.authByRFID(epc));
  }

  public async onGetTimeline(
    path: PanLPath, req: ITimelineRequest): Promise<void> {
    try {
      const datetime = moment(req.id).calendar();
      const method = req.lookForward ? "from" : "before";
      log.debug(`Path ${path} requests ${req.maxCount} slots ${method} ` +
        datetime);
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
    try {
      this.tx.send(path, MessageBuilder.buildMeetingInfo(
        await this.cal.getMeetingInfo(path, id)));
    } catch (err) {
      log.warn(`Not able to get meeting info for ${path}: ${err}`);
    }
  }

  public async onCreateBooking(path: PanLPath, entry: ITimelineEntry):
  Promise<void> {
    try {
      this.tx.send(path, [MessageBuilder.buildErrorCode(
        await this.cal.createBooking(path, entry))]);
    } catch (err) {
      log.warn(`Create booking failed for ${path}: ${err}`);
    }
  }

  public async onExtendMeeting(path: PanLPath, entry: ITimelineEntry):
  Promise<void> {
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
    try {
      this.tx.send(path, [MessageBuilder.buildErrorCode(
        await this.cal.cancelUnclaimedMeeting(path, id))]);
    } catch (err) {
      log.warn(`Cancel unclaimed meeting failed for ${path}: ${err}`);
    }
  }

  public async onEndMeeting(path: PanLPath, id: number):
  Promise<void> {
    try {
      this.tx.send(path, [MessageBuilder.buildErrorCode(
        await this.cal.endMeeting(path, id))]);
    } catch (err) {
      log.warn(`End meeting failed for ${path}: ${err}`);
    }
  }

  public async onCancelMeeting(path: PanLPath, id: number):
  Promise<void> {
    try {
      this.tx.send(path, [MessageBuilder.buildErrorCode(
        await this.cal.cancelMeeting(path, id))]);
    } catch (err) {
      log.warn(`Cancel meeting failed for ${path}: ${err}`);
    }
  }

  public async onCheckClaimMeeting(path: PanLPath, id: number):
  Promise<void> {
    try {
      this.tx.send(path, [MessageBuilder.buildErrorCode(
        await this.cal.checkClaimMeeting(path, id))]);
    } catch (err) {
      log.warn(`Claim meeting failed for ${path}: ${err}`);
    }
  }

  public async onExtend(path: PanLPath, entry: ITimelineEntry): Promise<void> {
    try {
      this.tx.send(path, [MessageBuilder.buildExtendMeeting(entry)]);
    } catch (err) {
      log.warn(`Extend meeting notification failed for ${path}: ${err}`);
    }
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
      const [name, entriesBefore, entriesAfter] = await Promise.all([
        PanLService.cache.getRoomName(
          await PanLService.cache.getRoomAddress(path)),
        this.cal.getTimeline(path, reqBefore),
        this.cal.getTimeline(path, reqAfter),
      ]);
      const ignoreBefore = entriesBefore.length === 0 ||
        minutesOfDay >= entriesBefore[0].end;
      const entries = ignoreBefore
        ? entriesAfter : entriesBefore.concat(entriesAfter);
      log.debug(`Request ${path} set room name to ${name}, busy slot(s): ` +
        entries.length);
      if (entries.length === 0) {
        this.tx.send(path, [
          ...MessageBuilder.buildRoomName(name),
          ...MessageBuilder.buildTimeline(entries, 0),
        ]);
      } else if (entries.length === 1) {
        this.tx.send(path, [
          ...MessageBuilder.buildRoomName(name),
          ...MessageBuilder.buildTimeline(entries, 0),
          ...MessageBuilder.buildMeetingInfo(
            await this.cal.getMeetingInfo(path, entries[0].start)),
        ]);
      } else {
        // Send next meeting info too
        const info = await Promise.all([
          this.cal.getMeetingInfo(path, entries[0].start),
          this.cal.getMeetingInfo(path, entries[1].start),
        ]);
        this.tx.send(path, [
          ...MessageBuilder.buildRoomName(name),
          ...MessageBuilder.buildTimeline(entries, 0),
          ...MessageBuilder.buildMeetingInfo(info[0]),
          ...MessageBuilder.buildMeetingInfo(info[1]),
        ]);
      }
    } catch (err) {
      log.warn(`Init panel failed for ${path}: ${err}`);
    }
  }

  private showUnconfigured(path: PanLPath, id: number) {
    try {
      log.debug(`Request ${path} show id ${id}`);
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
    await PanLService.cache.setAuthSuccess(path, email);
  }

  private onNewDayTask(): void {
    this.tx.broadcastToAllImmediately([MessageBuilder.buildTime()]);
    this.setupNewDayTask();
  }

  private setupNewDayTask(): void {
    const now = moment();
    this.newDayJob = setTimeout(
      this.onNewDayTask.bind(this), moment().endOf("day").diff(now));
  }

  private addRef(): void {
    this.refCnt++;
  }
}
