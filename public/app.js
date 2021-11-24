console.log("verssion 202106071628");
mdc.ripple.MDCRipple.attachTo(document.querySelector('.mdc-button'));

var timeInterval = 1800;
document
const configuration = {
  iceServers: [
  /*{
      urls: [
       'stun:stun.qq.com:3478',
       'stun:stun.qvod.com:3478',
       'stun:stun1.l.google.com:19302',
       'stun:stun2.l.google.com:19302',
      ],
  },*/{
        url:'turn:13.230.194.51:3478',
	username:'test',
	credential:'test123',
  }
  ],
  iceCandidatePoolSize: 10,
};

let peerConnection = null;
let localStream = null;
let remoteStream = null;
let roomDialog = null;
let roomId = null;

function init() {
  document.querySelector('#cameraBtn').addEventListener('click', openUserMedia);
  document.querySelector('#hangupBtn').addEventListener('click', hangUp);
  document.querySelector('#createBtn').addEventListener('click', createRoom);
  document.querySelector('#joinBtn').addEventListener('click', joinRoom);
  roomDialog = new mdc.dialog.MDCDialog(document.querySelector('#room-dialog'));
}

function getInputValue(){
            // Selecting the input element and get its value 
            timeInterval = parseInt(document.getElementById("time-interval").value)/2;
            // Displaying the value
            alert("Log interval set to "+timeInterval*2+ "s");
        }

