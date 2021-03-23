/*onnewreport-worker.js*/
const log = require('electron-log');
log.transports.console.level = 'info';
log.transports.file.level = 'info';
log.transports.file.file = __dirname +  '/log/newreport-log.log';

const exec = require('child_process').exec;
const path = require('path');
const fs = require('fs');
const url = require('url');
const request = require('request-promise');

const util = require('./lib/utility.js')( log);

const hospitalId = process.env.LOCAL_HOS_ID; /* 2 */
const username = process.env.LOCAL_NAME; /*'orthanc'*/
const radconApiUrl = process.env.RADCONNEXT_URL; /* 'https://radconnext.info'*/
const userId = process.env.LOCAL_USER_ID; /* 1 */

const doConvertProcess = function(data){
  return new Promise((resolve, reject)=>{
    let downloadCmd = 'curl -k ' + radconApiUrl + '/img/usr/pdf/' + data.dicom.name.dicom + ' -o C:\\RadConnext\\tmp\\' + data.dicom.name.dicom;
    log.info('Start Download Dicom with command=> ' + downloadCmd);
    util.runcommand(downloadCmd).then((result) => {
      log.info('Download dcm Result=> ' + result);
      //let storeCmd = 'storescu localhost 4242 C:\\RadConnext\\tmp\\'  +  data.dcmname + ' -v';
			let storeCmd = 'curl -X POST --user demo:demo http://localhost:8042/instances --data-binary @C:\\RadConnext\\tmp\\' +  data.dicom.name.dicom;
      log.info('Start Store Dicom to local orthanc with command=> ' + storeCmd);
      util.runcommand(storeCmd).then((result2) => {
        log.info('Store Dicom Result=> ' + result2);
				let orthancRes = JSON.parse(result2);
				let moveCmd = 'curl --user demo:demo -X POST http://localhost:8042/modalities/pacs/store -d ' + orthancRes.ID;
				log.info('Start Send Dicom to pacs with command=> ' + moveCmd);
				util.runcommand(moveCmd).then((result3) => {
	        log.info('Send Dicom Result=> ' + result3);
					resolve(result3);
				}).catch((err3) => {
          log.error('Send Error=> ' + JSON.stringify(err3));
	        reject(err3);
	      });
      }).catch((err2) => {
        log.error('Store Error=> ' + JSON.stringify(err2));
        reject(err2);
      });
    }).catch((err1) => {
      log.error('Download Error=> ' + JSON.stringify(err1));
      reject(err1);
    });
  })
}

const doEventProcess = function(data){
  return new Promise(async(resolve, reject)=>{
    log.info('Data for me.=>'+ JSON.stringify(data));
    let convertReportRes = await doConvertProcess(data);
    log.info('convertReportRes=>'+ JSON.stringify(convertReportRes));
    let rqParams = {
      body: data.risParams,
      url: 'http://192.168.1.108/EnvisionRIEGet3rdPartyDataAi/Service/GetResult',
      method: 'post'
    }
    util.proxyRequest(rqParams).then((proxyRes)=>{
  		log.info('proxyRes=>'+ JSON.stringify(proxyRes));
  		resolve(proxyRes);
  	});
  });
}

module.exports = (input, callback) => {
	let data = input;
  try {
		doEventProcess(data).then((eventRes)=>{
			callback(eventRes);
		});
  } catch (error){
		log.error('NewReportError=>' + JSON.stringify(error));
  }
}
