import { BaseEntity, Column, CreateDateColumn,
<<<<<<< HEAD
     Entity, ManyToOne,
     PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
=======
     Entity, JoinColumn, OneToOne,
     PrimaryColumn, UpdateDateColumn } from "typeorm";
>>>>>>> changes based on Li Yin's comment
import { Employee } from "./employee";
// Name, creation time, update time, RFID code, Passcode, email id, employee id
@Entity()
export class Rfid extends BaseEntity {
<<<<<<< HEAD
    @PrimaryGeneratedColumn()
    public id: number;

    @Column("blob")
    public rfidcode: Buffer;

    @ManyToOne((type) => Employee, (employee) => employee.rfid,
        { onDelete: "CASCADE" },
    )
=======
    @PrimaryColumn("blob")
    public rfidcode: Buffer;

    @OneToOne((type) => Employee)
    @JoinColumn()
>>>>>>> changes based on Li Yin's comment
    public employee: Employee;
}
