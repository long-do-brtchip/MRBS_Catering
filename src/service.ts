import {EventEmitter} from "events";
import {MessageBuilder} from "./builder";
import {Cache} from "./cache";
import {
  CalenderManager, ITimeline,
  ITimelineEntry, ITimelineRequest, ITimePoint,
} from "./calender";
import {log} from "./log";
import {PanLPath} from "./path";
import {IRoom, Persist} from "./persist";
import {Transmit} from "./xmit";

export class PanLService extends EventEmitter {
  public static async getInstance(): Promise<PanLService> {
    if (PanLService.instance === undefined) {
      PanLService.persist = await Persist.getInstance();
      PanLService.cache = await Cache.getInstance();
      PanLService.instance = new PanLService();
    }
    return PanLService.instance;
  }

  private static instance: PanLService | undefined;
  private static cache: Cache;
  private static persist: Persist;

  private static getMinutesPassed(): number {
    const date = new Date();
    return date.getHours() * 60 + date.getMinutes();
  }

  private tx: Transmit;
  private cal: CalenderManager;

  private constructor() {
    super();
    this.on("calMgrReady", this.onCalMgrReady);
    this.on("calMgrError", this.onCalMgrError);

    this.on("agentConnected", this.onAgentConnected);
    this.on("agentEnd", this.onAgentEnd);
    this.on("agentError", this.onAgentError);
    this.on("txDrain", this.onTxDrain);

    this.on("uuid", this.onReportUUID);
    this.on("deviceChange", this.onDeviceChange);
    this.on("status", this.onStatus);
    this.on("gettime", this.onGetTime);
    this.on("requestFirmware", this.onRequestFirmware);
    this.on("auth", this.onAuth);
    this.on("getTimeline", this.onGetTimeline);
    this.on("getMeetingInfo", this.onGetMeetingInfo);
    this.on("extendMeeting", this.onExtendMeeting);
    this.on("cancelMeeting", this.onCancelMeeting);
    this.on("endMeeting", this.onEndMeeting);
    this.on("cancelUnclaimedMeeting", this.onCancelUnclaimedMeeting);
    this.on("CreateBooking", this.onCreateBooking);
    this.on("move", this.onMove);
    this.on("add", this.onAdd);
    this.on("extend", this.onExtend);
    this.on("delete", this.onDelete);
    this.on("update", this.onUpdate);

    this.tx = new Transmit(PanLService.persist, this);
    this.cal = new CalenderManager(
      PanLService.cache, PanLService.persist, this);
    this.cal.connect();
  }

  public async stop(): Promise<void> {
    this.tx.stop();
    await this.cal.disconnect();
    this.removeAllListeners();
    await PanLService.persist.stop();
    await PanLService.cache.stop();
    PanLService.instance = undefined;
  }

  private onCalMgrReady(): void {
    log.info("Calender manager is online");
    PanLService.cache.consumePending((path) => {
      this.initPanel(path);
    });
  }

  private onCalMgrError(err: Error): void {
    log.error(`Failed to start Calender Manager ${err},` +
      `will try again in 30seconds`);
    setTimeout(this.cal.connect, 30 * 1000);
  }

  private onAgentConnected(path: PanLPath): void {
    /* Send command to ask PanLs report UUID */
    this.broadcastInitSettings(path.agent);
  }

  private onAgentEnd(path: PanLPath): void {
    PanLService.cache.removeAgent(path.agent);
  }

  private onAgentError(path: PanLPath, err: Error): void {
    log.info(`Agent ${path.agent} error: ${err}`);
  }

  private onTxDrain(path: PanLPath): void {
    this.tx.onDrain(path.agent);
  }

  private async onReportUUID(path: PanLPath, uuid: Buffer): Promise<void> {
    const room = await PanLService.persist.findRoom(uuid);

    if (room !== undefined) {
      await PanLService.cache.addConfigured(path, room);
      if (this.cal.connected) {
        this.initPanel(path);
      } else {
        PanLService.cache.addPending(path);
      }
    } else {
      this.showUnconfigured(path,
        await PanLService.cache.addUnconfigured(path));
    }
  }

  private onDeviceChange(path: PanLPath): void {
    PanLService.cache.removeAgent(path.agent);
    this.tx.broadcast(path.agent, [
      MessageBuilder.buildUUID(),
    ]);
  }

  private onStatus(path: PanLPath, status: number): void {
    log.error("TODO: Method onStatus not implemented.");
  }

  private onGetTime(path: PanLPath): void {
    // Must not be combined with other messages to minimize the latency
    this.tx.sendImmediately(path, [MessageBuilder.buildTime()]);
  }

  private onRequestFirmware(path: PanLPath): void {
    // TODO: Broadcast assets and firmware
    log.error("TODO: Method onRequestFirmware not implemented.");
  }

  private onAuth(path: PanLPath, code: number): void {
    log.error("TODO: Method onAuth not implemented.");
  }

  private async onGetTimeline(
    path: PanLPath, req: ITimelineRequest): Promise<void> {
    try {
      this.tx.send(path, MessageBuilder.buildTimeline(
        await this.cal.getTimeline(path, req)));
    } catch (err) {
      log.warn(`Not able to get timeline for ${path.uid}: ${err}`);
    }
  }

