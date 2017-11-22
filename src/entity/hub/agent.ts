import {BaseEntity, Column, Entity, PrimaryGeneratedColumn} from "typeorm";

@Entity()
export class Agent extends BaseEntity {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column("int8")
  public uid: string;
}
