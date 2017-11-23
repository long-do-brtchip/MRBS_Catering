import {IsEmail} from "class-validator";
import {BaseEntity, Column, Entity,
        Index, PrimaryColumn} from "typeorm";

@Entity()
export class Employee extends BaseEntity {
  @PrimaryColumn()
  @IsEmail()
  public email: string;

  @Column()
  public name: string;
}
