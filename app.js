var express = require('express');
var app = express();

app.use(express.static(__dirname + '/public'));

var ipaddress = process.env.NODEJS_IP || '192.168.101.85';
var port = process.env.NODEJS_PORT || 3000;
app.listen(port, ipaddress);
console.log('NASCO-monitor is on ' + ipaddress + ':' + port);