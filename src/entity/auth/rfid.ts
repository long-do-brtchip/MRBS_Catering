import { BaseEntity, Column, CreateDateColumn,
     Entity, JoinColumn, OneToOne,
     PrimaryColumn, UpdateDateColumn } from "typeorm";
import { Employee } from "./employee";
// Name, creation time, update time, RFID code, Passcode, email id, employee id
@Entity()
export class Rfid extends BaseEntity {
    @PrimaryColumn("blob")
    public rfidcode: Buffer;

    @OneToOne((type) => Employee)
    @JoinColumn()
    public employee: Employee;
}
