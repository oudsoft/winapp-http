/*onnewdicom-worker.js*/
const log = require('electron-log');
log.transports.console.level = 'info';
log.transports.file.level = 'info';
log.transports.file.file = __dirname +  '/log/newdicom-log.log';

const exec = require('child_process').exec;
const path = require('path');
const fs = require('fs');
const url = require('url');
const request = require('request-promise');

const hospitalId = 2;
const username = 'orthanc';
const userId = 1;
const radconApiUrl = 'https://radconnext.info';

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

const proxyRequest = function(rqParam) {
	return new Promise(function(resolve, reject) {
		let rqBody = JSON.stringify(rqParam.body);
		let proxyParams = {
			method: rqParam.method,
			url: rqParam.url,
			auth: rqParam.auth,
			headers: {
				'Content-Type': 'application/json'
			},
			body: rqBody
		};
		if (rqParam.Authorization) {
			proxyParams.headers.Authorization = rqParam.Authorization;
		}
		log.info('proxyParams=>' + JSON.stringify(proxyParams));
		request(proxyParams, (err, res, body) => {
			if (!err) {
				resolve({status: {code: 200}, res: res});
			} else {
				log.error('your Request Error=>' + JSON.stringify(err));
				reject({status: {code: 500}, err: err});
			}
		});
	});
}

const doCallCreatePreviewSeries = function(seriesId, instanceList){
	return new Promise(async function(resolve, reject) {
		let params = {hospitalId: hospitalId, seriesId: seriesId, username: username, instanceList: instanceList};
		let apiurl = radconApiUrl + '/api/orthancproxy/create/preview';
		//let orthancRes = await apiconnector.doCallApi(apiurl, params)
		let rqParam = {method: 'post', url: apiurl, body: params};
    let orthancRes = await proxyRequest(rqParam);
		resolve(orthancRes);
	});
}

const doCallCreateZipInstance = function(seriesId, instanceId){
  return new Promise(async function(resolve, reject) {
    let params = {hospitalId: hospitalId, seriesId: seriesId, username: username, instanceId: instanceId};
    let apiurl = radconApiUrl + '/api/orthancproxy/create/zip/instance';
    //let orthancRes = await apiconnector.doCallApi(apiurl, params)
    let rqParam = {method: 'post', url: apiurl, body: params};
    let orthancRes = await proxyRequest(rqParam);
    resolve(orthancRes);
  });
}

const doCallSendAI = function(seriesId, instanceId, studyId){
  return new Promise(async function(resolve, reject) {
    let params = { userId: userId, seriesId: seriesId, instanceId: instanceId, studyId: studyId};
    let apiurl = radconApiUrl + '/api/orthancproxy/sendai';
    let rqParam = {method: 'post', url: apiurl, body: params};
    //let orthancRes = await apiconnector.doCallApi(apiurl, params)
    let orthancRes = await proxyRequest(rqParam);
    resolve(orthancRes);
  });
}

const doConvertAIResult = function(studyId, pdffilecode, modality){
	return new Promise(async function(resolve, reject) {
		let params = {hospitalId: hospitalId, username: username, studyId: studyId, pdffilecode: pdffilecode, modality: modality};
		let apiurl = radconApiUrl + '/api/orthancproxy/convert/ai/report';
		let rqParam = {method: 'post', url: apiurl, body: params};
		//let orthancRes = await apiconnector.doCallApi(apiurl, params)
		let orthancRes = await proxyRequest(rqParam);
		resolve(orthancRes);
	});
}

const isSendAICriteria = function(seriesLength, instancesLength, moda, bpex, adpd, ppsd){
  log.info('seriesLength, instancesLength => ' + seriesLength + ', ' + instancesLength );
  if ((seriesLength == 1) && (instancesLength == 1)) {
    log.info('moda, bpex, adpd, ppsd => ' + moda + ', ' + bpex + ', ' + adpd + ', ' + ppsd);
    if ((moda === 'CR') && (bpex === 'CHEST') && (adpd.indexOf('CHEST') >= 0) && (ppsd === 'Chest X-Ray (PP)')) {
      return true;
    } else {
      return false;
    }
  } return false;
}

const doEventProcess = function(data){
  return new Promise(async(resolve, reject)=>{
		let moda = data.dicom.SamplingSeries.MainDicomTags.Modality;
		let bpex = data.dicom.SamplingSeries.MainDicomTags.BodyPartExamined;
		let adpd = data.dicom.SamplingSeries.MainDicomTags.AcquisitionDeviceProcessingDescription;
		let ppsd = data.dicom.SamplingSeries.MainDicomTags.PerformedProcedureStepDescription;
		let seriesLength = data.dicom.Series.length;
		let instancesLength = data.dicom.SamplingSeries.Instances.length;
		let isCriteriaAI = isSendAICriteria(seriesLength, instancesLength, moda, bpex, adpd, ppsd);
		log.info('isCriteriaAI=>' + isCriteriaAI);
		log.info('isCriteriaAI == true =>' + (isCriteriaAI == true));
    if (isCriteriaAI == true){
      let studyId = data.dicom.ID;
      let seriesId = data.dicom.SamplingSeries.ID;
			let instanceList = data.dicom.SamplingSeries.Instances
      let instanceId = instanceList[0];
			let callImage = await doCallCreatePreviewSeries(seriesId, instanceList);
      let callZipRes = await doCallCreateZipInstance(seriesId, instanceId);
      let callSendAIRes = await doCallSendAI(seriesId, instanceId, studyId);
			let aiResBody = JSON.parse(callSendAIRes.res.body);
    	log.info('callSendAIRes=>' + JSON.stringify(aiResBody));
			let pdffilecode = aiResBody.result.id;
			let callConvertAIResultRes = await doConvertAIResult(studyId, pdffilecode, moda);
      resolve(callConvertAIResultRes);
    } else {
      resolve();
    }
  });
}

module.exports = (input, callback) => {
	let data = input;
  try {
		doEventProcess(data).then((eventRes)=>{
			callback(eventRes);
		});
  } catch (error){
		log.error('NewDicomError=>' + JSON.stringify(error));
  }
}
