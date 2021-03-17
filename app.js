const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('winston');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

var log, util, webSocketServer, clientSocket;


const index = require(path.join(__dirname, 'routes', 'index'));
const users = require(path.join(__dirname, 'routes', 'users'));

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(express.json({limit: '3000mb', extended: true, parameterLimit: 50000}));
app.use(bodyParser.urlencoded({ limit: '3000mb', extended: true, parameterLimit: 50000 }));

app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', index);
app.use('/users', users);

app.post('/proxy', (req, res) => {
	let rqParams = req.body;
	log.info('rqParams=>'+ JSON.stringify(rqParams));
	util.proxyRequest(rqParams).then((proxyRes)=>{
		log.info('proxyRes=>'+ JSON.stringify(proxyRes));
		res.json({status:{code: 200}});
	})
});

const wsUsername = 'orthanc';
const myHospitalId = 1;
const clientConnectUrl = 'wss://radconnext.info/' + wsUsername + '/' + myHospitalId + '?type=local';

module.exports = (httpserver, monitor) => {
	log = monitor;
	webSocketServer = require('./websocket.js')(httpserver, monitor);
	clientSocket = require('./websocket-client.js')(clientConnectUrl, monitor);
	util = clientSocket = require('./lib/utility.js')( monitor);
	let upload = require(path.join(__dirname, 'routes', 'uploader.js')) (app, webSocketServer, clientSocket);

	return app;
}
