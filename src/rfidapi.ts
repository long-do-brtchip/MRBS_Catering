import bodyParser = require("body-parser");
import express = require("express");
import "reflect-metadata";
import {Auth} from "./auth";
import {Employee} from "./entity/auth/employee";
import {Rfid} from "./entity/auth/rfid";
import {log} from "./log";

export const authapi = express.Router();
const jsonParser = bodyParser.json();

authapi.route("/employee/:id").get(async (req, res) => {
    try {
        log.debug("authapi");
        const employee = await Employee.findOne(
            {where: {id: req.params.id}}) as Employee;
        if (employee !== undefined) {
            res.json(employee);
            res.sendStatus(200);
        } else {
            res.sendStatus(404);
        }
    } catch (err) {
        log.error("Ops!:", err);
    }
});

authapi.route("/rfid/:id").get(async (req, res) => {
    try {
        log.silly("authapi");
        const rfid = await Rfid.findOne(
            {where: {id: req.params.id}}) as Rfid;
        if (rfid !== undefined) {
            res.json(rfid);
            res.sendStatus(200);
        } else {
            res.sendStatus(404);
        }
    } catch (err) {
        log.error("Ops!:", err);
    }
});

authapi.route("/employee/:name/:email").post(async (req, res) => {
    const employee = await Employee.findOne(
        {where: {name: req.params.name}}) as Employee;
    if (employee === undefined) {
        Auth.addEmployee(req.params.name, req.params.email)
        .then((data) => {
            res.status(201).send("Add employee succesfully, id = " + data);
        });
    } else {
        res.Status(412).send("Employee existed!");
    }
});

authapi.route("/rfid/:rfidcode").post(async (req, res) => {
    const rfid = await Rfid.findOne(
        {where: {id: req.params.rfidcode}}) as Rfid;
    if (rfid === undefined) {
        Auth.addRfid(req.params.rfidcode)
        .then((data) => {
            res.status(201).send("Add rfid succesfully");
        });
    } else {
        res.Status(412).send("Employee existed");
    }
});

authapi.route("/link/rfid/:empId/:rfidId").post(async (req, res) => {
    const rfid = await Rfid.findOne(
        {where: {id: req.params.rfidId}}) as Rfid;
    const employee = await Employee.findOne(
        {where: {id: req.params.empId}}) as Employee;
    if ((employee !== undefined) && (rfid !== undefined)) {
        Auth.linkRFIDtoEmployee(req.params.empId, req.params.rfidId)
        .then((data) => {
            res.status(202).send("Linkd RFID to Employee success!");
        });
    } else if (employee === undefined) {
        res.status(404).send("Employee Id does not exist !");
    } else if (rfid === undefined) {
        res.status(404).send("RFID Id does not exist !");
    } else {
        res.sendStatus(404);
    }
});

authapi.route("/employee/:id").delete(async (req, res) => {
    const employee = await Employee.findOne(
        {where: {id: req.params.id}}) as Employee;
    if (employee !== undefined) {
        employee.remove();
        res.sendStatus(201);
    } else {
        res.status(404).send("Employee does not exist!");
    }
});

authapi.route("/rfid/:rfidcode").delete(async (req, res) => {
    const rfid = await Rfid.findOne(
        {where: {id: req.params.rfidcode}}) as Rfid;
    if (rfid !== undefined) {
        rfid.remove();
        res.sendStatus(201);
    } else {
        res.status(404).send("Rfid does not exist!");
    }
});
