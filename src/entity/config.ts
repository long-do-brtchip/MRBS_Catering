import {BaseEntity, Column, Entity, PrimaryColumn} from "typeorm";

export enum ConfigType {
  CALENDER_CONFIG,
  HUB_CONFIG,
  PANL_CONFIG,
}

@Entity()
export class Config extends BaseEntity {
  @PrimaryColumn("int")
  public id: ConfigType;

  @Column()
  public val: string;
}
