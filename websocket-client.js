/*websocket-client.js */
/*
	รอการสั่งงานจาก Server
*/

function RadconWebSocketClient (arg, log) {
	const $this = this;
	this.connectUrl = arg;

	const exec = require('child_process').exec;
	const webSocketClient = require('websocket').client;

	const client = new webSocketClient();

	client.on('connectFailed', function(error) {
		console.log('Connect Error: ' + error.toString());
	});

	client.on('connect', function(connection) {
		console.log('WebSocket Client Connected');
		connection.on('error', function(error) {
			log.error("Connection Error: " + error.toString());
		});
		connection.on('close', function() {
			log.info('echo-protocol Connection Closed');
			setTimeout(()=>{
				client.connect($this.connectUrl, 're-connect');
			}, 10000)
		});
		connection.on('message', async function(message) {
			if (message.type === 'utf8') {
				var data;
				try {
					data = JSON.parse(message.utf8Data);
				} catch (e) {
					log.error("Invalid JSON");
					data = {};
				}

				log.info('data in=> '+JSON.stringify(data));

				if (data.type) {
					switch (data.type) {
						/*
							การ uplad หน้า home/portal ตอนนี้ ใช้งานไปที่ route/uploader.js
						*/
						case "import":
					    let importData = {download: {link: data.download.link}};
							const workerFarm = require('worker-farm');
							//const importService = workerFarm(require.resolve('./import-worker.js'));
							const importService = workerFarm(require.resolve('./import-worker.js'));
					    await importService(importData, function (output) {
								log.info('Import Result=>' + JSON.stringify(output));
					    });
						break;
						case "trigger":
							let convertData = data;
							const convertWorker = require('worker-farm');
							const convertService = convertWorker(require.resolve('./convert-worker.js'));
						  await convertService(convertData, function (output) {
 								log.info('Convert Process Result=>' + JSON.stringify(output));
							});
						break;
						case "newdicom":
							let eventData = {dicom: data.dicom};
							const newdicomEvtWorker = require('worker-farm');
							const newdicomEvtService = newdicomEvtWorker(require.resolve('./onnewdicom-worker.js'));
							try {
								newdicomEvtService(eventData, function (output) {
									log.info('onNewDicomEvent Result=>' + JSON.stringify(output));
								});
							} catch (error){
								log.error('NewDicomError=>' + JSON.stringify(error));
						    reject(error);
						  }
							/*
							require('./onnewdicom-worker.js')( eventData, (output)=>{
								log.info('onNewDicomEvent Result=>' + JSON.stringify(output));
							})
							*/
						break;
						case "exec":

						break;
						case "move":

						break;
						case "run":
							let hospitalId = data.hospitalId;
							let sender = data.sender;
							let outputs = [];
							let yourCommands = data.commands;
							await yourCommands.forEach(async (cmd, i) => {
								let output = await $this.runCommand(cmd);
								log.info('out=>' + output);
								let out = {type: 'clientresult', results: output, hospitalId: hospitalId, sender: sender};
								connection.send(JSON.stringify(out));
								outputs.push(output);
							});
							let result = {type: 'clientresult', results: outputs, hospitalId: hospitalId, sender: sender};
							connection.send(JSON.stringify(result));
						break;
						case "echo":
							let echoHospitalId = data.hospitalId;
							let echoSender = data.sender;
							connection.send(JSON.stringify({type: 'echoreturn', myconnection: $this.connectUrl, hospitalId: echoHospitalId, sender: echoSender}));
						break;
						case "log":
							let logHospitalId = data.hospitalId;
							let logSender = data.sender;
							let uploadCmd = 'curl --list-only --user radconnext:A4AYitoDUB -T C:\\RadConnext\\Radconnext-win32-x64\\resources\\app\\http\\log\\log.log ftp://119.59.125.63/domains/radconnext.com/private_html/radconnext/inc_files/'
							let uploadResult = await $this.runCommand(uploadCmd);
							log.info('uploadResult=>' + uploadResult);
							connection.send(JSON.stringify({type: 'logreturn', log: {link: 'https://radconnext.com/radconnext/inc_files/log.log'}, hospitalId: logHospitalId, sender: logSender}));
						break;
					}
				} else {
					if (connection.connected) {
						connection.send(JSON.stringify({type: 'error', message: 'You command invalid type.'}));
					}
				}
			}
		});
	});

	this.runCommand = function (command) {
		return new Promise(function(resolve, reject) {
			exec(command, (error, stdout, stderr) => {
				if(error === null) {
					resolve(`${stdout}`);
				} else {
					reject(`${stderr}`);
				}
	  	});
		});
	}

	client.connect(this.connectUrl/*, 'echo-protocol'*/);
}

module.exports = ( arg, monitor ) => {
	const webSocketClient = new RadconWebSocketClient(arg, monitor);
	return webSocketClient;
}
