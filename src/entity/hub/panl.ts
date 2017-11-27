import {IsEmail} from "class-validator";
import {BaseEntity, Column, Entity, JoinColumn, ManyToOne,
  PrimaryGeneratedColumn} from "typeorm";
import {Room} from "./room";

@Entity()
export class Panl extends BaseEntity {
  public static async findRoom(uuid: string): Promise<Room | undefined> {
    const panl = await Panl.findOne({
      where: {uuid}, relations: ["room"],
    });
    return panl === undefined ? undefined : panl.room;
  }

  @PrimaryGeneratedColumn()
  public id: number;

  @Column("int8")
  public uuid: string;

  @ManyToOne((type) => Room, (room) => room.panls)
  public room: Room;
}
