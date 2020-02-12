/**
 * RS485 Homegateway for Samsung Homenet
 * @소스 공개 : Daehwan, Kang
 * @삼성 홈넷용으로 수정 : erita
 * @수정일 2019-01-11
 * @ 2020-02-08 fornever - http 제어용으로 수정
 */
 
const util = require('util');
const SerialPort = require('serialport');
const mqtt = require('mqtt');
const http = require('http');
const https = require('https');
const express = require('express');
const fs = require('fs');


// 커스텀 파서
var Transform = require('stream').Transform;
util.inherits(CustomParser, Transform);

const CONST = {
  // 포트이름 설정
  portName: process.platform.startsWith('win') ? "COM6" : "/dev/ttyUSB0",
  // SerialPort 전송 Delay(ms)
  sendDelay: 80,
  // MQTT 브로커
  mqttBroker: 'mqtt://192.168.219.150',
  // MQTT 수신 Delay(ms)
  mqttDelay: 1000*10,

  // http port
  httpPort: 8888,

  // 메시지 Prefix 상수
  //MSG_PREFIX: [0xb0, 0xac, 0xae, 0xc2, 0xad, 0xab, 0xcc, 0xa1, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6],
  MSG_PREFIX: [0xb0, 0xac, 0xae, 0xc2, 0xad, 0xab],

  // 기기별 상태 및 제어 코드(HEX)
  DEVICE_STATE: [
    //{deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(5,'b079310078','hex'), power1: 'OFF', power2: 'OFF', power3: 'OFF'}, //상태-00
    //{deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(5,'b079310179','hex'), power1: 'ON' , power2: 'OFF', power3: 'OFF'}, //상태-01
    //{deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(5,'b07931027a','hex'), power1: 'OFF', power2: 'ON' , power3: 'OFF'}, //상태-02
    //{deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(5,'b07931037b','hex'), power1: 'ON' , power2: 'ON' , power3: 'OFF'}, //상태-03
    //{deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(5,'b07931047c','hex'), power1: 'OFF', power2: 'OFF', power3: 'ON' }, //상태-04
    //{deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(5,'b07931057d','hex'), power1: 'ON' , power2: 'OFF', power3: 'ON' }, //상태-05
    //{deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(5,'b07931067e','hex'), power1: 'OFF', power2: 'ON' , power3: 'ON' }, //상태-06
    //{deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(5,'b07931077f','hex'), power1: 'ON' , power2: 'ON' , power3: 'ON' }, //상태-07
    {deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(5,'b079210068','hex'), power1: 'OFF', power2: 'OFF'}, //상태-00
    {deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(5,'b079210169','hex'), power1: 'ON' , power2: 'OFF'}, //상태-01
    {deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(5,'b07921026a','hex'), power1: 'OFF', power2: 'ON'}, //상태-02
    {deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(5,'b07921036b','hex'), power1: 'ON' , power2: 'ON'}, //상태-03
    {deviceId: 'Fan', subId: '1', stateHex: Buffer.alloc(6,'b04e0300017c','hex'), power: 'OFF', speed: 'low' },
    {deviceId: 'Fan', subId: '1', stateHex: Buffer.alloc(6,'b04e0200017d','hex'), power: 'OFF', speed: 'mid' },
    {deviceId: 'Fan', subId: '1', stateHex: Buffer.alloc(6,'b04e0100017e','hex'), power: 'OFF', speed: 'high'},
    {deviceId: 'Fan', subId: '1', stateHex: Buffer.alloc(6,'b04e0300007d','hex'), power: 'ON' , speed: 'low' },
    {deviceId: 'Fan', subId: '1', stateHex: Buffer.alloc(6,'b04e0200007c','hex'), power: 'ON' , speed: 'mid' },
    {deviceId: 'Fan', subId: '1', stateHex: Buffer.alloc(6,'b04e0100007f','hex'), power: 'ON' , speed: 'high'},
    {deviceId: 'Thermo', subId: '1', stateHex: Buffer.alloc(4,'b07c0101','hex'), power: 'heat' , setTemp: '', curTemp: ''},
    {deviceId: 'Thermo', subId: '1', stateHex: Buffer.alloc(4,'b07c0100','hex'), power: 'off', setTemp: '', curTemp: ''},
    {deviceId: 'Thermo', subId: '2', stateHex: Buffer.alloc(4,'b07c0201','hex'), power: 'heat' , setTemp: '', curTemp: ''},
    {deviceId: 'Thermo', subId: '2', stateHex: Buffer.alloc(4,'b07c0200','hex'), power: 'off', setTemp: '', curTemp: ''},
    {deviceId: 'Thermo', subId: '3', stateHex: Buffer.alloc(4,'b07c0301','hex'), power: 'heat' , setTemp: '', curTemp: ''},
    {deviceId: 'Thermo', subId: '3', stateHex: Buffer.alloc(4,'b07c0300','hex'), power: 'off', setTemp: '', curTemp: ''},
    {deviceId: 'Thermo', subId: '4', stateHex: Buffer.alloc(4,'b07c0401','hex'), power: 'heat' , setTemp: '', curTemp: ''},
    {deviceId: 'Thermo', subId: '4', stateHex: Buffer.alloc(4,'b07c0400','hex'), power: 'off', setTemp: '', curTemp: ''},
    {deviceId: 'Thermo', subId: '5', stateHex: Buffer.alloc(4,'b07c0501','hex'), power: 'heat' , setTemp: '', curTemp: ''},
    {deviceId: 'Thermo', subId: '5', stateHex: Buffer.alloc(4,'b07c0500','hex'), power: 'off', setTemp: '', curTemp: ''}
  ],

  DEVICE_COMMAND: [
    //{deviceId: 'Light', subId: '1', commandHex: Buffer.alloc(5,'ac7a010057','hex'), power1: 'OFF'}, //거실1--off
    //{deviceId: 'Light', subId: '1', commandHex: Buffer.alloc(5,'ac7a010156','hex'), power1: 'ON' }, //거실1--on
    //{deviceId: 'Light', subId: '1', commandHex: Buffer.alloc(5,'ac7a020054','hex'), power2: 'OFF'}, //거실2--off
    //{deviceId: 'Light', subId: '1', commandHex: Buffer.alloc(5,'ac7a020155','hex'), power2: 'ON' }, //거실2--on
    //{deviceId: 'Light', subId: '1', commandHex: Buffer.alloc(5,'ac7a030055','hex'), power3: 'OFF'}, //거실3--off
    //{deviceId: 'Light', subId: '1', commandHex: Buffer.alloc(5,'ac7a030154','hex'), power3: 'ON' }, //거실3--on
    {deviceId: 'Light', subId: '1', commandHex: Buffer.alloc(5,'ac7a010057','hex'), power1: 'OFF'}, //거실1--off
    {deviceId: 'Light', subId: '1', commandHex: Buffer.alloc(5,'ac7a010156','hex'), power1: 'ON' }, //거실1--on
    {deviceId: 'Light', subId: '1', commandHex: Buffer.alloc(5,'ac7a020054','hex'), power2: 'OFF'}, //거실2--off
    {deviceId: 'Light', subId: '1', commandHex: Buffer.alloc(5,'ac7a020155','hex'), power2: 'ON' }, //거실2--on
    {deviceId: 'Fan', subId: '1', commandHex: Buffer.alloc(6, 'c24f05000008','hex'), power: 'ON'    }, //켜짐
    {deviceId: 'Fan', subId: '1', commandHex: Buffer.alloc(6, 'c24f0600000b','hex'), power: 'OFF'   }, //꺼짐
    {deviceId: 'Fan', subId: '1', commandHex: Buffer.alloc(6, 'c24f0300000e','hex'), speed: 'low'   }, //약(켜짐)
    {deviceId: 'Fan', subId: '1', commandHex: Buffer.alloc(6, 'c24f0200000f','hex'), speed: 'medium'}, //중(켜짐)
    {deviceId: 'Fan', subId: '1', commandHex: Buffer.alloc(6, 'c24f0100000c','hex'), speed: 'high'  }, //강(켜짐)
    {deviceId: 'Thermo', subId: '1', commandHex: Buffer.alloc(8, 'ae7d010100000053','hex'), power: 'heat' }, // 온도조절기1-on
    {deviceId: 'Thermo', subId: '1', commandHex: Buffer.alloc(8, 'ae7d010000000052','hex'), power: 'off'}, // 온도조절기1-off
    {deviceId: 'Thermo', subId: '2', commandHex: Buffer.alloc(8, 'ae7d020100000050','hex'), power: 'heat' },
    {deviceId: 'Thermo', subId: '2', commandHex: Buffer.alloc(8, 'ae7d020000000051','hex'), power: 'off'},
    {deviceId: 'Thermo', subId: '3', commandHex: Buffer.alloc(8, 'ae7d030100000051','hex'), power: 'heat' },
    {deviceId: 'Thermo', subId: '3', commandHex: Buffer.alloc(8, 'ae7d030000000050','hex'), power: 'off'},
    {deviceId: 'Thermo', subId: '4', commandHex: Buffer.alloc(8, 'ae7d040100000056','hex'), power: 'heat' },
    {deviceId: 'Thermo', subId: '4', commandHex: Buffer.alloc(8, 'ae7d040000000057','hex'), power: 'off'},
    {deviceId: 'Thermo', subId: '5', commandHex: Buffer.alloc(8, 'ae7d050100000057','hex'), power: 'heat' },
    {deviceId: 'Thermo', subId: '5', commandHex: Buffer.alloc(8, 'ae7d050000000056','hex'), power: 'off'},
    {deviceId: 'Thermo', subId: '1', commandHex: Buffer.alloc(8, 'ae7f01FF000000FF','hex'), setTemp: ''}, // 온도조절기1-온도설정
    {deviceId: 'Thermo', subId: '2', commandHex: Buffer.alloc(8, 'ae7f02FF000000FF','hex'), setTemp: ''},
    {deviceId: 'Thermo', subId: '3', commandHex: Buffer.alloc(8, 'ae7f03FF000000FF','hex'), setTemp: ''},
    {deviceId: 'Thermo', subId: '4', commandHex: Buffer.alloc(8, 'ae7f04FF000000FF','hex'), setTemp: ''},
    {deviceId: 'Thermo', subId: '5', commandHex: Buffer.alloc(8, 'ae7f05FF000000FF','hex'), setTemp: ''}
  ],
  
  // 상태 Topic (/homenet/${deviceId}${subId}/${property}/state/ = ${value})
  // 명령어 Topic (/homenet/${deviceId}${subId}/${property}/command/ = ${value})
  TOPIC_PRFIX: 'homenet',
  STATE_TOPIC: 'homenet/%s%s/%s/state', //상태 전달
  DEVICE_TOPIC: 'homenet/+/+/command' //명령 수신

};


