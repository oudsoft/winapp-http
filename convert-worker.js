/*convert-worker.js*/
const log = require('electron-log');
log.transports.console.level = 'info';
log.transports.file.level = 'info';
log.transports.file.file = __dirname +  '/log/convert-log.log';

const exec = require('child_process').exec;
const path = require('path');
const fs = require('fs');

const runcommand = function (command) {
	return new Promise(function(resolve, reject) {
		log.info("Exec Command=>" + command);
		exec(command, (error, stdout, stderr) => {
			if(error === null) {
				resolve(`${stdout}`);
			} else {
				log.info('Error Exec => ' + error)
				reject(`${stderr}`);
			}
		});
	});
}

const doConvertProcess = function(data){
  return new Promise((resolve, reject)=>{
    let downloadCmd = 'curl -k https://' + data.hostname + '/img/usr/pdf/' + data.dcmname + ' -o C:\\RadConnext\\tmp\\' + data.dcmname;
    log.info('Start Download Dicom with command=> ' + downloadCmd);
    runcommand(downloadCmd).then((result) => {
      log.info('Download dcm Result=> ' + result);
      //let storeCmd = 'storescu localhost 4242 C:\\RadConnext\\tmp\\'  +  data.dcmname + ' -v';
			let storeCmd = 'curl -X POST --user demo:demo http://localhost:8042/instances --data-binary @C:\\RadConnext\\tmp\\' +  data.dcmname;
      log.info('Start Store Dicom to local orthanc with command=> ' + storeCmd);
      runcommand(storeCmd).then((result2) => {
        log.info('Store Dicom Result=> ' + result2);
				let orthancRes = JSON.parse(result2);
				let moveCmd = 'curl --user demo:demo -X POST http://localhost:8042/modalities/pacs/store -d ' + orthancRes.ID;
				log.info('Start Send Dicom to pacs with command=> ' + moveCmd);
				runcommand(moveCmd).then((result3) => {
	        log.info('Send Dicom Result=> ' + result3);
					resolve(result3);
				}).catch((err3) => {
	        reject(err3);
	      });

				/*
				let callInstanceCmd = 'curl --user demo:demo http://localhost:8042/instances/' + orthancRes.ID;
				log.info('Call Dicom Instances with command=> ' + callInstanceCmd);
				runcommand(callInstanceCmd).then((result3) => {
          log.info('New Dicom IntanceTag=> ' + result3);
					let instanceTag = JSON.parse(result3);
					let callSeriesCmd = 'curl --user demo:demo http://localhost:8042/series/' + instanceTag.ParentSeries;
					log.info('Call Dicom Seires with command=> ' + callInstanceCmd);
					runcommand(callSeriesCmd).then((result4) => {
						let seriesTag = JSON.parse(result4);
						let seriesInstanceUID = seriesTag.MainDicomTags.SeriesInstanceUID;
		        let moveCmd = 'curl -X POST --user demo:demo http://localhost:8042/modalities/Localhost/move -d "{""Level"" : ""Series"", ""Resources"" : [{""SeriesInstanceUID"": ""' + seriesInstanceUID + '""}], ""TargetAet"": ""VRDICOM""}"';
		        log.info('Start Transfer dicom to Pacs with command=> ' + moveCmd);
		        runcommand(moveCmd).then((result5) => {
		          log.info('Transer dicom to Pacs Result=> ' + result5);
		          resolve(result5);
		        }).catch((err5) => {
		          reject(err5);
		        });
					}).catch((err4) => {
		        reject(err4);
		      });
				}).catch((err3) => {
	        reject(err3);
	      });
				*/
      }).catch((err2) => {
        reject(err2);
      });
    }).catch((err1) => {
      reject(err1);
    });
  })
}

module.exports = (input, callback) => {
	return new Promise(async function(resolve, reject){
		let data = input;
    try {
  		let convertRes = await doConvertProcess(data);
  		callback(convertRes);
  		resolve(convertRes);
    } catch (error){
  		log.error('ConvertError=>' + JSON.stringify(error));
      reject(error);
    }
	});
}
