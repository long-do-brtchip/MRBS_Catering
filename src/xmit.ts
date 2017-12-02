import * as assert from "assert";
import {MessageBuilder} from "./builder";
import {IMessageTransport} from "./interface";
import {PanLPath} from "./path";

interface IQueuedBuffer {
  bufs: Buffer[];
  path: PanLPath;
}

export class Transmit {
  private static getBroadcastAddr(agent: number): PanLPath {
      return new PanLPath(agent, MessageBuilder.BROADCAST_ADDR);
  }

  private free: boolean;
  constructor(private transport: IMessageTransport) {
  }

  public broadcastToAllImmediately(bufs: Buffer[]): void {
    /* Global broadcast should always been send out immediately */
    this.free = false;
    this.transport.onGlobalBroadcast(bufs);
  }

  public broadcastImmediately(agent: number, bufs: Buffer[]): void {
    this.free = false;
    this.transport.onSend(Transmit.getBroadcastAddr(agent), bufs);
  }

  public sendImmediately(path: PanLPath, bufs: Buffer[]): void {
    this.free = false;
    this.transport.onSend(path, bufs);
  }

  public broadcast(agent: number, bufs: Buffer[]): void {
    this.send(Transmit.getBroadcastAddr(agent), bufs);
  }

  public send(path: PanLPath, bufs: Buffer[]): void {
    if (!this.free) {
      this.queueUpBuffer(path, bufs);
      return;
    }
    this.free = false;
    this.sendImmediately(path, bufs);
  }

  public onDrain(agent: number): void {
    const q = this.getBufferToSend(agent);

    assert(this.free === false);
    if (q === undefined) {
      this.free = true;
      return;
    }
    this.sendImmediately(q.path, q.bufs);
  }

  private queueUpBuffer(path: PanLPath, bufs: Buffer[]) {
    // TODO: Update total length and queue up
    this.sendImmediately(path, bufs);
  }

  private getBufferToSend(agent: number): IQueuedBuffer | undefined {
    // TODO: based on weight of total length in a agent
    return undefined;
  }
}
