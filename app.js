const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('winston');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

var log, util, webSocketServer, clientSocket;


const index = require(path.join(__dirname, 'routes', 'index'));
const users = require(path.join(__dirname, 'routes', 'users'));
const ris = require(path.join(__dirname, 'routes', 'ris'));

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
app.use('/ris', ris);

app.post('/proxy', (req, res) => {
	let rqParams = req.body;
	util.proxyRequest(rqParams).then((proxyRes)=>{
		log.info('proxyRes=>'+ JSON.stringify(proxyRes));
		res.json(proxyRes);
	})
});

/*
const wsUsername = 'orthanc';
const myHospitalId = 2;
const clientConnectUrl = 'wss://radconnext.info/' + wsUsername + '/' + myHospitalId + '?type=local';
*/

module.exports = (httpserver, monitor) => {
	log = monitor;
	webSocketServer = require('./websocket.js')(httpserver, monitor);
	const clientConnectUrl = 'wss://radconnext.info/' + process.env.LOCAL_NAME + '/' + process.env.LOCAL_HOS_ID + '?type=local';
	clientSocket = require('./websocket-client.js')(clientConnectUrl, monitor);
	util = clientSocket = require('./lib/utility.js')( monitor);
	let upload = require(path.join(__dirname, 'routes', 'uploader.js')) (app, webSocketServer, clientSocket);

	return app;
}
