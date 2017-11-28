import {IsEmail} from "class-validator";
import {BaseEntity, Column, Entity, OneToMany,
        PrimaryGeneratedColumn} from "typeorm";
import {Rfid} from "./rfid";

@Entity()
export class Employee extends BaseEntity {
  @PrimaryColumn()
  @IsEmail()
  public email: string;

  @Column()
  public name: string;

  @Column()
  @IsEmail()
  public email: string;

  @OneToMany((type) => Rfid, (rfid) => rfid.employee)
  public rfid: Rfid[];
}