//////////////////////////////////////////////////////////////////////////////////////
// 삼성 홈넷용 시리얼 통신 파서 : 메시지 길이나 구분자가 불규칙하여 별도 파서 정의
function CustomParser(options) {
	if (!(this instanceof CustomParser))
		return new CustomParser(options);
	Transform.call(this, options);
	this._queueChunk = [];
	this._msgLenCount = 0;
	this._msgLength = 8;
	this._msgTypeFlag = false;
}

CustomParser.prototype._transform = function(chunk, encoding, done) {
	var start = 0;
	for (var i = 0; i < chunk.length; i++) {
		if(CONST.MSG_PREFIX.includes(chunk[i])) {			// 청크에 구분자(MSG_PREFIX)가 있으면
			this._queueChunk.push( chunk.slice(start, i) );	// 구분자 앞부분을 큐에 저장하고
			this.push( Buffer.concat(this._queueChunk) );	// 큐에 저장된 메시지들 합쳐서 내보냄
			this._queueChunk = [];	// 큐 초기화
			this._msgLenCount = 0;
			start = i;
			this._msgTypeFlag = true;	// 다음 바이트는 메시지 종류
		} 
		// 메시지 종류에 따른 메시지 길이 파악
		else if(this._msgTypeFlag) {
			switch (chunk[i]) {
				case 0x41: case 0x52: case 0x53: case 0x54: case 0x55: case 0x56: case 0x78: case 0x2f:
					this._msgLength = 4;	break;
				case 0x79: case 0x7A:
					this._msgLength = 5;	break;
				case 0x4e: case 0x4f:
					this._msgLength = 6;	break;
				default:
					this._msgLength = 8;
			}
			this._msgTypeFlag = false;
		}
		this._msgLenCount++;
	}
	// 구분자가 없거나 구분자 뒷부분 남은 메시지 큐에 저장
	this._queueChunk.push(chunk.slice(start));
	
	// 메시지 길이를 확인하여 다 받았으면 내보냄
	if(this._msgLenCount >= this._msgLength) {
		this.push( Buffer.concat(this._queueChunk) );	// 큐에 저장된 메시지들 합쳐서 내보냄
		this._queueChunk = [];	// 큐 초기화
		this._msgLenCount = 0;
	}
	
	done();
};
//////////////////////////////////////////////////////////////////////////////////////


