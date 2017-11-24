import { BaseEntity, Column, CreateDateColumn,
    Entity, JoinColumn, OneToOne,
    PrimaryColumn, UpdateDateColumn } from "typeorm";
import { Employee } from "./employee";
// Name, creation time, update time, RFID code, Passcode, email id, employee id
@Entity()
export class PassCode extends BaseEntity {
   @PrimaryColumn("int")
   public passcode: number;

   @OneToOne((type) => Employee)
   @JoinColumn()
   public employee: Employee;
}
