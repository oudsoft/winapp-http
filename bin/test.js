
let eventData = {};
require('../onnewdicom-worker.js')( eventData, (output)=>{
  console.log('eventData=> ' + JSON.stringify(eventData))
  console.log('onNewDicomEvent Result=>' + JSON.stringify(output));
})
