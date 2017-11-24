import {EventEmitter} from "events";
import ref = require("ref");
import ArrayType = require("ref-array");
import StructType = require("ref-struct");
import {ITimelineRequest, ITimePoint} from "./calendar";
import {log} from "./log";
import {PanLPath} from "./path";
import {IAgentEvent, IPanLEvent} from "./service";

enum Incoming {
  REPORT_AGENT_ID,
  REPORT_UUID,
  REPORT_PANL_STATUS,
  REPORT_DEVICE_CHANGE,
  REQUEST_FIRMWARE,
  AUTH_BY_PASSCODE,
  AUTH_BY_RFID,
  GET_LOCAL_TIME,
  SET_ADDRESS,
  GET_TIMELINE,
  GET_MEETING_BODY,
  GET_MEETING_INFO,
  EXTEND_MEETING,
  CANCEL_MEETING,
  END_MEETING,
  CANCEL_UNCLAIM_MEETING,
  CREATE_BOOKING,
  CHECK_CLAIM_MEETING,
}

const StructAuthByPasscode = StructType({
  passcode : ref.types.uint32,
}, {packed: true});

const StructAuthByRFID = StructType({
  epc : ArrayType(ref.types.uint8, 11),
}, {packed: true});

const StructTimeline = StructType({
  offset: ref.types.int8,
  time: ref.types.int16,
  count: ref.types.uint8,
}, {packed: true});

const StructTime = StructType({
  dayOffset: ref.types.int8,
  minutesOfDay: ref.types.uint16,
}, {packed: true});

const StructTimespan = StructType({
  dayOffset: ref.types.int8,
  minutesOfDay: ref.types.uint16,
  duration: ref.types.uint16,
}, {packed: true});

const StructReportAgent = StructType({
  id: ref.types.uint8,
  uid: ref.types.uint64,
}, {packed: true});

export class MessageParser {
  public static async parseAgentID(buffer: Buffer): Promise<Buffer> {
    const buf = StructReportAgent(buffer);
    if (buffer.length !== StructReportAgent.size ||
      buf.id !== Incoming.REPORT_AGENT_ID) {
      throw new Error("Invalid client");
    }
    return buffer.slice(1);
  }

  private stopped = false;
  private evt = new EventEmitter();
  private path: PanLPath;
  private getBody = false;
  private bufs: Buffer[] = [];

  constructor(private agentEvt: IAgentEvent, private panlEvt: IPanLEvent,
              public id: number) {
    this.agentEvt.onAgentConnected(id);
  }

  public onData(buffer: Buffer): void {
    this.bufs.push(buffer);
    this.evt.emit("rdy");
  }

  public stop() {
    this.stopped = true;
    this.evt.emit("stop");
  }

  public startParserEngine(): Promise<void> {
    return this.parseBuffer(Buffer.alloc(0));
  }

