/**
 * RS485 Homenet server (Samsung SDS)
 * @ 소스 공개 : Daehwan, Kang
 * @ 2019-01-11 erita : 삼성 홈넷용으로 수정
 * @ 2020-02-08 fornever2 : SmartThings용으로 수정
 */

const util = require('util');
const SerialPort = require('serialport');
const mqtt = require('mqtt');
const http = require('http');
const https = require('https');
const express = require('express');
const bodyParser = require('body-parser');
//const fs = require('fs');

var app = express();
app.use(express.urlencoded());
app.use(bodyParser.json());


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
	mqttDelay: 1000 * 10,

	// http port
	httpPort: 8888,

	// 메시지 Prefix 상수
	MSG_PREFIX: [0xb0, 0xac, 0xae, 0xc2, 0xad, 0xab, 0xcc, 0xa1, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6],

	MSG_CATEGORY: [
		{ code: 0xb0, type: 'response' },	// 응답
		{ code: 0xac, type: 'light' },		// 조명
		{ code: 0xae, type: 'heat' },		// 난방
		{ code: 0xc2, type: 'vent' },		// 환기
		{ code: 0xad, type: 'entrance' },	// 현관
		{ code: 0xab, type: 'gas' },			// 가스밸브
		{ code: 0xcc, type: 'unknown' },
		{ code: 0xa1, type: 'unknown' },
		{ code: 0xa2, type: 'unknown' },
		{ code: 0xa3, type: 'unknown' },
		{ code: 0xa4, type: 'unknown' },
		{ code: 0xa5, type: 'unknown' },
		{ code: 0xa6, type: 'unknown' },		
	],

	MSG_CMD: [
		{ code: 0x79, length: 5, category: 'light', cmd: 'getStatus'},					// 조명 상태 요청
		{ code: 0x7a, length: 5, category: 'light', cmd: 'control'},					// 조명 제어 요청
		{ code: 0x7c, length: 8, category: 'heat', cmd: 'getStatus'},					// 난방 상태 요청
		{ code: 0x7d, length: 8, category: 'heat', cmd: 'setMode'},						// 난방 제어 요청
		{ code: 0x7f, length: 8, category: 'heat', cmd: 'setTemperature'},				// 난방 온도 설정 요청
		{ code: 0x4e, length: 6, category: 'vent', cmd: 'getStatus'},					// 환기 상태 요청
		{ code: 0x4f, length: 6, category: 'vent', cmd: 'control'},						// 환기 제어 요청
		{ code: 0x41, length: 4, category: 'entrance', cmd: 'getButtonStatus'},			// 현관 버튼 상태 요청
		{ code: 0x52, length: 4, category: 'entrance', cmd: 'getAllLightStatus'},		// 일괄 조명 상태 요청
		{ code: 0x53, length: 4, category: 'entrance', cmd: 'controlAllLight'},			// 일괄 조명 상태 요청
		{ code: 0x54, length: 4, category: 'entrance', cmd: 'getAllLightButtonStatus'},	// 일괄 조명 버튼 상태 수신
		{ code: 0x55, length: 4, category: 'entrance', cmd: 'getGasButtonStatus'},		// 가스 잠금 버튼 상태 수신
		{ code: 0x56, length: 4, category: 'entrance', cmd: 'getGasButtonStatus'},		// 가스 잠금 버튼 상태 수신
		{ code: 0x2f, length: 4, category: 'entrance', cmd: 'getElevatorButtonStatus'},	// 엘리베이터 버튼 상태 수신
		{ code: 0x41, length: 4, category: 'gas', cmd: 'getGasValveStatus'},			// 가스밸브 상태 요청
		{ code: 0x78, length: 4, category: 'gas', cmd: 'lockGasValve'},					// 가스밸브 잠금 요청
	],

	// 기기별 상태 및 제어 코드(HEX)
	DEVICE_STATE: [
		// 전등 갯수가 3개인 경우
		//{deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(5,'b079310078','hex'), power1: 'off', power2: 'off', power3: 'off'}, //상태-00
		//{deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(5,'b079310179','hex'), power1: 'on' , power2: 'off', power3: 'off'}, //상태-01
		//{deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(5,'b07931027a','hex'), power1: 'off', power2: 'on' , power3: 'off'}, //상태-02
		//{deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(5,'b07931037b','hex'), power1: 'on' , power2: 'on' , power3: 'off'}, //상태-03
		//{deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(5,'b07931047c','hex'), power1: 'off', power2: 'off', power3: 'on' }, //상태-04
		//{deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(5,'b07931057d','hex'), power1: 'on' , power2: 'off', power3: 'on' }, //상태-05
		//{deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(5,'b07931067e','hex'), power1: 'off', power2: 'on' , power3: 'on' }, //상태-06
		//{deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(5,'b07931077f','hex'), power1: 'on' , power2: 'on' , power3: 'on' }, //상태-07
		// 전등 갯수가 2개인경우
		// { deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(5, 'b079210068', 'hex'), power1: 'off', power2: 'off' }, //상태-00
		// { deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(5, 'b079210169', 'hex'), power1: 'on', power2: 'off' }, //상태-01
		// { deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(5, 'b07921026a', 'hex'), power1: 'off', power2: 'on' }, //상태-02
		// { deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(5, 'b07921036b', 'hex'), power1: 'on', power2: 'on' }, //상태-03
		// 수정
		{ deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(5, 'b079210068', 'hex'), switch: 'off' }, //상태-00
		{ deviceId: 'Light', subId: '2', stateHex: Buffer.alloc(5, 'b079210068', 'hex'), switch: 'off' }, //상태-00
		{ deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(5, 'b079210169', 'hex'), switch: 'on' }, //상태-01
		{ deviceId: 'Light', subId: '2', stateHex: Buffer.alloc(5, 'b079210169', 'hex'), switch: 'off' }, //상태-01
		{ deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(5, 'b07921026a', 'hex'), switch: 'off' }, //상태-02
		{ deviceId: 'Light', subId: '2', stateHex: Buffer.alloc(5, 'b07921026a', 'hex'), switch: 'on' }, //상태-02
		{ deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(5, 'b07921036b', 'hex'), switch: 'on' }, //상태-03
		{ deviceId: 'Light', subId: '2', stateHex: Buffer.alloc(5, 'b07921036b', 'hex'), switch: 'on' }, //상태-03
		// 환풍기
		// { deviceId: 'Fan', subId: '1', stateHex: Buffer.alloc(6, 'b04e0300017c', 'hex'), power: 'off', speed: 'low' },
		// { deviceId: 'Fan', subId: '1', stateHex: Buffer.alloc(6, 'b04e0200017d', 'hex'), power: 'off', speed: 'mid' },
		// { deviceId: 'Fan', subId: '1', stateHex: Buffer.alloc(6, 'b04e0100017e', 'hex'), power: 'off', speed: 'high' },
		// { deviceId: 'Fan', subId: '1', stateHex: Buffer.alloc(6, 'b04e0300007d', 'hex'), power: 'on', speed: 'low' },
		// { deviceId: 'Fan', subId: '1', stateHex: Buffer.alloc(6, 'b04e0200007c', 'hex'), power: 'on', speed: 'mid' },
		// { deviceId: 'Fan', subId: '1', stateHex: Buffer.alloc(6, 'b04e0100007f', 'hex'), power: 'on', speed: 'high' },
		// 난방
		{ deviceId: 'Thermo', subId: '1', stateHex: Buffer.alloc(4, 'b07c0101', 'hex'), power: 'heat', setTemp: '', curTemp: '' },	// 거실
		{ deviceId: 'Thermo', subId: '1', stateHex: Buffer.alloc(4, 'b07c0100', 'hex'), power: 'off', setTemp: '', curTemp: '' },	// 거실
		{ deviceId: 'Thermo', subId: '2', stateHex: Buffer.alloc(4, 'b07c0201', 'hex'), power: 'heat', setTemp: '', curTemp: '' },
		{ deviceId: 'Thermo', subId: '2', stateHex: Buffer.alloc(4, 'b07c0200', 'hex'), power: 'off', setTemp: '', curTemp: '' },
		{ deviceId: 'Thermo', subId: '3', stateHex: Buffer.alloc(4, 'b07c0301', 'hex'), power: 'heat', setTemp: '', curTemp: '' },	// 침실 1
		{ deviceId: 'Thermo', subId: '3', stateHex: Buffer.alloc(4, 'b07c0300', 'hex'), power: 'off', setTemp: '', curTemp: '' },	// 침실 1
		{ deviceId: 'Thermo', subId: '4', stateHex: Buffer.alloc(4, 'b07c0401', 'hex'), power: 'heat', setTemp: '', curTemp: '' },	// 침실 2
		{ deviceId: 'Thermo', subId: '4', stateHex: Buffer.alloc(4, 'b07c0400', 'hex'), power: 'off', setTemp: '', curTemp: '' },	// 침실 2
		{ deviceId: 'Thermo', subId: '5', stateHex: Buffer.alloc(4, 'b07c0501', 'hex'), power: 'heat', setTemp: '', curTemp: '' },	// 침실 3
		{ deviceId: 'Thermo', subId: '5', stateHex: Buffer.alloc(4, 'b07c0500', 'hex'), power: 'off', setTemp: '', curTemp: '' }	// 침실 3
	],

	DEVICE_COMMAND: [
		// 전등 갯수가 3개인 경우
		//{deviceId: 'Light', subId: '1', commandHex: Buffer.alloc(5,'ac7a010057','hex'), power1: 'off'}, //거실1--off
		//{deviceId: 'Light', subId: '1', commandHex: Buffer.alloc(5,'ac7a010156','hex'), power1: 'on' }, //거실1--on
		//{deviceId: 'Light', subId: '1', commandHex: Buffer.alloc(5,'ac7a020054','hex'), power2: 'off'}, //거실2--off
		//{deviceId: 'Light', subId: '1', commandHex: Buffer.alloc(5,'ac7a020155','hex'), power2: 'on' }, //거실2--on
		//{deviceId: 'Light', subId: '1', commandHex: Buffer.alloc(5,'ac7a030055','hex'), power3: 'off'}, //거실3--off
		//{deviceId: 'Light', subId: '1', commandHex: Buffer.alloc(5,'ac7a030154','hex'), power3: 'on' }, //거실3--on
		// 전등 갯수가 2개인경우
		// { deviceId: 'Light', subId: '1', commandHex: Buffer.alloc(5, 'ac7a010057', 'hex'), power1: 'off' }, //거실1--off
		// { deviceId: 'Light', subId: '1', commandHex: Buffer.alloc(5, 'ac7a010156', 'hex'), power1: 'on' }, //거실1--on
		// { deviceId: 'Light', subId: '1', commandHex: Buffer.alloc(5, 'ac7a020054', 'hex'), power2: 'off' }, //거실2--off
		// { deviceId: 'Light', subId: '1', commandHex: Buffer.alloc(5, 'ac7a020155', 'hex'), power2: 'on' }, //거실2--on
		// 수정 - fornever2
		{ deviceId: 'Light', subId: '1', commandHex: Buffer.alloc(5, 'ac7a010057', 'hex'), switch: 'off' }, //거실1--off
		{ deviceId: 'Light', subId: '1', commandHex: Buffer.alloc(5, 'ac7a010156', 'hex'), switch: 'on' }, //거실1--on
		{ deviceId: 'Light', subId: '2', commandHex: Buffer.alloc(5, 'ac7a020054', 'hex'), switch: 'off' }, //거실2--off
		{ deviceId: 'Light', subId: '2', commandHex: Buffer.alloc(5, 'ac7a020155', 'hex'), switch: 'on' }, //거실2--on
		// 환풍기
		// { deviceId: 'Fan', subId: '1', commandHex: Buffer.alloc(6, 'c24f05000008', 'hex'), power: 'on' }, //켜짐
		// { deviceId: 'Fan', subId: '1', commandHex: Buffer.alloc(6, 'c24f0600000b', 'hex'), power: 'off' }, //꺼짐
		// { deviceId: 'Fan', subId: '1', commandHex: Buffer.alloc(6, 'c24f0300000e', 'hex'), speed: 'low' }, //약(켜짐)
		// { deviceId: 'Fan', subId: '1', commandHex: Buffer.alloc(6, 'c24f0200000f', 'hex'), speed: 'medium' }, //중(켜짐)
		// { deviceId: 'Fan', subId: '1', commandHex: Buffer.alloc(6, 'c24f0100000c', 'hex'), speed: 'high' }, //강(켜짐)
		// 난방
		{ deviceId: 'Thermo', subId: '1', commandHex: Buffer.alloc(8, 'ae7d010100000053', 'hex'), power: 'heat' }, // 온도조절기1-on
		{ deviceId: 'Thermo', subId: '1', commandHex: Buffer.alloc(8, 'ae7d010000000052', 'hex'), power: 'off' }, // 온도조절기1-off
		{ deviceId: 'Thermo', subId: '2', commandHex: Buffer.alloc(8, 'ae7d020100000050', 'hex'), power: 'heat' },
		{ deviceId: 'Thermo', subId: '2', commandHex: Buffer.alloc(8, 'ae7d020000000051', 'hex'), power: 'off' },
		{ deviceId: 'Thermo', subId: '3', commandHex: Buffer.alloc(8, 'ae7d030100000051', 'hex'), power: 'heat' },
		{ deviceId: 'Thermo', subId: '3', commandHex: Buffer.alloc(8, 'ae7d030000000050', 'hex'), power: 'off' },
		{ deviceId: 'Thermo', subId: '4', commandHex: Buffer.alloc(8, 'ae7d040100000056', 'hex'), power: 'heat' },
		{ deviceId: 'Thermo', subId: '4', commandHex: Buffer.alloc(8, 'ae7d040000000057', 'hex'), power: 'off' },
		{ deviceId: 'Thermo', subId: '5', commandHex: Buffer.alloc(8, 'ae7d050100000057', 'hex'), power: 'heat' },
		{ deviceId: 'Thermo', subId: '5', commandHex: Buffer.alloc(8, 'ae7d050000000056', 'hex'), power: 'off' },
		{ deviceId: 'Thermo', subId: '1', commandHex: Buffer.alloc(8, 'ae7f01FF000000FF', 'hex'), setTemp: '' }, // 온도조절기1-온도설정
		{ deviceId: 'Thermo', subId: '2', commandHex: Buffer.alloc(8, 'ae7f02FF000000FF', 'hex'), setTemp: '' },
		{ deviceId: 'Thermo', subId: '3', commandHex: Buffer.alloc(8, 'ae7f03FF000000FF', 'hex'), setTemp: '' },
		{ deviceId: 'Thermo', subId: '4', commandHex: Buffer.alloc(8, 'ae7f04FF000000FF', 'hex'), setTemp: '' },
		{ deviceId: 'Thermo', subId: '5', commandHex: Buffer.alloc(8, 'ae7f05FF000000FF', 'hex'), setTemp: '' }
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

CustomParser.prototype._transform = function (chunk, encoding, done) {
	var start = 0;
	for (var i = 0; i < chunk.length; i++) {
		if (CONST.MSG_PREFIX.includes(chunk[i])) {			// 청크에 구분자(MSG_PREFIX)가 있으면
			this._queueChunk.push(chunk.slice(start, i));	// 구분자 앞부분을 큐에 저장하고
			this.push(Buffer.concat(this._queueChunk));	// 큐에 저장된 메시지들 합쳐서 내보냄
			this._queueChunk = [];	// 큐 초기화
			this._msgLenCount = 0;
			start = i;
			this._msgTypeFlag = true;	// 다음 바이트는 메시지 종류
		}
		// 메시지 종류에 따른 메시지 길이 파악
		else if (this._msgTypeFlag) {
			switch (chunk[i]) {
				case 0x41: case 0x52: case 0x53: case 0x54: case 0x55: case 0x56: case 0x78: case 0x2f:
					this._msgLength = 4; break;
				case 0x79: case 0x7A:
					this._msgLength = 5; break;
				case 0x4e: case 0x4f:
					this._msgLength = 6; break;
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
	if (this._msgLenCount >= this._msgLength) {
		this.push(Buffer.concat(this._queueChunk));	// 큐에 저장된 메시지들 합쳐서 내보냄
		this._queueChunk = [];	// 큐 초기화
		this._msgLenCount = 0;
	}

	done();
};
//////////////////////////////////////////////////////////////////////////////////////


// 로그 표시 
var log = (...args) => console.log('[' + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + ']', args.join(' '));

//////////////////////////////////////////////////////////////////////////////////////
// 홈컨트롤 상태
var homeStatus = {};
var deviceStatus = [];
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


var filterList = [
	"cc4101000c",
	"b041010070",
	"a15a007b",
	"a25a0078",
	"a35a0079",
	"a45a007e",
	"a5410064",
	"b0410071",
	"a6410067",
	"ab41006a",
	"b0410170",
	"ac41006d",
	"ae7c030000000051",
	"b07c03011819ff30",
	"b07c01011819ff32",
	"ac79000154",
	"b079210068",
	"b00c01003d",
	"a25a0078",
	"a45a007e",
	"ae7c040000000056",
	"b07c04011819ff37",
	"cc0c010041",
	"ae7c050000000057",
	"b07c05011818ff37",
	"cc0b0300030047",
	"b00b01003a",
	"ae7c010000000053",
	"b07921026a",
];


parser.on('data', function (data) {
	//console.log('Receive interval: ', (new Date().getTime())-lastReceive, 'ms ->', data.toString('hex'));
	lastReceive = new Date().getTime();

	if (filterList.includes(data.toString('hex'))) {
		//log("Filtered Packet : ", data.toString('hex'))
	} else {
		log("Not filtered Packet : ", data.toString('hex'))
	}

	if(packets[data]) {
		packets[data]++;
	} else {
		packets[data] = 1;
		// 최초로 발생한 패킷만 출력
		log("[Serial] New packet : ", data.toString('hex'))
	}

	// 첫번째 바이트가 'b0'이면 응답 메시지
	if(data[0] != 0xb0)	return;
	switch (data[1]) {
		case 0x79: 	// 조명 상태 정보
			var objFoundArr = CONST.DEVICE_STATE.filter(obj => data.equals(obj.stateHex));
			objFoundArr.forEach(function(objFound) {
				updateStatus(objFound);
			});
			break;
		case 0x4e: 	// 환풍기 상태 정보
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
		if(obj[stateName] == null || obj[stateName] === curStatus) {
			//log('The status is same as before... skip...');
			return;
		}

		//log('updateStatus: deviceId[' + obj.deviceId + '], subId[' + obj.subId + '], stateHex[' + obj.stateHex.toString('hex') + ']');

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

		// (SmartThings send event)
		updateSTDeviceProperty(obj.deviceId, obj.subId, stateName, obj[stateName]);
	});
}

var STInfo = undefined;

function updateSTDeviceProperty(deviceId, subId, propertyName, propertyValue) {
	var device = deviceStatus.find(o => (o.id === deviceId) && (o.subId === subId));
	if (!device) {
		var len = deviceStatus.push({
			type: deviceId,
			id: deviceId + subId,
			uri: '/' + CONST.TOPIC_PRFIX + '/' + deviceId + subId,
			property: {}
		});
		device = deviceStatus[len - 1];
	}
	device.property[propertyName] = propertyValue;

	// TODO : Send to ST
	// {
	// 	"app_url":"https://graph-ap02-apnortheast2.api.smartthings.com:443/api/smartapps/installations/",
	// 	"app_id":"cd8a522f-40ad-4708-8a9d-c268f3167e8e",
	// 	"access_token":"695e0875-aa0f-4f41-af29-ddd3c604f189"
	// }
	if (STInfo) {
		let req_data = JSON.stringify({
			data: 'hahaha'
		});
		const req = https.get(STInfo.app_url + '/list' + '?access_token=' + STInfo.access_token, (resp) => {
			let data = '';
	
			// A chunk of data has been recieved.
			resp.on('data', (chunk) => {
				data += chunk;
			});
	
			// The whole response has been received. Print out the result.
			resp.on('end', () => {
				console.log(JSON.parse(data).explanation);
			});
	
		});
		
		req.on("error", (err) => {
			console.log("Error: " + err.message);
		});

		req.write(req_data);
		req.end();
	}
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
	if (property === 'setTemp') {
		objFound = CONST.DEVICE_COMMAND.find(obj => obj.deviceId + obj.subId === deviceSubId && obj.hasOwnProperty('setTemp'));
		objFound.commandHex[3] = Number(value);
		objFound.setTemp = String(Number(value)); // 온도값은 소수점이하는 버림
		var xorSum = objFound.commandHex[0] ^ objFound.commandHex[1] ^ objFound.commandHex[2] ^ objFound.commandHex[3] ^ 0x80
		objFound.commandHex[7] = xorSum; // 마지막 Byte는 XOR SUM
	}
	// Light의 경우 하나의 deviceId + subId로 여러개의 light를 제어하므로 변환로직 필요
	// else if (deviceSubId === 'Light1' && property === 'switch') {
	// 	objFound = CONST.DEVICE_COMMAND.find(obj => obj.deviceId + obj.subId === 'Light1' && obj['power1'] === value);
	// }
	// else if (deviceSubId === 'Light2' && property === 'switch') {
	// 	objFound = CONST.DEVICE_COMMAND.find(obj => obj.deviceId + obj.subId === 'Light1' && obj['power2'] === value);
	// }
	// 다른 명령은 미리 정의해놓은 값을 매칭
	else {
		objFound = CONST.DEVICE_COMMAND.find(obj => obj.deviceId + obj.subId === deviceSubId && obj[property] === value);
	}

	if (objFound == null) {
		throw new Error("Can not find command");
	}

	// 현재 상태와 같으면 Skip
	if (value === homeStatus[objFound.deviceId + objFound.subId + objFound[property]]) {
		log('Value is not changed. skip.');
		return;
	}

	// Serial메시지 제어명령 전송 & MQTT로 상태정보 전송
	log('Add to queue for applying new value.');
	// 최초 실행시 딜레이 없도록 sentTime을 현재시간 보다 sendDelay만큼 이전으로 설정
	objFound.sentTime = (new Date().getTime()) - CONST.sendDelay;
	queue.push(objFound);	// 실행 큐에 저장
	updateStatus(objFound); // 처리시간의 Delay때문에 미리 상태 반영
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
// Test

function sendCmd(cmdHex)
{
	var buf = Buffer.alloc(cmdHex.length / 2, cmdHex, 'hex')
	port.write(buf, (err) => {if(err)  return log('[Serial] Send Error: ', err.message); });
	log('[Serial] Send cmd : ', buf.toString('hex'));
}

setTimeout(() => {
	sendCmd('b008010039a15a007b');
}, 5000);
setTimeout(() => {
	sendCmd('b008010138a15a007b');
}, 6000);



//////////////////////////////////////////////////////////////////////////////////////
// http를 통한 명령 전달
http.createServer(app).listen(CONST.httpPort, function () {
	console.log("485server http server listening on port " + CONST.httpPort);
});

// 상태 Topic (/homenet/${deviceId}${subId}/${property}/state/ = ${value})
// 명령어 Topic (/homenet/${deviceId}${subId}/${property}/command/ = ${value})
// TOPIC_PRFIX: 'homenet',
// STATE_TOPIC: 'homenet/%s%s/%s/state', //상태 전달
// DEVICE_TOPIC: 'homenet/+/+/command' //명령 수신


app.get("/", function (req, res) {
	// GET 메소드 /games로 넘어감
	res.redirect(CONST.TOPIC_PRFIX);
});

app.get('/' + CONST.TOPIC_PRFIX, function (req, res) {
	log('[' + req.method + '] ' + req.url);
	var result = {};
	try {
		if (!deviceStatus || deviceStatus.length == 0) {
			throw new Error('No device found');
		}
		result.message = deviceStatus;
		res.status(200);
	} catch (e) {
		result.message = e.toString();
		res.status(400);
	}
	result.status = res.statusCode;
	log('[result] : ' + JSON.stringify(result));
	res.send(result);
});

app.get('/' + CONST.TOPIC_PRFIX + '/:id', function (req, res) {
	log('[' + req.method + '] ' + req.url);
	var result = {};
	try {
		result.message = getDeviceStatus(req.params.id);
		res.status(200);
	} catch (e) {
		result.message = e.toString();
		res.status(400);
	}
	result.status = res.statusCode;
	log('[result] : ' + JSON.stringify(result));
	res.send(result);
});

app.get('/' + CONST.TOPIC_PRFIX + '/:id/:property', function (req, res) {
	log('[' + req.method + '] ' + req.url);
	var result = {};
	try {
		result.message = getPropertyStatus(req.params.id, req.params.property);
		res.status(200);
	} catch (e) {
		result.message = e.toString();
		res.status(400);
	}
	result.status = res.statusCode;
	log('[result] : ' + JSON.stringify(result));
	res.send(result);
});

app.put('/' + CONST.TOPIC_PRFIX + '/:id/:property/:value', function (req, res) {
	log('[' + req.method + '] ' + req.url);
	var result = {};
	try {
		setValue(req.params.id, req.params.property, req.params.value);
		result.message = "Success"//getPropertyStatus(req.params.id, req.params.property);
		res.status(200);
	} catch (e) {
		result.message = e.toString();
		res.status(400);
	}
	result.status = res.statusCode;
	log('[result] : ' + JSON.stringify(result));
	res.send(result);
});

// serial로 message 전달
app.put('/' + CONST.TOPIC_PRFIX + '/serial/:cmd', function (req, res) {
	log('[' + req.method + '] ' + req.url);
	var result = {};
	try {
		sendCmd(req.params.cmd);
		result.message = "Success"
		res.status(200);
	} catch (e) {
		result.message = e.toString();
		res.status(400);
	}
	result.status = res.statusCode;
	log('[result] : ' + JSON.stringify(result));
	res.send(result);
});

app.post('/' + CONST.TOPIC_PRFIX + '/smartthings/initialize', function (req, res) {
	log('[' + req.method + '] ' + req.url);
	log('body : ' + JSON.stringify(req.body));
	// body : 
	// {
	// 	"app_url":"https://graph-ap02-apnortheast2.api.smartthings.com:443/api/smartapps/installations/",
	// 	"app_id":"cd8a522f-40ad-4708-8a9d-c268f3167e8e",
	// 	"access_token":"695e0875-aa0f-4f41-af29-ddd3c604f189"
	// }
	STInfo = req.body;

	var result = {};
	// try {
	// 	setValue(req.params.id, req.params.property, req.params.value);
	// 	result.message = "Success"//getPropertyStatus(req.params.id, req.params.property);
	// 	res.status(200);
	// } catch (e) {
	// 	result.message = e.toString();
	// 	res.status(400);
	// }

	res.status(200);

	result.status = res.statusCode;
	log('[result] : ' + JSON.stringify(result));
	res.send(result);
});

function getDeviceStatus(id) {
	var deviceFound = deviceStatus.find((e) => e.id === id);
	if (!deviceFound) {
		throw new Error('No device found');
	}
	return deviceFound;
}

function getPropertyStatus(id, propertyName) {
	var property = {};
	property[propertyName] = getDeviceStatus(id).property[propertyName];
	if (!property[propertyName]) {
		throw new Error('No property found');
	}
	return property;
}

// var deviceStatus = [
// 	{
// 		"id": "Light1",
// 		"type": "Light",
// 		"status": {
// 			"switch": "on"
// 		}
// 	},
// 	{
// 		"id": "Light2",
// 		"type": "Light",
// 		"status": {
// 			"switch": "on"
// 		}
// 	},
// 	{
// 		"id": "Thermo1",
// 		"type": "Thermostat",
// 		"status": {
// 			"power": "heat",
// 			"setTemp": "25",
// 			"curTemp": "22"
// 		}
// 	},
// 	{
// 		"id": "Thermo2",
// 		"type": "Thermostat",
// 		"status": {
// 			"power": "off",
// 			"setTemp": "26",
// 			"curTemp": "21"
// 		}
// 	},
// 	{
// 		"id": "Thermo3",
// 		"type": "Thermostat",
// 		"status": {
// 			"power": "off",
// 			"setTemp": "25",
// 			"curTemp": "22"
// 		}
// 	}
// ];

// ## capabilities : https://docs.smartthings.com/en/latest/capabilities-reference.html#
// light
// thermostatMode
// thermostatHeatingSetpoint (number)

//{deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(5,'b079310179','hex'), power1: 'on' , power2: 'off', power3: 'off'}, //상태-01
//{ deviceId: 'Thermo', subId: '1', stateHex: Buffer.alloc(4, 'b07c0101', 'hex'), power: 'heat', setTemp: '', curTemp: '' },

// function addDevice(device) {
// 	console.log(device);
// 	//deviceStatus
// 	//var objFound = CONST.DEVICE_STATE.find(obj => data.equals(obj.stateHex));
// 	deviceStatus.push(device);
// }

// addDevice(CONST.DEVICE_STATE[0]);
// addDevice(CONST.DEVICE_STATE[1]);
// addDevice(CONST.DEVICE_STATE[2]);
// addDevice(CONST.DEVICE_STATE[3]);
// addDevice(CONST.DEVICE_STATE[4]);
// addDevice(CONST.DEVICE_STATE[5]);
// addDevice(CONST.DEVICE_STATE[6]);
// addDevice(CONST.DEVICE_STATE[7]);
// addDevice(CONST.DEVICE_STATE[8]);
// addDevice(CONST.DEVICE_STATE[9]);

