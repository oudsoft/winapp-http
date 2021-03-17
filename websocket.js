/* websocket.js */

function RadconWebSocketServer (arg, log) {
	const $this = this;
	this.httpsServer = arg;
	const WebSocketServer = require('ws').Server;
	const wss = new WebSocketServer({server: this.httpsServer/*, path: '/' + roomname */});
	this.clients = [];
	this.socket = wss;

	wss.on('connection', async function (ws, req) {
		$this.clients.push(ws);
		log.info(ws._socket.remoteAddress);
		log.info(ws._socket._peername);
		log.info(req.connection.remoteAddress);
		log.info(`WS Conn Url : ${req.url} Connected.`);
		let fullReqPaths = req.url.split('?');
		let wssPath = fullReqPaths[0];
		log.info(wssPath);
		//wssPath = wssPath.substring(1);
		wssPath = wssPath.split('/');
		log.info(wssPath);
		ws.id = wssPath[2];
		ws.send(JSON.stringify({type: 'test', message: ws.id + ', You have Connected local websocket success.'}));

		ws.on('message', function (message) {
			var data;

			//accepting only JSON messages
			try {
				data = JSON.parse(message);
			} catch (e) {
				log.info("Invalid JSON");
				data = {};
			}

			log.info('data in=> '+JSON.stringify(data));

			let command;
			if (data.type) {
				switch (data.type) { 
					case "trigger": 
						/*
						let command = 'curl -X POST --user demo:demo http://localhost:8042/tools/execute-script -d "doLocalStore(\'' + data.dcmname + '\')"';
						$this.runCommand(command).then((result) => {
							ws.send(JSON.stringify({type: 'result', message: result}));
						});
						*/
						command = 'curl -k https://' + data.hostname + '/img/usr/pdf/' + data.dcmname + ' -o C:\\RadConnext\\tmp\\' + data.dcmname;
						log.info('Start Download Dicom with command=> ' + command);
						$this.runCommand(command).then((result) => {
							log.info('Download Result=> ' + result);
							ws.send(JSON.stringify({type: 'result', message: result}))
							command = 'storescu localhost 4242 C:\\RadConnext\\tmp\\'  +  data.dcmname + ' -v';   
							log.info('Start Store Dicom with command=> ' + command);
							$this.runCommand(command).then((result2) => {

								command = 'curl -X POST --user demo:demo http://localhost:8042/modalities/Localhost/move -d "{""Level"" : ""Study"", ""Resources"" : [{""StudyInstanceUID"": ""' + data.StudyInstanceUID + '""}], ""TargetAet"": ""ORTHANCPACS""}"';
								log.info('Start Transfer dicom to Pacs with command=> ' + command);
								$this.runCommand(command).then((result3) => {
									log.info('Transer dicom to Pacs Result=> ' + result3);
									let moveResult = JSON.parse(result3);
									ws.send(JSON.stringify({type: 'move', data: {type: 'cmoveresult', data: moveResult, owner: data.owner, StudyInstanceUID: data.StudyInstanceUID}}));
								}).catch((err3) => {
									log.error('Transfer dicom Error=> ' + JSON.stringify(err3));
								});
							}).catch((err2) => {
								log.error('Store Dicom Error=> ' + JSON.stringify(err2));
							});
						});
					break;
					case "exec": 
						let queryStr;
						if (data.data.key === 'PatientName'){
							 queryStr = '"{""Level"": ""Patient"", ""Expand"": true, ""Query"":{""PatientName"": ""' + data.data.value + '""}}"';
						} else if (data.data.key === 'PatientHN'){
							queryStr = '"{""Level"": ""Study"", ""Expand"": true, ""Query"":{""PatientID"": ""' + data.data.value + '""}}"';
						}
						command = 'curl -X POST --user demo:demo  -H "Content-Type: application/json" http://localhost:8042/modalities/Pacs/query -d ' + queryStr;
						log.info('Start C-Find with command=> ' + command);
						$this.runCommand(command).then((result1) => {
							log.info('Find Result=> ' + result1);
							let findResult = JSON.parse(result1);
							command = 'curl -X GET --user demo:demo http://localhost:8042' + findResult.Path + '/answers';
							log.info('Start Check find-answer with command=> ' + command);
							$this.runCommand(command).then((result2) => {
								let answerResult = JSON.parse(result2);
								if (answerResult.length > 0){
									command += '/0/content';
									log.info('Start Get Result with command=> ' + command);
									$this.runCommand(command).then((result3) => {
										let contentResult = JSON.parse(result3);
										log.info('Content Result=> ' + JSON.stringify(contentResult));
										ws.send(JSON.stringify({type: 'exec', data: {type: 'cfindresult', data: contentResult, owner: data.data.owner, hospitalId: data.data.hospitalId, queryPath: findResult.Path}}));
									});
								} else {
									ws.send(JSON.stringify({type: 'exec', data: {type: 'cfindresult', data: {}, owner: data.data.owner, hospitalId: data.data.hospitalId}}));
								}
							});
						}).catch((err) => {
							log.error('Store Dicom Error=> ' + JSON.stringify(err));
						});
					break;
					case "move":
						//command = 'curl -X POST --user demo:demo http://localhost:8042/modalities/Pacs/move -d "{""Level"" : ""Study"", ""Resources"" : [{""StudyInstanceUID"": ""' + data.data.StudyInstanceUID + '""}], ""Timeout"": 60}"';
						command = 'curl -X POST --user demo:demo http://localhost:8042' + data.data.queryPath + '/retrieve -d "{""TargetAet"": ""ORTHANC"", ""Synchronous"": false}"';
						log.info('Start C-Move with command=> ' + command);
						$this.runCommand(command).then((result1) => {
							log.info('Move Result=> ' + result1);
							let moveResult = JSON.parse(result1);
							command = 'curl --user demo:demo http://localhost:8042' + moveResult.Path;
							log.info('Get Job Move Result with command=> ' + command);
							$this.runCommand(command).then((result2) => {
								log.info('Job Move Result=> ' + result2);
								moveResult = JSON.parse(result2);
								ws.send(JSON.stringify({type: 'move', data: {type: 'cmoveresult', data: moveResult, owner: data.data.owner, PatientID: data.data.patientID, hospitalId: data.data.hospitalId}}));
							});
						}).catch((err) => {
							log.error('C-Move Dicom Error=> ' + JSON.stringify(err));
						});
					break;
					case "run":
						command =data.data.command;
						log.info('Start Run Exec your command=> ' + command);
						$this.runCommand(command).then((result) => {
							log.info('Run Exec your Result=> ' + result);
							let runResult = JSON.parse(result);
							ws.send(JSON.stringify({type: 'move', data: {type: 'runresult', data: runResult, owner: data.data.owner}}));
						}).catch((err) => {
							log.error('You have Exec Error=> ' + JSON.stringify(err));
						});
					break;
					case "notify": 
						ws.send(JSON.stringify({type: 'notify', message: data.notify}));
					break;
				}
			} else {
				ws.send(JSON.stringify({type: 'error', message: 'You command invalid type.'}));
			}
		});

		ws.isAlive = true;

		ws.on('pong', () => {
			//log.info(ws.id + ' => On Pong');
			ws.isAlive = true;
		});

		ws.on('close', function(ws, req) {
			log.info(`WS Conn Url : ${req.url} Close.`);
		});

	});

	setInterval(() => {
		wss.clients.forEach((ws) => {
			if (!ws.isAlive) return ws.terminate();
			//ws.isAlive = false;
			//log.info(ws.id + ' => Start Ping');
			ws.ping(null, false, true);
		});
	}, 85000);

	this.runCommand = function (command) {
		return new Promise(function(resolve, reject) {
			const exec = require('child_process').exec;
			exec(command, (error, stdout, stderr) => {
				if(error === null) {
					resolve(`${stdout}`);
				} else {
					reject(`${stderr}`);
				}
	    });
		});
	}

}

module.exports = ( arg, monitor ) => {
	const webSocketServer = new RadconWebSocketServer(arg, monitor);
	return webSocketServer;
}