// 로그 표시 
var log = (...args) => console.log('[' + new Date().toLocaleString('ko-KR', {timeZone: 'Asia/Seoul'}) + ']', args.join(' '));

//////////////////////////////////////////////////////////////////////////////////////
// 홈컨트롤 상태
var homeStatus = {};
var homeStatus2 = [];
var lastReceive = new Date().getTime();
var mqttReady = false;
var queue = new Array();
var queueSent = new Array();

//////////////////////////////////////////////////////////////////////////////////////
// MQTT-Broker 연결
const client  = mqtt.connect(CONST.mqttBroker, {clientId: 'Samsung-Homenet'});
client.on('connect', () => {
	client.subscribe(CONST.DEVICE_TOPIC, (err) => {if (err) log('MQTT Subscribe fail! -', CONST.DEVICE_TOPIC) });
})

// SerialPort 모듈 초기화
const port = new SerialPort(CONST.portName, {
	baudRate: 9600,
	dataBits: 8,
	parity: 'even',
	stopBits: 1,
	autoOpen: false,
	encoding: 'hex'
});
const parser = port.pipe(new CustomParser());

port.on('open', () => log('Success open port:', CONST.portName));
port.open((err) => {
	if (err) {
		return log('Error opening port:', err.message)
	}
})

//////////////////////////////////////////////////////////////////////////////////////
// 홈넷에서 SerialPort로 상태 정보 수신
var packets = [];

