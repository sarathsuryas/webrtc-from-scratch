var isInitiator = false;
var isChannelReady = false;
var isInitiator = false;
var pc;
var isStarted = false;
var localStream;
var remoteStream;
var room = prompt('Enter room name:');
var pcConfig = turnConfig;

var socket = io.connect()

if (room) {
  socket.emit('create or join', room)
}

socket.on('created', (room) => {
  console.log('Created room ' + room)
  isInitiator = true
})

socket.on('full', (room) => {
  console.log("room" + room + "is full",)
})

socket.on('join', (room) => {
  console.log('Another peer made a request to join room ' + room);
  console.log('This peer is the initiator of room ' + room + '!');
  isChannelReady = true;
})

socket.on('joined', (room) => {
  console.log('joined: ' + room);
  isChannelReady = true;
})

// log serverside messages in the client for convenience
socket.on('log', function (array) {
  console.log.apply(console, array);
});


socket.on('message', (message, room) => {
  console.log('Client received message:', message, room);
  if (message === 'got user media') {
    maybeStart();
  } else if (message.type === 'offer') {
    if (!isInitiator && !isStarted) {
      maybeStart();
    }
    pc.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer()
  } else if (message.type === 'answer' && isStarted) {
    pc.setRemoteDescription(new RTCSessionDescription(message));
  } else if(message.type === 'candidate' && isStarted) {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    pc.addIceCandidate(candidate);
  } else if (message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
})


//Function to send message in a room
function sendMessage(message, room) {
  console.log('Client sending message: ', message, room);
  socket.emit('message', message, room)
}

var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');
console.log("Going to find Local media");
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(gotSream)
  .catch((e) => {
    alert('getUserMedia() error: ' + e.name);
    console.log(e)
  })

function gotSream(stream) {
  console.log('Adding local stream.');
  localStream = stream
  localVideo.srcObject = localStream
  sendMessage('got user media', room)
  if (isInitiator) {
    maybeStart()
  }
}
// console.log('Getting user media with constraints', localStreamConstraints);


function maybeStart() {
  if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
    console.log('>>>>>> creating peer connection');
    createPeerConnection()
    pc.addStream(localStream)
    isStarted = true;
    console.log('isInitiator', isInitiator);
  }
  if (isInitiator) {
    doCall()
  }
}
window.onbeforeunload = function() {
  sendMessage('bye', room);
};

function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(pcConfig)
    pc.onicecandidate = handleIceCandidate
    pc.onaddstream = handleRemoteStreamAdded;
    pc.onremovestream = handleRemoteStreamRemoved;
    console.log('Created RTCPeerConnnection');
  } catch (error) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
}

function handleIceCandidate(event) {
  console.log('icecandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    }, room)
  } else {
    console.log('End of candidates.');
  }
}

function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  alert('')
  remoteStream = event.stream
  remoteVideo.srcObject = remoteStream;
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);

}
function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}


function doCall() {
  console.log('Sending offer to peer');
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError)
}

function doAnswer() {
  console.log('Sending answer to peer.');
  pc.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  )
}

function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  console.log('setLocalAndSendMessage sending message', sessionDescription);
  sendMessage(sessionDescription, room);
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

function hangup() {
  console.log('Hanging up.');
  stop();
  sendMessage('bye',room);
}

function handleRemoteHangup() {
  console.log('Session terminated.');
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;
  pc.close();
  pc = null;
}