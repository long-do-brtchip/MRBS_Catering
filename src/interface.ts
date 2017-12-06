import {ITimelineEntry, ITimelineRequest} from "./calendar";
import {PanLPath} from "./path";

export interface IAgentEvent {
  onAgentConnected(agent: number): Promise<void>;
  onAgentEnd(agent: number): Promise<void>;
  onAgentError(agent: number, err: Error): Promise<void>;
  onTxDrain(agent: number): Promise<void>;
  onDeviceChange(id: number): Promise<void>;
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

export interface ICalendarManagerEvent {
  onCalMgrReady(): Promise<void>;
  onCalMgrError(err: Error): Promise<void>;
}

export interface ICalendarEvent<T> {
  onAdd(to: T, entry: ITimelineEntry): Promise<void>;
  onDelete(to: T, id: number): Promise<void>;
  onMeetingUpdate(to: T, id: number): Promise<void>;
  onEndTimeChange(to: T, entry: ITimelineEntry): Promise<void>;
}

export interface IMessageTransport {
  start(agentEvt: IAgentEvent, panlEvt: IPanLEvent): Promise<void>;
  stop(): Promise<void>;
  onGlobalBroadcast(bufs: Buffer[]): void;
  onSend(path: PanLPath, bufs: Buffer[]): void;
}