parser.on('data', function (data) {
	//console.log('Receive interval: ', (new Date().getTime())-lastReceive, 'ms ->', data.toString('hex'));
	lastReceive = new Date().getTime();

	if(packets[data]) {
		packets[data]++;
	} else {
		packets[data] = 1;
		// 최초로 발생한 패킷만 출력
		console.log(data.toString('hex'));
	}

	// 첫번째 바이트가 'b0'이면 응답 메시지
	if(data[0] != 0xb0)	return;
	switch (data[1]) {
		case 0x79: case 0x4e: 	// 조명,환풍기 상태 정보
			var objFound = CONST.DEVICE_STATE.find(obj => data.equals(obj.stateHex));
			if(objFound)
				updateStatus(objFound);
			break;
		case 0x7c: 	// 온도조절기 상태 정보
			var objFound = CONST.DEVICE_STATE.find(obj => data.includes(obj.stateHex));	// 메시지 앞부분 매칭(온도부분 제외)
			if(objFound && data.length===8) {		// 메시지 길이 확인
				objFound.setTemp = data[4].toString();		// 설정 온도
				objFound.curTemp = data[5].toString();		// 현재 온도
				updateStatus(objFound);
			}
			break;
		// 제어 명령 Ack 메시지 : 조명, 난방, 난방온도, 환풍기
		case 0x7a: case 0x7d: case 0x7f: case 0x4f:
			// Ack 메시지를 받은 명령은 제어 성공하였으므로 큐에서 삭제
			const ack = Buffer.alloc(3);
			data.copy(ack, 0, 1, 4);
			var objFoundIdx = queue.findIndex(obj => obj.commandHex.includes(ack));
			if(objFoundIdx > -1) {
				log('[Serial] Success command:', data.toString('hex'));
				queue.splice(objFoundIdx, 1);
			}
			break;
		default:
			//log('unknown response : ' + data.toString('hex'));
	}
	
});