function arrayToCSV (twoDiArray, filename) {
  var csvRows = [];
  for (var i = 0; i < twoDiArray.length; ++i) {
      for (var j = 0; j < twoDiArray[i].length; ++j) {
          twoDiArray[i][j] = '\"' + twoDiArray[i][j] + '\"';
      }
      csvRows.push(twoDiArray[i].join(','));
  }

  var csvString = csvRows.join('\r\n');
  var a         = document.createElement('a');
  a.href        = 'data:attachment/csv,' + csvString;
  a.target      = '_blank';
  a.download    = filename;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
async function createRoom() {
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = true;
  const db = firebase.firestore();
  const roomRef = await db.collection('rooms').doc();

  console.log('Create PeerConnection with configuration: ', configuration);
  peerConnection = new RTCPeerConnection(configuration);
  var repeatInterval = 2000; // 2000 ms == 2 seconds
  datalist = [[
    'bandwith.googActualEncBitrate',
    'bandwith.googAvailableSendBandwidth',
    'bandwith.googAvailableReceiveBandwidth',
    'bandwith.googRetransmitBitrate',
    'bandwith.googTargetEncBitrate',
    'bandwith.googTransmitBitrate',
    'result.video.send.availableBandwidth',
    'result.video.recv.availableBandwidth',
    'result.results.packetsLost',
    'result.results.packetsReceived',
    'result.results.googTargetDelayMs',
    'result.results.googCurrentDelayMs',
    'result.results.googJitterBufferMs'
  ]];
  getStats(peerConnection, function(result) {
    var bandwith = result.bandwidth;
    var results = result.results;
    isDataFetchable = false;
    // to access native "results" array
    if(results.length>3){
     
    results.forEach(function(item) {
        if (item.type === 'ssrc' && item.mediaType === 'video' && item.id.endsWith('_recv')) {
            packetsLost = item.packetsLost;
            console.log("find packetsLost: ", packetsLost);
            packetsRecvd = item.packetsReceived;
            targetDelay = item.googTargetDelayMs;
            currentDelay = item.googCurrentDelayMs;
            jitter = item.googJitterBufferMs;
            isDataFetchable = true;
        }
    });
    if(isDataFetchable){
      datalist.push([
        bandwith.googActualEncBitrate,
        bandwith.googAvailableSendBandwidth,
        bandwith.googAvailableReceiveBandwidth,
        bandwith.googRetransmitBitrate,
        bandwith.googTargetEncBitrate,
        bandwith.googTransmitBitrate,
        result.video.send.availableBandwidth,
        result.video.recv.availableBandwidth,
        packetsLost,
        packetsRecvd,
        targetDelay,
        currentDelay,
        jitter
      ]);
    }else{
      datalist.push([-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1]);
    }
    if(datalist.length==timeInterval+1){
      d = new Date();
      hr = String(d.getHours()).padStart(2,'0');
      mi = String(d.getMinutes()).padStart(2,'0');
      sc = String(d.getSeconds()).padStart(2,'0');
      arrayToCSV(datalist, hr+","+mi+","+sc+".csv");
      datalist = [[
        'bandwith.googActualEncBitrate',
        'bandwith.googAvailableSendBandwidth',
        'bandwith.googAvailableReceiveBandwidth',
        'bandwith.googRetransmitBitrate',
        'bandwith.googTargetEncBitrate',
        'bandwith.googTransmitBitrate',
        'result.video.send.availableBandwidth',
        'result.video.recv.availableBandwidth',
        'result.results.packetsLost',
        'result.results.packetsReceived',
        'result.results.googTargetDelayMs',
        'result.results.googCurrentDelayMs',
        'result.results.googJitterBufferMs'
      ]];
    }}
  }, repeatInterval);
  registerPeerConnectionListeners();

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  // Code for collecting ICE candidates below
  const callerCandidatesCollection = roomRef.collection('callerCandidates');

  peerConnection.addEventListener('icecandidate', event => {
    if (!event.candidate) {
      console.log('Got final candidate!');
      return;
    }
    console.log('Got candidate: ', event.candidate);
    callerCandidatesCollection.add(event.candidate.toJSON());
  });
  // Code for collecting ICE candidates above

  // Code for creating a room below
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  console.log('Created offer:', offer);

  const roomWithOffer = {
    'offer': {
      type: offer.type,
      sdp: offer.sdp,
    },
  };
  await roomRef.set(roomWithOffer);
  roomId = roomRef.id;
  console.log(`New room created with SDP offer. Room ID: ${roomRef.id}`);
  document.querySelector(
      '#currentRoom').innerText = `Current room is ${roomRef.id} - You are the caller!`;
  // Code for creating a room above

  peerConnection.addEventListener('track', event => {
    console.log('Got remote track:', event.streams[0]);
    event.streams[0].getTracks().forEach(track => {
      console.log('Add a track to the remoteStream:', track);
      remoteStream.addTrack(track);
    });
  });

  // Listening for remote session description below
  roomRef.onSnapshot(async snapshot => {
    const data = snapshot.data();
    if (!peerConnection.currentRemoteDescription && data && data.answer) {
      console.log('Got remote description: ', data.answer);
      const rtcSessionDescription = new RTCSessionDescription(data.answer);
      await peerConnection.setRemoteDescription(rtcSessionDescription);
    }
  });
  // Listening for remote session description above

  // Listen for remote ICE candidates below
  roomRef.collection('calleeCandidates').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async change => {
      if (change.type === 'added') {
        let data = change.doc.data();
        console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
        await peerConnection.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });
  // Listen for remote ICE candidates above
}

function joinRoom() {
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = true;

  document.querySelector('#confirmJoinBtn').
      addEventListener('click', async () => {
        roomId = document.querySelector('#room-id').value;
        console.log('Join room: ', roomId);
        document.querySelector(
            '#currentRoom').innerText = `Current room is ${roomId} - You are the callee!`;
        await joinRoomById(roomId);
      }, {once: true});
  roomDialog.open();
}

async function joinRoomById(roomId) {
  const db = firebase.firestore();
  const roomRef = db.collection('rooms').doc(`${roomId}`);
  const roomSnapshot = await roomRef.get();
  console.log('Got room:', roomSnapshot.exists);

  if (roomSnapshot.exists) {
    console.log('Create PeerConnection with configuration: ', configuration);
    peerConnection = new RTCPeerConnection(configuration);
    var repeatInterval = 2000; // 2000 ms == 2 seconds
    datalist = [[
      'bandwith.googActualEncBitrate',
      'bandwith.googAvailableSendBandwidth',
      'bandwith.googAvailableReceiveBandwidth',
      'bandwith.googRetransmitBitrate',
      'bandwith.googTargetEncBitrate',
      'bandwith.googTransmitBitrate',
      'result.video.send.availableBandwidth',
      'result.video.recv.availableBandwidth',
      'result.results.packetsLost',
      'result.results.packetsReceived',
      'result.results.googTargetDelayMs',
      'result.results.googCurrentDelayMs',
      'result.results.googJitterBufferMs'
    ]];
    getStats(peerConnection, function(result) {
      var bandwith = result.bandwidth;
      var results = result.results;
      isDataFetchable = false;
      // to access native "results" array
      if(results.length>3){

      results.forEach(function(item) {
          if (item.type === 'ssrc' && item.mediaType === 'video' && item.id.endsWith('_recv')) {
              packetsLost = item.packetsLost;
              console.log("find packetsLost: ", packetsLost);
              packetsRecvd = item.packetsReceived;
              targetDelay = item.googTargetDelayMs;
              currentDelay = item.googCurrentDelayMs;
              jitter = item.googJitterBufferMs;
              isDataFetchable = true;
          }
      });
      if(isDataFetchable){
        datalist.push([
          bandwith.googActualEncBitrate,
          bandwith.googAvailableSendBandwidth,
          bandwith.googAvailableReceiveBandwidth,
          bandwith.googRetransmitBitrate,
          bandwith.googTargetEncBitrate,
          bandwith.googTransmitBitrate,
          result.video.send.availableBandwidth,
          result.video.recv.availableBandwidth,
          packetsLost,
          packetsRecvd,
          targetDelay,
          currentDelay,
          jitter
        ]);
      }else{
        datalist.push([-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1]);
      }
      if(datalist.length==timeInterval+1){
        d = new Date();
        hr = String(d.getHours()).padStart(2,'0');
        mi = String(d.getMinutes()).padStart(2,'0');
        sc = String(d.getSeconds()).padStart(2,'0');
        arrayToCSV(datalist, hr+","+mi+","+sc+".csv");
        datalist = [[
          'bandwith.googActualEncBitrate',
          'bandwith.googAvailableSendBandwidth',
          'bandwith.googAvailableReceiveBandwidth',
          'bandwith.googRetransmitBitrate',
          'bandwith.googTargetEncBitrate',
          'bandwith.googTransmitBitrate',
          'result.video.send.availableBandwidth',
          'result.video.recv.availableBandwidth',
          'result.results.packetsLost',
          'result.results.packetsReceived',
          'result.results.googTargetDelayMs',
          'result.results.googCurrentDelayMs',
          'result.results.googJitterBufferMs'
        ]];
      }}
    }, repeatInterval);
    registerPeerConnectionListeners();
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    // Code for collecting ICE candidates below
    const calleeCandidatesCollection = roomRef.collection('calleeCandidates');
    peerConnection.addEventListener('icecandidate', event => {
      if (!event.candidate) {
        console.log('Got final candidate!');
        return;
      }
      console.log('Got candidate: ', event.candidate);
      calleeCandidatesCollection.add(event.candidate.toJSON());
    });
    // Code for collecting ICE candidates above

    peerConnection.addEventListener('track', event => {
      console.log('Got remote track:', event.streams[0]);
      event.streams[0].getTracks().forEach(track => {
        console.log('Add a track to the remoteStream:', track);
        remoteStream.addTrack(track);
      });
    });

    // Code for creating SDP answer below
    const offer = roomSnapshot.data().offer;
    console.log('Got offer:', offer);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    console.log('Created answer:', answer);
    await peerConnection.setLocalDescription(answer);

    const roomWithAnswer = {
      answer: {
        type: answer.type,
        sdp: answer.sdp,
      },
    };
    await roomRef.update(roomWithAnswer);
    // Code for creating SDP answer above

    // Listening for remote ICE candidates below
    roomRef.collection('callerCandidates').onSnapshot(snapshot => {
      snapshot.docChanges().forEach(async change => {
        if (change.type === 'added') {
          let data = change.doc.data();
          console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
          await peerConnection.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
    // Listening for remote ICE candidates above
  }
}

async function openUserMedia(e) {
  const stream = await navigator.mediaDevices.getUserMedia(
      {video: true, audio: true});
  document.querySelector('#localVideo').srcObject = stream;
  localStream = stream;
  remoteStream = new MediaStream();
  document.querySelector('#remoteVideo').srcObject = remoteStream;

  console.log('Stream:', document.querySelector('#localVideo').srcObject);
  document.querySelector('#cameraBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = false;
  document.querySelector('#createBtn').disabled = false;
  document.querySelector('#hangupBtn').disabled = false;
}

async function hangUp(e) {
  const tracks = document.querySelector('#localVideo').srcObject.getTracks();
  tracks.forEach(track => {
    track.stop();
  });

  if (remoteStream) {
    remoteStream.getTracks().forEach(track => track.stop());
  }

  if (peerConnection) {
    peerConnection.close();
  }

  document.querySelector('#localVideo').srcObject = null;
  document.querySelector('#remoteVideo').srcObject = null;
  document.querySelector('#cameraBtn').disabled = false;
  document.querySelector('#joinBtn').disabled = true;
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#hangupBtn').disabled = true;
  document.querySelector('#currentRoom').innerText = '';

  // Delete room on hangup
  if (roomId) {
    const db = firebase.firestore();
    const roomRef = db.collection('rooms').doc(roomId);
    const calleeCandidates = await roomRef.collection('calleeCandidates').get();
    calleeCandidates.forEach(async candidate => {
      await candidate.ref.delete();
    });
    const callerCandidates = await roomRef.collection('callerCandidates').get();
    callerCandidates.forEach(async candidate => {
      await candidate.ref.delete();
    });
    await roomRef.delete();
  }

  document.location.reload(true);
}

function registerPeerConnectionListeners() {
  peerConnection.addEventListener('icegatheringstatechange', () => {
    console.log(
        `ICE gathering state changed: ${peerConnection.iceGatheringState}`);
  });

  peerConnection.addEventListener('connectionstatechange', () => {
    console.log(`Connection state change: ${peerConnection.connectionState}`);
  });

  peerConnection.addEventListener('signalingstatechange', () => {
    console.log(`Signaling state change: ${peerConnection.signalingState}`);
  });

  peerConnection.addEventListener('iceconnectionstatechange ', () => {
    console.log(
        `ICE connection state change: ${peerConnection.iceConnectionState}`);
  });
}

init();


