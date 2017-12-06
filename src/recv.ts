import moment = require("moment");
import ref = require("ref");
import ArrayType = require("ref-array");
import StructType = require("ref-struct");
import {ITimelineRequest} from "./calendar";
import {IAgentEvent, IPanLEvent} from "./interface";
import {log} from "./log";
import {PanLPath} from "./path";

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

const StructTimepoint = StructType({
  dayOffset: ref.types.int8,
  minutesOfDay: ref.types.uint16,
}, {packed: true});

const StructTimeline = StructType({
  point: StructTimepoint,
  count: ref.types.uint8,
}, {packed: true});

const StructTimespan = StructType({
  point: StructTimepoint,
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

  private static getEpochTime(buf: Buffer): number {
    const when = StructTimepoint(buf);
    const now = moment();
    const panlAtPM = (when.minutesOfDay & (1 << 11)) !== 0;
    const hubAtPM = Number(now.format("HH")) >= 12;
    let offset = when.dayOffset;

    if (panlAtPM !== hubAtPM) {
      if (hubAtPM) {
        offset++;
      } else {
        offset--;
      }
    }
    when.minutesOfDay &= (1 << 11) - 1;
    if (when.minutesOfDay >= 60 * 24) {
      throw(new Error("Wrong minutesOfDay received: " + when.minutesOfDay));
    }
    return now.startOf("day").add(offset, "days").set({
      hour: when.minutesOfDay / 60,
      minute: when.minutesOfDay % 60,
      second: 0,
      millisecond: 0,
    }).valueOf();
  }

  private stopping = false;
  private path: PanLPath;
  private getBody = false;
  private bufs: Buffer[] = [];
  private resolve: () => void;

  constructor(private agentEvt: IAgentEvent, private panlEvt: IPanLEvent,
              public id: number) {
    this.agentEvt.onAgentConnected(id);
  }

  public onData(buffer: Buffer): void {
    this.bufs.push(buffer);
    this.kickWaitingTask();
  }

  public stop() {
    this.stopping = true;
    this.kickWaitingTask();
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
          this.panlEvt.onRequestFirmware(this.path);
          break;
        case Incoming.AUTH_BY_PASSCODE:
          [buf, next] = await this.waitBuf(next, StructAuthByPasscode.size);
          // Justify for await: next action requires the authentication result
          await this.panlEvt.onPasscode(this.path,
            StructAuthByPasscode(buf).passcode);
          break;
        case Incoming.AUTH_BY_RFID:
          [buf, next] = await this.waitBuf(next, StructAuthByRFID.size);
          // Justify for await: next action requires the authentication result
          await this.panlEvt.onRFID(this.path, buf);
        case Incoming.SET_ADDRESS:
          [buf, next] = await this.waitBuf(next, 1);
          this.path = new PanLPath(this.id, buf[0]);
          if (buf[0] === 255) {
            throw(new Error("Invalid SET_ADDRESS 255"));
          }
          break;
        case Incoming.REPORT_UUID:
          [buf, next] = await this.waitBuf(next, 8);
          this.panlEvt.onReportUUID(this.path, buf);
          break;
        case Incoming.REPORT_DEVICE_CHANGE:
          // Justify for await: room, panl information will be purged from cache
          await this.agentEvt.onDeviceChange(this.id);
          break;
        case Incoming.REPORT_PANL_STATUS:
          [buf, next] = await this.waitBuf(next, 1);
          this.panlEvt.onStatus(this.path, buf[0]);
          break;
        case Incoming.GET_LOCAL_TIME:
          this.panlEvt.onGetTime(this.path);
          break;
        case Incoming.GET_TIMELINE: {
          [buf, next] = await this.waitBuf(next, StructTimeline.size);
          const tl = StructTimeline(buf);
          const lookForward = tl.point.minutesOfDay >= 0;
          const req: ITimelineRequest = {
            id: MessageParser.getEpochTime(tl.point),
            lookForward,
            maxCount: tl.count,
          };
          // Justify for await: next GET_MEETING_INFO requires cached data
          await this.panlEvt.onGetTimeline(this.path, req);
          break;
        }
        case Incoming.GET_MEETING_BODY:
          this.getBody = true;
          break;
        case Incoming.GET_MEETING_INFO: {
          [buf, next] = await this.waitBuf(next, StructTimepoint.size);
          this.panlEvt.onGetMeetingInfo(this.path,
            MessageParser.getEpochTime(buf), this.getBody);
          this.getBody = false;
          break;
        }
        case Incoming.EXTEND_MEETING: {
          [buf, next] = await this.waitBuf(next, StructTimespan.size);
          const span = StructTimespan(buf);
          const start = MessageParser.getEpochTime(span.point);
          const end = start + span.duration * 60 * 1000;
          this.panlEvt.onExtendMeeting(this.path, {start, end});
          break;
        }
        case Incoming.CREATE_BOOKING: {
          [buf, next] = await this.waitBuf(next, StructTimespan.size);
          const span = StructTimespan(buf);
          const start = MessageParser.getEpochTime(span.point);
          const end = start + span.duration * 60 * 1000;
          this.panlEvt.onCreateBooking(this.path, {start, end});
          break;
        }
        case Incoming.CANCEL_MEETING: {
          [buf, next] = await this.waitBuf(next, StructTimepoint.size);
          this.panlEvt.onCancelMeeting(this.path,
            MessageParser.getEpochTime(buf));
          break;
        }
        case Incoming.END_MEETING: {
          [buf, next] = await this.waitBuf(next, StructTimepoint.size);
          this.panlEvt.onEndMeeting(this.path,
            MessageParser.getEpochTime(buf));
          break;
        }
        case Incoming.CANCEL_UNCLAIM_MEETING: {
          [buf, next] = await this.waitBuf(next, StructTimepoint.size);
          this.panlEvt.onCancelUnclaimedMeeting(this.path,
            MessageParser.getEpochTime(buf));
          break;
        }
        case Incoming.CHECK_CLAIM_MEETING: {
          [buf, next] = await this.waitBuf(next, StructTimepoint.size);
          this.panlEvt.onCheckClaimMeeting(this.path,
            MessageParser.getEpochTime(buf));
          break;
        }
        default:
          throw new Error("Unknown Incoming ID.");
      }
    }
  }

  private async getNextBuffer(): Promise<Buffer> {
    if (!this.bufs.length) {
      await new Promise<void>((resolve, reject) => {
        this.resolve = resolve;
      });
    }
    if (this.stopping) {
      throw(new Error("requested to stop"));
    }
    const buf = this.bufs.shift();
    if (buf) {
      return buf;
    }
    throw(new Error("!!!FIX ME!!! MessageParser is in wrong state"));
  }

  private kickWaitingTask() {
    if (this.resolve) {
      this.resolve();
      delete this.resolve;
    }
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