//////////////////////////////////////////////////////////////////////////////////////
// MQTT로 HA에 상태값 전송

var updateStatus = (obj) => {
	//log('updateStatus: deviceId[' + obj.deviceId + '], subId[' + obj.subId + '], stateHex[' + obj.stateHex.toString('hex'));

	var arrStateName = Object.keys(obj);
	// 상태값이 아닌 항목들은 제외 [deviceId, subId, stateHex, commandHex, sentTime]
	const arrFilter = ['deviceId', 'subId', 'stateHex', 'commandHex', 'sentTime'];
	arrStateName = arrStateName.filter(stateName => !arrFilter.includes(stateName));
	
	// 상태값별 현재 상태 파악하여 변경되었으면 상태 반영 (MQTT publish)
	arrStateName.forEach( function(stateName) {
		// 상태값이 없거나 상태가 같으면 반영 중지
		var curStatus = homeStatus[obj.deviceId+obj.subId+stateName];
		if(obj[stateName] == null || obj[stateName] === curStatus) return;

		//log('updateStatus: deviceId[' + obj.deviceId + '], subId[' + obj.subId + '], stateHex[' + obj.stateHex.toString('hex'));

		// 미리 상태 반영한 device의 상태 원복 방지
		if(queue.length > 0) {
			var found = queue.find(q => q.deviceId+q.subId === obj.deviceId+obj.subId && q[stateName] === curStatus);
			if(found != null) return;
		}
		// 상태 반영 (MQTT publish)
		homeStatus[obj.deviceId+obj.subId+stateName] = obj[stateName];
		var topic = util.format(CONST.STATE_TOPIC, obj.deviceId, obj.subId, stateName);
		client.publish(topic, obj[stateName], {retain: true});
		log('[MQTT] Send to HA:', topic, '->', obj[stateName]);
	});
}

//////////////////////////////////////////////////////////////////////////////////////
// HA에서 MQTT로 제어 명령 수신
client.on('message', (topic, message) => {
	if(mqttReady) {
		var topics = topic.split('/');
		var value = message.toString(); // message buffer이므로 string으로 변환		
		if(topics[0] === CONST.TOPIC_PRFIX) {
			setValue(topics[1], topics[2], value);
		}
	}
})


var setValue = (deviceSubId, property, value) => {
	log('[setValue] ' + deviceSubId + ' - ' + property + ' : ' + value);
	var objFound = null;

	// 온도설정 명령의 경우 모든 온도를 Hex로 정의해두기에는 많으므로 온도에 따른 시리얼 통신 메시지 생성
	if(property === 'setTemp') {
		objFound = CONST.DEVICE_COMMAND.find(obj => obj.deviceId + obj.subId === deviceSubId && obj.hasOwnProperty('setTemp'));
		objFound.commandHex[3] = Number(value);
		objFound.setTemp = String(Number(value)); // 온도값은 소수점이하는 버림
		var xorSum = objFound.commandHex[0] ^ objFound.commandHex[1] ^ objFound.commandHex[2] ^ objFound.commandHex[3] ^ 0x80
		objFound.commandHex[7] = xorSum; // 마지막 Byte는 XOR SUM
	} 
	// 다른 명령은 미리 정의해놓은 값을 매칭
	else {
		objFound = CONST.DEVICE_COMMAND.find(obj => obj.deviceId+obj.subId === deviceSubId && obj[property] === value);
	}
	
	if(objFound == null) {
		log('No item found.');
		return false;
	}

	// 현재 상태와 같으면 Skip
	if(value === homeStatus[objFound.deviceId + objFound.subId + objFound[property]]) {
		log('Value is not changed. skip.');
		return false;
	} 

	// Serial메시지 제어명령 전송 & MQTT로 상태정보 전송
	log('Add to queue for applying new value.');
	// 최초 실행시 딜레이 없도록 sentTime을 현재시간 보다 sendDelay만큼 이전으로 설정
	objFound.sentTime = (new Date().getTime())-CONST.sendDelay;
	queue.push(objFound);	// 실행 큐에 저장
	updateStatus(objFound); // 처리시간의 Delay때문에 미리 상태 반영
	return true;
}

