import bodyParser = require("body-parser");
import express = require("express");
import "reflect-metadata";
import {Auth} from "./auth";
import {Employee} from "./entity/auth/employee";
import {Rfid} from "./entity/auth/rfid";
import {log} from "./log";

export const rfidapi = express.Router();
const jsonParser = bodyParser.json();

rfidapi.route("/employee/:id").get(async (req, res) => {
    try {
        log.debug("rfidapi");
        const varEmployee = await Employee.findOne(
            {where: {id: req.params.id}}) as Employee;
        if (varEmployee !== undefined) {
            res.json(varEmployee);
            res.end();
        } else {
            res.end("Employee does not exist!");
        }
    } catch (err) {
        log.error("Ops!:", err);
    }
});

rfidapi.route("/rfid/:id").get(async (req, res) => {
    try {
        log.debug("rfidapi");
        const varRfid = await Rfid.findOne(
            {where: {id: req.params.id}}) as Rfid;
        if (varRfid !== undefined) {
            res.json(varRfid);
            res.end();
        } else {
            res.end("RFID does not exist!");
        }
    } catch (err) {
        log.error("Ops!:", err);
    }
});

rfidapi.route("/add/employee/:name/:email").post(async (req, res) => {
    log.debug("rfidapi " + 29);
    const varEmployee = await Employee.findOne(
        {where: {name: req.params.name}}) as Employee;
    if (varEmployee === undefined) {
        Auth.addEmployee(req.params.name, req.params.email)
        .then((data) => {
            res.end("Add employee succesfully, id = " + data);
        });
    } else {
        res.end("Employee existed !");
    }
});

rfidapi.route("/add/rfid/:rfidcode").post(async (req, res) => {
    log.debug("rfidapi " + 43);
    const varRfid = await Rfid.findOne(
        {where: {id: req.params.rfidcode}}) as Rfid;
    log.debug("rfidapi " + 46);
    res.end();
    if (varRfid === undefined) {
        log.debug("rfidapi " + 48);
        Auth.addRfid(req.params.rfidcode)
        .then((data) => {
            res.end("Add employee succesfully, id = " + data);
        });
    } else {
        res.end("Employee existed !");
    }
});

rfidapi.route("/link/rfid/:empId/:rfidId").post(async (req, res) => {
    const varRfid = await Rfid.findOne(
        {where: {id: req.params.rfidId}}) as Rfid;
    const varEmployee = await Employee.findOne(
        {where: {id: req.params.empId}}) as Employee;
    if ((varEmployee !== undefined) && (varRfid !== undefined)) {
        Auth.linkRFIDtoEmployee(req.params.empId, req.params.rfidId)
        .then((data) => {
            res.end("Linkd RFID to Employee success!");
        });
    } else if (varEmployee === undefined) {
        res.end("Employee Id does not exist !");
    } else if (varRfid === undefined) {
        res.end("RFID Id does not exist !");
    } else {
        res.end();
    }
});

rfidapi.route("/remove/employee/:id").post(async (req, res) => {
    const varEmployee = await Employee.findOne(
        {where: {id: req.params.id}}) as Employee;
    if (varEmployee !== undefined) {
        varEmployee.remove();
        res.end("Remove success!");
    } else {
        res.end("Employee does not exist!");
    }
});

rfidapi.route("/remove/rfid/:id").post(async (req, res) => {
    const varRfid = await Rfid.findOne(
        {where: {id: req.params.id}}) as Rfid;
    if (varRfid !== undefined) {
        varRfid.remove();
        res.end("Remove success!");
    } else {
        res.end("Employee does not exist!");
    }
});
