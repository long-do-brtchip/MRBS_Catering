import * as assert from "assert";
import {MessageBuilder} from "./builder";
import {PanLPath} from "./path";
import {IAgentEvent, IPanLEvent} from "./service";
import {PanLSocketController} from "./socket";

export interface IMessageTransport {
  onGlobalBroadcast(bufs: Buffer[]): void;
  onSend(path: PanLPath, bufs: Buffer[]): void;
  onStop(): void;
}

interface IQueuedBuffer {
  bufs: Buffer[];
  path: PanLPath;
}

export class Transmit {
  public static getTotalLength(payloads: Buffer[]): number {
      let total = 0;

      for (const payload of payloads) {
          total += payload.length;
      }
      return total;
  }

  private static getBroadcastAddr(agent: number): PanLPath {
      return new PanLPath(agent, MessageBuilder.BROADCAST_ADDR);
  }

  private free: boolean;
  private tx: IMessageTransport;

  constructor(agentEvt: IAgentEvent, panlEvt: IPanLEvent) {
    if (agentEvt === undefined || panlEvt === undefined) {
      throw(new Error("Invalid parameter"));
    }
    try {
      this.tx = new PanLSocketController(0xF7D1, agentEvt, panlEvt);
    } catch (e) {
      throw(new Error(`Unable to start controller, exit now.` +
        ` Err: ${e.toString()}`));
    }
  }

  public async stop(): Promise<void> {
    this.tx.onStop();
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  public broadcastToAllImmediately(bufs: Buffer[]): void {
    /* Global broadcast should always been send out immediately */
    this.free = false;
    this.tx.onGlobalBroadcast(bufs);
  }

  public broadcastImmediately(agent: number, bufs: Buffer[]): void {
    this.free = false;
    this.tx.onSend(Transmit.getBroadcastAddr(agent), bufs);
  }

  public sendImmediately(path: PanLPath, bufs: Buffer[]): void {
    this.free = false;
    this.tx.onSend(path, bufs);
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
