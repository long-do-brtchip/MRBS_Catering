var express = require('express');
var app = express();
var fs = require("fs");
var bodyParser = require('body-parser')
var jsonParser = bodyParser.json()

var equipmentTypeList =  [ { EquipmentType: 0, EquipmentName: 'TV' }, 
						   { EquipmentType: 1, EquipmentName: 'Projector' },
						   { EquipmentType: 2, EquipmentName: 'Laptops' },
						 ]

var equipmentItems =  [ { EquipmentType: 0, EquipmentItemName: 'Samsung 32 inch' }, 
						{ EquipmentType: 0, EquipmentItemName: 'Samsung 48 inch' },
						{ EquipmentType: 0, EquipmentItemName: 'LG 32 inch' },
						{ EquipmentType: 0, EquipmentItemName: 'LG 48 inch' },
						{ EquipmentType: 0, EquipmentItemName: 'LG 65 inch' },
						{ EquipmentType: 0, EquipmentItemName: 'Sony 32 inch' },
						{ EquipmentType: 0, EquipmentItemName: 'Sony 49 inch' },
						{ EquipmentType: 0, EquipmentItemName: 'Sony 65 inch' },
						
						{ EquipmentType: 1, EquipmentItemName: 'EPSON EB 1930' }, 
						{ EquipmentType: 1, EquipmentItemName: 'SONY VPL-EX230' },
						{ EquipmentType: 1, EquipmentItemName: 'SONY VPL-DX147' },
						{ EquipmentType: 1, EquipmentItemName: 'SONY VPL-EX295' },
						{ EquipmentType: 1, EquipmentItemName: 'PANASONIC PT-LB300' },
						{ EquipmentType: 1, EquipmentItemName: 'PANASONIC PT-LB280' },
						
						{ EquipmentType: 2, EquipmentItemName: 'DELL N3567' }, 
						{ EquipmentType: 2, EquipmentItemName: 'DELL N3467' },
						{ EquipmentType: 2, EquipmentItemName: 'DELL VOSTRO V5568F' },
						{ EquipmentType: 2, EquipmentItemName: 'ASUS VIVOBOOK E402NA' },
						{ EquipmentType: 2, EquipmentItemName: 'HP 15-BS554TU' },
						{ EquipmentType: 2, EquipmentItemName: 'HP PROBOOK 450 G5' },
					  ]
	
app.get('/api/Equipments', function (req, res) {
	var json = JSON.stringify(equipmentTypeList);
	console.log( json  );
	res.end( json );
})

app.post('/api/Equipments', jsonParser, function (req, res) {
	console.log( req.body  );
	res.end("OK");
})

app.get('/api/EquipmentItems', function (req, res) {
	var json = JSON.stringify(equipmentItems);
	console.log( json  );
	res.end( json );
})

app.post('/api/EquipmentItems', jsonParser, function (req, res) {
	console.log( req.body  );
	res.end("OK");
})

var server = app.listen(8081, function () {

  var host = server.address().address
  var port = server.address().port

  console.log("Example app listening at http://%s:%s", host, port)
})