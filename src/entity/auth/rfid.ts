import { BaseEntity, Column, CreateDateColumn,
     Entity, JoinColumn, OneToOne,
     PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Employee } from "./employee";
// Name, creation time, update time, RFID code, Passcode, email id, employee id
@Entity()
export class Rfid extends BaseEntity {
    @PrimaryGeneratedColumn()
    public id: number;

    @CreateDateColumn()
    public createdDate: Date;

    @UpdateDateColumn()
    public updatedDate: Date;

    @Column("blob")
    public rfidcode: Buffer;

    @OneToOne((type) => Employee)
    @JoinColumn()
    public employeeid: Employee;
}
