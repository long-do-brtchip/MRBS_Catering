import { BaseEntity, Column, CreateDateColumn,
     Entity, ManyToOne,
     PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Employee } from "./employee";
// Name, creation time, update time, RFID code, Passcode, email id, employee id
@Entity()
export class Rfid extends BaseEntity {
    @PrimaryGeneratedColumn()
    public id: number;

    @Column("blob")
    public rfidcode: Buffer;

    @ManyToOne((type) => Employee, (employee) => employee.rfid,
        { onDelete: "CASCADE" },
    )
    public employee: Employee;
}
