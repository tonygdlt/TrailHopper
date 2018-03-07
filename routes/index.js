var express = require('express');
var router = express.Router();

//GET home page
router.get('/', function(req, res, next){
	var dataToSend = { loc: [] }
	var latlng = [{lat: 32.7157, lng: -117.1611}];
	dataToSend.loc.push({latlng});
	res.render('index', dataToSend);
});

function homeCtrl(req, res){
	var context = req.dataToSend;
	res.render('index', dataToSend);
}

module.exports = router;