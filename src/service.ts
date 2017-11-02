import {EventEmitter} from "events";
import {MessageBuilder} from "./builder";
import {Cache} from "./cache";
import {CalenderManager, ITimeline,
  ITimelineEntry, ITimelineRequest} from "./calender";
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

  private async onAgentEnd(path: PanLPath): Promise<void> {
    return PanLService.cache.removeAgent(path.agent);
  }

  private onAgentError(path: PanLPath, err: Error): void {
    // TODO: process error
    log.error(`Agent ${path.agent} error: ${err}`);
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
    throw new Error("Method not implemented.");
  }

  private onGetTime(path: PanLPath): void {
    // Must not be combined with other messages to minimize the latency
    this.tx.sendImmediately(path, [MessageBuilder.buildTime()]);
  }

  private onRequestFirmware(path: PanLPath): void {
    // TODO: Broadcast assets and firmware
    throw new Error("Method not implemented.");
  }

  private onAuth(path: PanLPath, code: number): void {
    throw new Error("Method not implemented.");
  }

  private async onGetTimeline(
    path: PanLPath, req: ITimelineRequest): Promise<void> {
      this.tx.send(path, MessageBuilder.buildTimeline(
        await this.cal.getTimeline(path, req)));
  }

  private async onGetMeetingInfo(
    path: PanLPath, start: number, getBody: boolean): Promise<void> {
    if (getBody) {
      throw new Error("Method not implemented.");
    }
    this.tx.send(path, [...MessageBuilder.buildMeetingInfo(
      await this.cal.getMeetingInfo(path, start))]);
  }

  private onCreateBooking(path: PanLPath, start: number, end: number): void {
    this.cal.createBooking(path, start, end);
  }

  private onCancelUnclaimedMeeting(path: PanLPath, start: number): void {
    if (path.dest === MessageBuilder.BROADCAST_ADDR) {
      throw new Error("Invalid sender.");
    }
    this.cal.cancelUnclaimedMeeting(path, start);
  }

  private onEndMeeting(path: PanLPath, start: number): void {
    this.cal.endMeeting(path, start);
  }

  private onCancelMeeting(path: PanLPath, start: number): void {
    this.cal.cancelMeeting(path, start);
  }

  private onExtendMeeting(path: PanLPath, start: number, end: number): void {
    this.cal.extendMeeting(path, start, end);
  }

  private async onUpdate(
    path: PanLPath, previous: number, now: ITimelineEntry): Promise<void> {
    this.tx.send(path, [MessageBuilder.buildUpdateTimeline(previous, now)]);
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
      log.error(err);
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
      log.error(err);
    }
  }

  private showUnconfigured(path: PanLPath, id: number) {
    this.tx.send(path, [
      MessageBuilder.buildUnconfiguredID(id),
    ]);
  }
}
