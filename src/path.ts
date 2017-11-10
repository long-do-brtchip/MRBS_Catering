import {MessageBuilder} from "./builder";

export class PanLPath {
  constructor(private agentID: number, private mstpAddress: number) {
  }

  get agent() {
    return this.agentID;
  }

  set agent(agent: number) {
    this.agentID = agent;
  }

  get dest() {
    return this.mstpAddress ;
  }

  set dest(dest: number) {
    this.mstpAddress  = dest;
  }

  get uid() {
    return (this.agentID << 4) + this.mstpAddress;
  }

  public setToBroadcast(): PanLPath {
    this.mstpAddress  = MessageBuilder.BROADCAST_ADDR;
    return this;
  }

  public toString = (): string => {
    return `PanL${this.agentID}-${this.mstpAddress}`;
  }
}
