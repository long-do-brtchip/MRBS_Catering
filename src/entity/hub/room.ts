import {IsEmail} from "class-validator";
import {BaseEntity, Column, Entity, OneToMany,
  PrimaryGeneratedColumn} from "typeorm";
import {Panl} from "./panl";

@Entity()
export class Room extends BaseEntity {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({unique: true})
  @IsEmail()
  public address: string;

  @Column()
  public name: string;

  @OneToMany((type) => Panl, (panl) => panl.room)
  public panls: Panl[];

  constructor(address: string, name: string) {
    super();
    this.address = address;
    this.name = name;
  }
}