  private async onGetMeetingInfo(
    path: PanLPath, start: number, getBody: boolean): Promise<void> {
    if (getBody) {
      log.error("TODO: Parameter getBody not implemented.");
    }
    try {
      this.tx.send(path, MessageBuilder.buildMeetingInfo(
          await this.cal.getMeetingInfo(path, start)));
    } catch (err) {
      log.warn(`Not able to get meeting info for ${path.uid}: ${err}`);
    }
  }

  private onCreateBooking(path: PanLPath, id: ITimePoint, duration: number):
  void {
    try {
      this.cal.createBooking(path, id, duration);
    } catch (err) {
      log.warn(`Create booking failed for ${path.uid}: ${err}`);
    }
  }

  private onExtendMeeting(path: PanLPath, id: ITimePoint, duration: number):
  void {
    try {
      this.cal.extendMeeting(path, id, duration);
    } catch (err) {
      log.warn(`Extend meeting failed for ${path.uid}: ${err}`);
    }
  }

  private onCancelUnclaimedMeeting(path: PanLPath, id: ITimePoint): void {
    if (path.dest === MessageBuilder.BROADCAST_ADDR) {
      log.error(`Invalid sender from agent ${path.agent}.`);
    }
    try {
      this.cal.cancelUnclaimedMeeting(path, id);
    } catch (err) {
      log.warn(`Cancel unclaimed meeting failed for ${path.uid}: ${err}`);
    }
  }

  private onEndMeeting(path: PanLPath, id: ITimePoint): void {
    try {
      this.cal.endMeeting(path, id);
    } catch (err) {
      log.warn(`End meeting failed for ${path.uid}: ${err}`);
    }
  }

  private onCancelMeeting(path: PanLPath, id: ITimePoint): void {
    try {
      this.cal.cancelMeeting(path, id);
    } catch (err) {
      log.warn(`Cancel meeting failed for ${path.uid}: ${err}`);
    }
  }

  private async onMove(
    path: PanLPath, previous: ITimePoint, now: ITimePoint, duration: number):
  Promise<void> {
    try {
      this.tx.send(path, [
        MessageBuilder.buildMoveMeeting(previous, now, duration),
      ]);
    } catch (err) {
      log.warn(`Move meeting notification failed for ${path.uid}: ${err}`);
    }
  }

  private async onExtend(
    path: PanLPath, id: ITimePoint, newDuration: number): Promise<void> {
    try {
      this.tx.send(path, [MessageBuilder.buildExtendMeeting(id, newDuration)]);
    } catch (err) {
      log.warn(`Extend meeting notification failed for ${path.uid}: ${err}`);
    }
  }

  private async onAdd(
    path: PanLPath, id: ITimePoint, duration: number): Promise<void> {
    try {
      this.tx.send(path, [MessageBuilder.buildAddMeeting(id, duration)]);
    } catch (err) {
      log.warn(`Add meeting notification failed for ${path.uid}: ${err}`);
    }
  }

  private async onDelete(
    path: PanLPath, id: ITimePoint): Promise<void> {
    try {
      this.tx.send(path, [MessageBuilder.buildDeleteMeeting(id)]);
    } catch (err) {
      log.warn(`Delete meeting notification failed for ${path.uid}: ${err}`);
    }
  }

  private async onUpdate(
    path: PanLPath, id: ITimePoint): Promise<void> {
    try {
      this.tx.send(path, [MessageBuilder.buildUpdateMeeting(id)]);
    } catch (err) {
      log.warn(`Update meeting notification failed for ${path.uid}: ${err}`);
    }
  }

  private broadcastInitSettings(agent: number): void {
    const msgs = [
      MessageBuilder.buildExpectedFirmwareVersion(),
      MessageBuilder.buildUUID(),
      MessageBuilder.buildLangID(),
      MessageBuilder.buildTimeFormat(),
      // Build SetTime at last to minimize the latency
      MessageBuilder.buildTime(),
    ];
    /* Broadcast init settings to single agent */
    try {
      this.tx.broadcastImmediately(agent, msgs);
    } catch (err) {
      log.warn(`Broadcast init settings failed for agent ${agent}: ${err}`);
    }
  }

  private async initPanel(path: PanLPath): Promise<void> {
    const now = PanLService.getMinutesPassed();
    const req: ITimelineRequest = {
      dayOffset: 0,
      lookForward: true,
      maxCount: 8,
      startTime: now,
    };

    try {
      const [name, timeline, info] = await Promise.all([
        PanLService.cache.getRoomName(path),
        this.cal.getTimeline(path, req),
        this.cal.getMeetingInfo(path, now),
      ]);
      this.tx.send(path, [
        ...MessageBuilder.buildRoomName(name),
        MessageBuilder.buildTimeline(timeline),
        ...MessageBuilder.buildMeetingInfo(info),
      ] as Buffer[]);
    } catch (err) {
      log.warn(`Init panel failed for path ${path.uid}: ${err}`);
    }
  }

  private showUnconfigured(path: PanLPath, id: number) {
    try {
      this.tx.send(path, [
        MessageBuilder.buildUnconfiguredID(id),
      ]);
    } catch (err) {
      log.warn(`Show Unconfigured ID failed for ${path.uid}: ${err}`);
    }
  }
}
