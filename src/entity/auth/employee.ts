import {IsEmail} from "class-validator";
<<<<<<< HEAD
import {BaseEntity, Column, Entity,
        Index, PrimaryColumn} from "typeorm";
=======
import {BaseEntity, Column, Entity, OneToMany,
        PrimaryGeneratedColumn} from "typeorm";
import {Rfid} from "./rfid";
>>>>>>> - change name file rfidapi.ts to authapi.ts

@Entity()
export class Employee extends BaseEntity {
  @PrimaryColumn()
  @IsEmail()
  public email: string;

  @Column()
  public name: string;
<<<<<<< HEAD
=======

  @Column()
  @IsEmail()
  public email: string;

  @OneToMany((type) => Rfid, (rfid) => rfid.employee)
  public rfid: Rfid[];
>>>>>>> - change name file rfidapi.ts to authapi.ts
}
