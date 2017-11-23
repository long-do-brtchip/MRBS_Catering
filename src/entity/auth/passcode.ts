import { BaseEntity, Column, CreateDateColumn,
    Entity, JoinColumn, OneToOne,
    PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Employee } from "./employee";
// Name, creation time, update time, RFID code, Passcode, email id, employee id
@Entity()
export class PassCode extends BaseEntity {
   @PrimaryGeneratedColumn()
   public id: number;

   @CreateDateColumn()
   public createdDate: Date;

   @UpdateDateColumn()
   public updatedDate: Date;

   @Column("int")
   public passcode: number;

   @OneToOne((type) => Employee)
   @JoinColumn()
   public employeeid: Employee;
}