  private async parseBuffer(next: Buffer): Promise<void> {
    while (true) {
      let buf;
      // Get ID
      [buf, next] = await this.waitBuf(next, 1);
      // Parse payload
      switch (buf[0]) {
        case Incoming.REQUEST_FIRMWARE:
          await this.panlEvt.onRequestFirmware(this.path);
          break;
        case Incoming.AUTH_BY_PASSCODE:
          [buf, next] = await this.waitBuf(next, StructAuthByPasscode.size);
          await this.panlEvt.onPasscode(this.path,
            StructAuthByPasscode(buf).passcode);
          break;
        case Incoming.AUTH_BY_RFID:
          [buf, next] = await this.waitBuf(next, StructAuthByRFID.size);
          await this.panlEvt.onRFID(this.path, buf);
        case Incoming.SET_ADDRESS:
          [buf, next] = await this.waitBuf(next, 1);
          this.path = new PanLPath(this.id, buf[0]);
          break;
        case Incoming.REPORT_UUID:
          [buf, next] = await this.waitBuf(next, 8);
          this.panlEvt.onReportUUID(this.path, buf);
          break;
        case Incoming.REPORT_DEVICE_CHANGE:
          await this.agentEvt.onDeviceChange(this.id);
          break;
        case Incoming.REPORT_PANL_STATUS:
          [buf, next] = await this.waitBuf(next, 1);
          await this.panlEvt.onStatus(this.path, buf[0]);
          break;
        case Incoming.GET_LOCAL_TIME:
          this.panlEvt.onGetTime(this.path);
          break;
        case Incoming.GET_TIMELINE: {
          [buf, next] = await this.waitBuf(next, StructTimeline.size);
          const tl = StructTimeline(buf);
          const req: ITimelineRequest = {
            id: {dayOffset: tl.offset, minutesOfDay: Math.abs(tl.time)},
            lookForward: tl.time >= 0,
            maxCount: tl.count,
          };
          await this.panlEvt.onGetTimeline(this.path, req);
          break;
        }
        case Incoming.GET_MEETING_BODY:
          this.getBody = true;
          break;
        case Incoming.GET_MEETING_INFO: {
          [buf, next] = await this.waitBuf(next, StructTime.size);
          const when = StructTime(buf);
          const point: ITimePoint = {
            dayOffset: when.dayOffset,
            minutesOfDay: when.minutesOfDay,
          };
          this.panlEvt.onGetMeetingInfo(this.path, point, this.getBody);
          this.getBody = false;
          break;
        }
        case Incoming.EXTEND_MEETING: {
          [buf, next] = await this.waitBuf(next, StructTimespan.size);
          const span = StructTimespan(buf);
          const point: ITimePoint = {
            dayOffset: span.dayOffset,
            minutesOfDay: span.minutesOfDay,
          };
          await this.panlEvt.onExtendMeeting(this.path, point, span.duration);
          break;
        }
        case Incoming.CREATE_BOOKING: {
          [buf, next] = await this.waitBuf(next, StructTimespan.size);
          const span = StructTimespan(buf);
          const point: ITimePoint = {
            dayOffset: span.dayOffset,
            minutesOfDay: span.minutesOfDay,
          };
          await this.panlEvt.onCreateBooking(this.path, point, span.duration);
          break;
        }
        case Incoming.CANCEL_MEETING: {
          [buf, next] = await this.waitBuf(next, StructTime.size);
          const when = StructTime(buf);
          const point: ITimePoint = {
            dayOffset: when.dayOffset,
            minutesOfDay: when.minutesOfDay,
          };
          await this.panlEvt.onCancelMeeting(this.path, point);
          break;
        }
        case Incoming.END_MEETING: {
          [buf, next] = await this.waitBuf(next, StructTime.size);
          const when = StructTime(buf);
          const point: ITimePoint = {
            dayOffset: when.dayOffset,
            minutesOfDay: when.minutesOfDay,
          };
          await this.panlEvt.onEndMeeting(this.path, point);
          break;
        }
        case Incoming.CANCEL_UNCLAIM_MEETING: {
          [buf, next] = await this.waitBuf(next, StructTime.size);
          const when = StructTime(buf);
          const point: ITimePoint = {
            dayOffset: when.dayOffset,
            minutesOfDay: when.minutesOfDay,
          };
          await this.panlEvt.onCancelUnclaimedMeeting(this.path, point);
          break;
        }
        case Incoming.CHECK_CLAIM_MEETING: {
          [buf, next] = await this.waitBuf(next, StructTime.size);
          const when = StructTime(buf);
          const point: ITimePoint = {
            dayOffset: when.dayOffset,
            minutesOfDay: when.minutesOfDay,
          };
          await this.panlEvt.onCheckClaimMeeting(this.path, point);
          break;
        }
        default:
          throw new Error("Unknown Incoming ID.");
      }
    }
  }

  private async getNextBuffer(): Promise<Buffer> {
    await new Promise<void>((resolve, reject) => {
      this.evt.on("rdy", resolve);
      this.evt.on("stop", () => reject("requested to stop"));
      if (this.stopped) {
        reject("requested to stop");
      }
      if (this.bufs.length !== 0) {
        resolve();
      }
    });
    const buf = this.bufs.shift();
    if (buf === undefined) {
      return this.getNextBuffer();
    }
    return buf;
  }

  private async waitBuf(buffer: Buffer, min: number):
  Promise<[Buffer, Buffer]> {
    while (buffer.length < min) {
      const next = await this.getNextBuffer() ;
      buffer = (buffer.length === 0) ? next : Buffer.concat([buffer, next]);
    }
    return [buffer.slice(0, min), buffer.slice(min)];
  }
}
