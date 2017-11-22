import {IsEmail} from "class-validator";
import {BaseEntity, Column, Entity,
        Index, PrimaryGeneratedColumn} from "typeorm";

@Entity()
export class Employee extends BaseEntity {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  public name: string;

  @Column()
  @IsEmail()
  public email: string;
}
