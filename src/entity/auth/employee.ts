import {IsEmail} from "class-validator";
import {BaseEntity, Column, Entity, Index, JoinColumn, OneToMany, OneToOne,
  PrimaryColumn, PrimaryGeneratedColumn} from "typeorm";
import {Rfid} from "./rfid";

@Entity()
export class Employee extends BaseEntity {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({unique: true})
  @IsEmail()
  public email: string;

  @Column()
  public name: string;

  @OneToMany((type) => Rfid, (rfid) => rfid.employee)
  public rfids: Rfid[];

  public constructor(email: string) {
    super();
    this.email = email;
  }
}