//////////////////////////////////////////////////////////////////////////////////////
// SerialPort로 제어 명령 전송

const commandProc = () => {
	// 큐에 처리할 메시지가 없으면 종료
	if(queue.length == 0) return;

	// 기존 홈넷 RS485 메시지와 충돌하지 않도록 Delay를 줌
	var delay = (new Date().getTime())-lastReceive;
	if(delay < CONST.sendDelay) return;

	// 큐에서 제어 메시지 가져오기
	var obj = queue.shift();
	port.write(obj.commandHex, (err) => {if(err)  return log('[Serial] Send Error: ', err.message); });
	lastReceive = new Date().getTime();
	obj.sentTime = lastReceive;	// 명령 전송시간 sentTime으로 저장
	log('[Serial] Send to Device:', obj.deviceId, obj.subId, '->', obj.state, '('+delay+'ms) ', obj.commandHex.toString('hex'));
	
	// 다시 큐에 저장하여 Ack 메시지 받을때까지 반복 실행
	queue.push(obj);
}

setTimeout(() => {mqttReady=true; log('MQTT Ready...')}, CONST.mqttDelay);
setInterval(commandProc, 20);

//queue.push(CONST.DEVICE_COMMAND[1]);
//queue.push(CONST.DEVICE_COMMAND[6]);



//////////////////////////////////////////////////////////////////////////////////////
// http를 통한 명령 전달

var app = express();
app.use(express.urlencoded());

http.createServer(app).listen(CONST.httpPort, function(){
	console.log("485server http server listening on port " + CONST.httpPort);
});

// 상태 Topic (/homenet/${deviceId}${subId}/${property}/state/ = ${value})
// 명령어 Topic (/homenet/${deviceId}${subId}/${property}/command/ = ${value})
// TOPIC_PRFIX: 'homenet',
// STATE_TOPIC: 'homenet/%s%s/%s/state', //상태 전달
// DEVICE_TOPIC: 'homenet/+/+/command' //명령 수신


app.get("/", function(req, res) {
	// GET 메소드 /games로 넘어감
	res.redirect(CONST.TOPIC_PRFIX);
});

app.get('/' + CONST.TOPIC_PRFIX, function(req, res) {
	console.log('[' + req.method + '] ' + req.url);
	var result = {};
	if (homeStatus != undefined) {
		res.status(200);
		result.status = res.statusCode;
		result.message = "Success";
		result.homeStatus = homeStatus;
	} else {
		res.status(400);
		result.status = res.statusCode;
		result.message = "No device found";
	}
	res.send(result);
});

app.get('/' + CONST.TOPIC_PRFIX + '/:id/:property', function(req, res) {
	console.log('[' + req.method + '] ' + req.url);
	var result = {};
	var statusName = req.params.id + req.params.property;
	if (homeStatus[statusName] != undefined) {
		res.status(200);
		result.status = res.statusCode;
		result.message = "Success";
		result.homeStatus = {};
		result.homeStatus[statusName] = homeStatus[statusName];
	} else {
		res.status(400);
		result.status = res.statusCode;
		result.message = "No device found";
	}
	res.send(result);
});

app.put('/' + CONST.TOPIC_PRFIX + '/:id/:property/:value', function(req, res) {
	console.log('[' + req.method + '] ' + req.url);
	var ret = setValue(req.params.id, req.params.property, req.params.value);
	var result = {};
	var statusName = req.params.id + req.params.property;
	if (ret && homeStatus[statusName] != undefined) {
		res.status(200);
		result.status = res.statusCode;
		result.message = "Success";
		result.homeStatus = {};
		result.homeStatus[statusName] = homeStatus[statusName];
	} else {
		res.status(400);
		result.status = res.statusCode;
		result.message = "No device found";
	}
	res.send(result);
});
