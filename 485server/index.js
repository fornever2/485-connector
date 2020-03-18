/**
 * RS485 Homenet server (Samsung SDS)
 * @ 소스 공개 : Daehwan, Kang
 * @ 2019-01-11 erita : 삼성 홈넷용으로 수정
 * @ 2020-02-08 fornever2 : SmartThings용으로 수정
 */

const util = require('util');
const Transform = require('stream').Transform;
const serialport = require('serialport');
const mqtt = require('mqtt');
const http = require('http');
const https = require('https');
const express = require('express');
const fs = require('fs');

// 로그 표시 
const log = (...args) => console.log('[' + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + ']', args.join(' '));

//////////////////////////////////////////////////////////////////////////////////////
const CONST = {
	// SerialPort 이름 설정
	SERIAL_PORT_NAME: process.platform.startsWith('win') ? "COM6" : "/dev/ttyUSB0",
	// SerialPort 전송 Delay(ms)
	SERIAL_SEND_DELAY: 80,
	// MQTT 수신 Delay(ms)
	SERIAL_READY_DELAY: 1000 * 10,

	// MQTT 브로커
	MQTT_BROKER: 'mqtt://192.168.219.150',
	MQTT_CLIENTID: 'Samsung-Homenet',
	// MQTT Topic template
	MQTT_TOPIC_PRFIX: 'homenet',
	MQTT_STATE_TOPIC: 'homenet/%s/%s/state', // 상태 전달 (/homenet/${deviceId}/${property}/state/ = ${value})
	MQTT_DEVICE_TOPIC: 'homenet/+/+/command', // 명령 수신 (/homenet/${deviceId}/${property}/command/ = ${value})

	// http port
	HTTP_PORT: 8080,

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
		//{deviceId: 'Light1', type: 'Light', stateHex: Buffer.alloc(5,'b079310078','hex'), property: { power1: 'off', power2: 'off', power3: 'off' } }, //상태-00
		//{deviceId: 'Light1', type: 'Light', stateHex: Buffer.alloc(5,'b079310179','hex'), property: { power1: 'on' , power2: 'off', power3: 'off' } }, //상태-01
		//{deviceId: 'Light1', type: 'Light', stateHex: Buffer.alloc(5,'b07931027a','hex'), property: { power1: 'off', power2: 'on' , power3: 'off' } }, //상태-02
		//{deviceId: 'Light1', type: 'Light', stateHex: Buffer.alloc(5,'b07931037b','hex'), property: { power1: 'on' , power2: 'on' , power3: 'off' } }, //상태-03
		//{deviceId: 'Light1', type: 'Light', stateHex: Buffer.alloc(5,'b07931047c','hex'), property: { power1: 'off', power2: 'off', power3: 'on'  } }, //상태-04
		//{deviceId: 'Light1', type: 'Light', stateHex: Buffer.alloc(5,'b07931057d','hex'), property: { power1: 'on' , power2: 'off', power3: 'on'  } }, //상태-05
		//{deviceId: 'Light1', type: 'Light', stateHex: Buffer.alloc(5,'b07931067e','hex'), property: { power1: 'off', power2: 'on' , power3: 'on'  } }, //상태-06
		//{deviceId: 'Light1', type: 'Light', stateHex: Buffer.alloc(5,'b07931077f','hex'), property: { power1: 'on' , power2: 'on' , power3: 'on'  } }, //상태-07
		// 전등 갯수가 2개인경우
		// { deviceId: 'Light1', type: 'Light', stateHex: Buffer.alloc(5, 'b079210068', 'hex'), property: { power1: 'off', power2: 'off'  } }, //상태-00
		// { deviceId: 'Light1', type: 'Light', stateHex: Buffer.alloc(5, 'b079210169', 'hex'), property: { power1: 'on', power2: 'off'  } }, //상태-01
		// { deviceId: 'Light1', type: 'Light', stateHex: Buffer.alloc(5, 'b07921026a', 'hex'), property: { power1: 'off', power2: 'on'  } }, //상태-02
		// { deviceId: 'Light1', type: 'Light', stateHex: Buffer.alloc(5, 'b07921036b', 'hex'), property: { power1: 'on', power2: 'on'  } }, //상태-03
		// 수정
		{ deviceId: 'Light1', type: 'Light', stateHex: Buffer.alloc(5, 'b079210068', 'hex'), property: { switch: 'off'  } }, //상태-00
		{ deviceId: 'Light2', type: 'Light', stateHex: Buffer.alloc(5, 'b079210068', 'hex'), property: { switch: 'off'  } }, //상태-00
		{ deviceId: 'Light1', type: 'Light', stateHex: Buffer.alloc(5, 'b079210169', 'hex'), property: { switch: 'on'  } }, //상태-01
		{ deviceId: 'Light2', type: 'Light', stateHex: Buffer.alloc(5, 'b079210169', 'hex'), property: { switch: 'off'  } }, //상태-01
		{ deviceId: 'Light1', type: 'Light', stateHex: Buffer.alloc(5, 'b07921026a', 'hex'), property: { switch: 'off'  } }, //상태-02
		{ deviceId: 'Light2', type: 'Light', stateHex: Buffer.alloc(5, 'b07921026a', 'hex'), property: { switch: 'on'  } }, //상태-02
		{ deviceId: 'Light1', type: 'Light', stateHex: Buffer.alloc(5, 'b07921036b', 'hex'), property: { switch: 'on'  } }, //상태-03
		{ deviceId: 'Light2', type: 'Light', stateHex: Buffer.alloc(5, 'b07921036b', 'hex'), property: { switch: 'on'  } }, //상태-03
		// 환풍기
		// { deviceId: 'Fan1', type: 'Fan', stateHex: Buffer.alloc(6, 'b04e0300017c', 'hex'), property: { power: 'off', speed: 'low'  } },
		// { deviceId: 'Fan1', type: 'Fan', stateHex: Buffer.alloc(6, 'b04e0200017d', 'hex'), property: { power: 'off', speed: 'mid'  } },
		// { deviceId: 'Fan1', type: 'Fan', stateHex: Buffer.alloc(6, 'b04e0100017e', 'hex'), property: { power: 'off', speed: 'high'  } },
		// { deviceId: 'Fan1', type: 'Fan', stateHex: Buffer.alloc(6, 'b04e0300007d', 'hex'), property: { power: 'on', speed: 'low'  } },
		// { deviceId: 'Fan1', type: 'Fan', stateHex: Buffer.alloc(6, 'b04e0200007c', 'hex'), property: { power: 'on', speed: 'mid'  } },
		// { deviceId: 'Fan1', type: 'Fan', stateHex: Buffer.alloc(6, 'b04e0100007f', 'hex'), property: { power: 'on', speed: 'high'  } },
		// 난방
		{ deviceId: 'Thermo1', type: 'Thermo', stateHex: Buffer.alloc(4, 'b07c0101', 'hex'), property: { mode: 'heat', setTemp: '', curTemp: ''  } },	// 거실
		{ deviceId: 'Thermo1', type: 'Thermo', stateHex: Buffer.alloc(4, 'b07c0100', 'hex'), property: { mode: 'off', setTemp: '', curTemp: ''  } },	// 거실
		{ deviceId: 'Thermo2', type: 'Thermo', stateHex: Buffer.alloc(4, 'b07c0201', 'hex'), property: { mode: 'heat', setTemp: '', curTemp: ''  } },
		{ deviceId: 'Thermo2', type: 'Thermo', stateHex: Buffer.alloc(4, 'b07c0200', 'hex'), property: { mode: 'off', setTemp: '', curTemp: ''  } },
		{ deviceId: 'Thermo3', type: 'Thermo', stateHex: Buffer.alloc(4, 'b07c0301', 'hex'), property: { mode: 'heat', setTemp: '', curTemp: '' } },	// 침실 1
		{ deviceId: 'Thermo3', type: 'Thermo', stateHex: Buffer.alloc(4, 'b07c0300', 'hex'), property: { mode: 'off', setTemp: '', curTemp: '' } },	// 침실 1
		{ deviceId: 'Thermo4', type: 'Thermo', stateHex: Buffer.alloc(4, 'b07c0401', 'hex'), property: { mode: 'heat', setTemp: '', curTemp: '' } },	// 침실 2
		{ deviceId: 'Thermo4', type: 'Thermo', stateHex: Buffer.alloc(4, 'b07c0400', 'hex'), property: { mode: 'off', setTemp: '', curTemp: '' } },	// 침실 2
		{ deviceId: 'Thermo5', type: 'Thermo', stateHex: Buffer.alloc(4, 'b07c0501', 'hex'), property: { mode: 'heat', setTemp: '', curTemp: '' } },	// 침실 3
		{ deviceId: 'Thermo5', type: 'Thermo', stateHex: Buffer.alloc(4, 'b07c0500', 'hex'), property: { mode: 'off', setTemp: '', curTemp: '' } }	// 침실 3
	],

	DEVICE_COMMAND: [
		// 전등 갯수가 3개인 경우
		//{deviceId: 'Light1', type: 'Light', commandHex: Buffer.alloc(5,'ac7a010057','hex'), property: { power1: 'off'} }, //거실1--off
		//{deviceId: 'Light1', type: 'Light', commandHex: Buffer.alloc(5,'ac7a010156','hex'), property: { power1: 'on' } }, //거실1--on
		//{deviceId: 'Light1', type: 'Light', commandHex: Buffer.alloc(5,'ac7a020054','hex'), property: { power2: 'off'} }, //거실2--off
		//{deviceId: 'Light1', type: 'Light', commandHex: Buffer.alloc(5,'ac7a020155','hex'), property: { power2: 'on' } }, //거실2--on
		//{deviceId: 'Light1', type: 'Light', commandHex: Buffer.alloc(5,'ac7a030055','hex'), property: { power3: 'off'} }, //거실3--off
		//{deviceId: 'Light1', type: 'Light', commandHex: Buffer.alloc(5,'ac7a030154','hex'), property: { power3: 'on' } }, //거실3--on
		// 전등 갯수가 2개인경우
		// { deviceId: 'Light1', type: 'Light', commandHex: Buffer.alloc(5, 'ac7a010057', 'hex'), property: { power1: 'off' } }, //거실1--off
		// { deviceId: 'Light1', type: 'Light', commandHex: Buffer.alloc(5, 'ac7a010156', 'hex'), property: { power1: 'on' } }, //거실1--on
		// { deviceId: 'Light1', type: 'Light', commandHex: Buffer.alloc(5, 'ac7a020054', 'hex'), property: { power2: 'off' } }, //거실2--off
		// { deviceId: 'Light1', type: 'Light', commandHex: Buffer.alloc(5, 'ac7a020155', 'hex'), property: { power2: 'on' } }, //거실2--on
		// 수정 - fornever2
		{ deviceId: 'Light1', type: 'Light', commandHex: Buffer.alloc(5, 'ac7a010057', 'hex'), property: { switch: 'off' } }, //거실1--off
		{ deviceId: 'Light1', type: 'Light', commandHex: Buffer.alloc(5, 'ac7a010156', 'hex'), property: { switch: 'on' } }, //거실1--on
		{ deviceId: 'Light2', type: 'Light', commandHex: Buffer.alloc(5, 'ac7a020054', 'hex'), property: { switch: 'off' } }, //거실2--off
		{ deviceId: 'Light2', type: 'Light', commandHex: Buffer.alloc(5, 'ac7a020155', 'hex'), property: { switch: 'on' } }, //거실2--on
		// 환풍기
		// { deviceId: 'Fan1', type: 'Fan', commandHex: Buffer.alloc(6, 'c24f05000008', 'hex'), property: { power: 'on' } }, //켜짐
		// { deviceId: 'Fan1', type: 'Fan', commandHex: Buffer.alloc(6, 'c24f0600000b', 'hex'), property: { power: 'off' } }, //꺼짐
		// { deviceId: 'Fan1', type: 'Fan', commandHex: Buffer.alloc(6, 'c24f0300000e', 'hex'), property: { speed: 'low' } }, //약(켜짐)
		// { deviceId: 'Fan1', type: 'Fan', commandHex: Buffer.alloc(6, 'c24f0200000f', 'hex'), property: { speed: 'medium' } }, //중(켜짐)
		// { deviceId: 'Fan1', type: 'Fan', commandHex: Buffer.alloc(6, 'c24f0100000c', 'hex'), property: { speed: 'high' } }, //강(켜짐)
		// 난방
		{ deviceId: 'Thermo1', type: 'Thermo', commandHex: Buffer.alloc(8, 'ae7d010100000053', 'hex'), property: { mode: 'heat' } }, // 온도조절기1-on
		{ deviceId: 'Thermo1', type: 'Thermo', commandHex: Buffer.alloc(8, 'ae7d010000000052', 'hex'), property: { mode: 'off' } }, // 온도조절기1-off
		{ deviceId: 'Thermo2', type: 'Thermo', commandHex: Buffer.alloc(8, 'ae7d020100000050', 'hex'), property: { mode: 'heat' } },
		{ deviceId: 'Thermo2', type: 'Thermo', commandHex: Buffer.alloc(8, 'ae7d020000000051', 'hex'), property: { mode: 'off' } },
		{ deviceId: 'Thermo3', type: 'Thermo', commandHex: Buffer.alloc(8, 'ae7d030100000051', 'hex'), property: { mode: 'heat' } },
		{ deviceId: 'Thermo3', type: 'Thermo', commandHex: Buffer.alloc(8, 'ae7d030000000050', 'hex'), property: { mode: 'off' } },
		{ deviceId: 'Thermo4', type: 'Thermo', commandHex: Buffer.alloc(8, 'ae7d040100000056', 'hex'), property: { mode: 'heat' } },
		{ deviceId: 'Thermo4', type: 'Thermo', commandHex: Buffer.alloc(8, 'ae7d040000000057', 'hex'), property: { mode: 'off' } },
		{ deviceId: 'Thermo5', type: 'Thermo', commandHex: Buffer.alloc(8, 'ae7d050100000057', 'hex'), property: { mode: 'heat' } },
		{ deviceId: 'Thermo5', type: 'Thermo', commandHex: Buffer.alloc(8, 'ae7d050000000056', 'hex'), property: { mode: 'off' } },
		{ deviceId: 'Thermo1', type: 'Thermo', commandHex: Buffer.alloc(8, 'ae7f01FF000000FF', 'hex'), property: { setTemp: '' } }, // 온도조절기1-온도설정
		{ deviceId: 'Thermo2', type: 'Thermo', commandHex: Buffer.alloc(8, 'ae7f02FF000000FF', 'hex'), property: { setTemp: '' } },
		{ deviceId: 'Thermo3', type: 'Thermo', commandHex: Buffer.alloc(8, 'ae7f03FF000000FF', 'hex'), property: { setTemp: '' } },
		{ deviceId: 'Thermo4', type: 'Thermo', commandHex: Buffer.alloc(8, 'ae7f04FF000000FF', 'hex'), property: { setTemp: '' } },
		{ deviceId: 'Thermo5', type: 'Thermo', commandHex: Buffer.alloc(8, 'ae7f05FF000000FF', 'hex'), property: { setTemp: '' } }
	],

	FILTER: [
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
	]
};


//////////////////////////////////////////////////////////////////////////////////////
// 삼성 홈넷용 시리얼 통신 파서 : 메시지 길이나 구분자가 불규칙하여 별도 Transform을 정의
// CustomTransform 통해 불규칙하게 들어오는 serial message를 한줄에 하나의 packet으로 표시되도록 stream 변환한다.
class CustomTransform {
	constructor(options) {		
		util.inherits(CustomTransform, Transform);
		Transform.call(this, options);
		this._queueChunk = [];
		this._msgLenCount = 0;
		this._msgLength = 8;
		this._msgTypeFlag = false;
	}

	_transform(chunk, encoding, done) {
		var start = 0;
		//log('chunk : ' + chunk.toString('hex'))
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
	}
}

/////////////////////////////////////////////////////////////////////////////
// RS485server
// - SerialPort를 통해 RS485 device 들의 정보를 얻어오고 또한 device에 명령을 보낸다.
// - 수집된 정보를 내부적으로 관리한다.
// - SmartThings 및 MQTT로 device 상태 정보 전달 및 명령을 전달 받는다.
class RS485server {
	constructor() {
		this._packets = {};
		this._serialReady = false;
		this._lastReceive = new Date().getTime();
		this._commandQueue = new Array();
		this._deviceStatusCache = {};
		this._deviceStatus = [];

		this._STInfo = this.LoadSTInfoFromFile();	// SmartThings 485-connector와의 통신을 위한 url 및 token 정보
		this._serialPort = this.InitSerialPort();
		this._mqttClient = this.InitMQTTClient();
		this.InitHttpServer();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// SmartThings
	LoadSTInfoFromFile() {
		log("[ST    ] Reading SmartThings info from file 'STInfo'...")
		try {
			let text = fs.readFileSync('STInfo', 'utf8')
			//log('[ST    ] File content : ' + text)
			return JSON.parse(text)
		} catch (e) {
			return undefined;
		}		
	}

	UpdateSTDeviceStatus(deviceId, propertyName, propertyValue) {
		// STInfo
		// {
		// 	"app_url":"https://graph-ap02-apnortheast2.api.smartthings.com:443/api/smartapps/installations/",
		// 	"app_id":"cd8a522f-40ad-4708-8a9d-c268f3167e8e",
		// 	"access_token":"695e0875-aa0f-4f41-af29-ddd3c604f189"
		// }	
		if (this._STInfo) {
			let deviceStatus = {};
			deviceStatus.id = deviceId;
			deviceStatus.property = {};
			deviceStatus.property[propertyName] = propertyValue;
	
			log("[ST    ] Send to ST : " + JSON.stringify(deviceStatus));
			const url = new URL(this._STInfo.app_url + this._STInfo.app_id + '/update' + '?access_token=' + this._STInfo.access_token);
			const options = { method: 'POST' };
			const req = https.request(url, options, (resp) => {
				let data = '';				
				resp.on('data', chunk => data += chunk );	// A chunk of data has been recieved.
				resp.on('end', () => {	// The whole response has been received. Print out the result.
					//log('[ST    ] Send to ST end - ' + data);
				});
			});
			req.on("error", err => log("[ST    ] Error: " + err.message) );
			req.write(JSON.stringify(deviceStatus));
			req.end();
		} else {
			log("[ST    ] Send to ST FAILED due to no STInfo...");
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// MQTT
	InitMQTTClient() {
		const client = mqtt.connect(CONST.MQTT_BROKER, {clientId: CONST.MQTT_CLIENTID});
		client.on('connect', () => {
			client.subscribe(CONST.MQTT_DEVICE_TOPIC, (err) => {
				if (err) {
					log('MQTT Subscribe fail! -', CONST.MQTT_DEVICE_TOPIC);
				}
			});
		});
		// HA에서 MQTT로 제어 명령 수신
		client.on('message', this.MQTTMessageHandler.bind(this));
		return client;
	}

	MQTTMessageHandler(topic, message) {
		if(this._serialReady) {
			var topics = topic.split('/');
			var value = message.toString(); // message buffer이므로 string으로 변환		
			if(topics[0] === CONST.MQTT_TOPIC_PRFIX) {
				this.SetDeviceProperty(topics[1], topics[2], value);
			}
		} else {
			log('[MQTT  ] MQTT is not ready... drop message...');
		}
	}
	
	UpdateMQTTDeviceStatus(deviceId, propertyName, propertyValue) {
		var topic = util.format(CONST.MQTT_STATE_TOPIC, deviceId, propertyName);
		log('[MQTT  ] Send to HA :', topic, '->', propertyValue);
		this._mqttClient.publish(topic, propertyValue, {retain: true});
	}
	
	//////////////////////////////////////////////////////////////////////////////////////
	// Serial
	InitSerialPort() {
		const serial = new serialport(CONST.SERIAL_PORT_NAME, {
			baudRate: 9600,
			dataBits: 8,
			parity: 'even',
			stopBits: 1,
			autoOpen: false,
			encoding: 'hex'
		});
		serial.on('open', () => {
			log('[Serial] Success open port:', CONST.SERIAL_PORT_NAME)
			// serial port가 open 된 후 serial에서 device 상태들을 읽어들일 때 까지 기다린다.
			setTimeout(() => {
				this._serialReady = true;
				log('[Serial] Serial service Ready...')
			}, CONST.SERIAL_READY_DELAY);
		});
		serial.open((err) => {
			if (err) {
				return log('[Serial] Error opening port:', err.message)
			}
		})
		serial.pipe(new CustomTransform()).on('data', this.SerialMessageHandler.bind(this));
		
		// 매 20ms 마다 queue에 쌓인 명령을 처리한다.
		setInterval(this.ProcessSerialCommand.bind(this), 20);

		return serial;
	}

	// 홈넷에서 SerialPort로 상태 정보 수신
	SerialMessageHandler(data) {
		//console.log('Receive interval: ', (new Date().getTime())-this._lastReceive, 'ms ->', data.toString('hex'));
		this._lastReceive = new Date().getTime();
		let packet = data.toString('hex');

		if (CONST.FILTER.includes(packet)) {
			//log("Filtered Packet : ", packet)
		} else {
			//log("Not filtered Packet : ", packet)
		}

		if (this._packets[packet]) {
			this._packets[packet]++;
		} else {
			this._packets[packet] = 1;
			// 최초로 발생한 패킷만 출력
			log("[Serial] New packet : ", packet)
		}

		// 첫번째 바이트가 'b0'이 아니면 요청 메세지이므로 처리하지 않는다.
		if (data[0] != 0xb0) return;
		// 두번째 바이트는 명령 종류
		switch (data[1]) {
			case 0x79: 	// 조명 상태 정보
				var objFoundArr = CONST.DEVICE_STATE.filter(obj => data.equals(obj.stateHex));
				objFoundArr.forEach((objFound) => {
					this.UpdateDeviceStatus(objFound);
				});
				break;
			case 0x4e: 	// 환풍기 상태 정보
				var objFound = CONST.DEVICE_STATE.find(obj => data.equals(obj.stateHex));
				if (objFound)
					this.UpdateDeviceStatus(objFound);
				break;
			case 0x7c: 	// 온도조절기 상태 정보
				var objFound = CONST.DEVICE_STATE.find(obj => data.includes(obj.stateHex));	// 메시지 앞부분 매칭(온도부분 제외)
				if (objFound && data.length === 8) {		// 메시지 길이 확인
					objFound.property.setTemp = data[4].toString();		// 설정 온도
					objFound.property.curTemp = data[5].toString();		// 현재 온도
					this.UpdateDeviceStatus(objFound);
				}
				break;
			// 제어 명령 Ack 메시지 : 조명, 난방, 난방온도, 환풍기
			case 0x7a: case 0x7d: case 0x7f: case 0x4f:
				// Ack 메시지를 받은 명령은 제어 성공하였으므로 명령큐에서 삭제
				const ack = Buffer.alloc(3);
				data.copy(ack, 0, 1, 4);
				var objFoundIdx = this._commandQueue.findIndex(obj => obj.commandHex.includes(ack));
				if (objFoundIdx > -1) {
					log('[Serial] Success command:', data.toString('hex'));
					this._commandQueue.splice(objFoundIdx, 1);
				}
				break;
			default:
			//log('unknown response : ' + data.toString('hex'));
		}
	}

	WriteSerialCommand(cmdHex) {
		var buf = Buffer.alloc(cmdHex.length / 2, cmdHex, 'hex')
		this._serialPort.write(buf, (err) => { if (err) return log('[Serial] Send Error: ', err.message); });
		log('[Serial] Send cmd : ', buf.toString('hex'));
	}

	// SerialPort로 제어 명령 전송
	ProcessSerialCommand() {
		// 큐에 처리할 메시지가 없으면 종료
		if (this._commandQueue.length == 0) return;

		// 기존 홈넷 RS485 메시지와 충돌하지 않도록 Delay를 줌
		var delay = (new Date().getTime()) - this._lastReceive;
		if (delay < CONST.SERIAL_SEND_DELAY) return;

		// 큐에서 제어 메시지 가져오기
		var obj = this._commandQueue.shift();

		// serial port에 해당 hex command를 입력한다.
		this._serialPort.write(obj.commandHex, (err) => { if (err) return log('[Serial] Send Error: ', err.message); });
		this._lastReceive = new Date().getTime();
		obj.sentTime = this._lastReceive;	// 명령 전송시간 sentTime으로 저장
		log('[Serial] Send to Device:', obj.deviceId, '->', obj.state, '(' + delay + 'ms) ', obj.commandHex.toString('hex'));

		// 다시 큐에 저장하여 Ack 메시지 받을때까지 반복 실행
		this._commandQueue.push(obj);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// RS485 devices	
	GetDeviceStatus(id) {
		var deviceFound = this._deviceStatus.find((e) => e.id === id);
		if (!deviceFound) {
			throw new Error('No device found');
		}
		return deviceFound;
	}
	
	GetPropertyStatus(id, propertyName) {
		var property = {};
		property[propertyName] = this.GetDeviceStatus(id).property[propertyName];
		if (!property[propertyName]) {
			throw new Error('No property found');
		}
		return property;
	}

	SetDeviceProperty(deviceSubId, property, value) {
		log('[SetDeviceProperty] ' + deviceSubId + ' - ' + property + ' : ' + value);
		var objFound = null;
	
		// 온도설정 명령의 경우 모든 온도를 Hex로 정의해두기에는 많으므로 온도에 따른 시리얼 통신 메시지 생성
		if (property === 'setTemp') {
			objFound = CONST.DEVICE_COMMAND.find(obj => obj.deviceId === deviceSubId && obj.hasOwnProperty('setTemp'));
			objFound.commandHex[3] = Number(value);
			objFound.setTemp = String(Number(value)); // 온도값은 소수점이하는 버림
			var xorSum = objFound.commandHex[0] ^ objFound.commandHex[1] ^ objFound.commandHex[2] ^ objFound.commandHex[3] ^ 0x80
			objFound.commandHex[7] = xorSum; // 마지막 Byte는 XOR SUM
		}
		// Light의 경우 하나의 deviceId로 여러개의 light를 제어하므로 변환로직 필요
		// else if (deviceSubId === 'Light1' && property === 'switch') {
		// 	objFound = CONST.DEVICE_COMMAND.find(obj => obj.deviceId === 'Light1' && obj['power1'] === value);
		// }
		// else if (deviceSubId === 'Light2' && property === 'switch') {
		// 	objFound = CONST.DEVICE_COMMAND.find(obj => obj.deviceId === 'Light1' && obj['power2'] === value);
		// }
		// 다른 명령은 미리 정의해놓은 값을 매칭
		else {
			objFound = CONST.DEVICE_COMMAND.find(obj => obj.deviceId === deviceSubId && obj.property[property] === value);
		}
	
		if (objFound == null) {
			throw new Error("Can not find command");
		}
	
		// 현재 상태와 같으면 Skip
		if (value === this._deviceStatusCache[objFound.deviceId + objFound.property[property]]) {
			log('Value is not changed. skip.');
			return;
		}
	
		// Serial메시지 제어명령 전송
		log('Add to queue for applying new value.');
		// 최초 실행시 딜레이 없도록 sentTime을 현재시간 보다 SERIAL_SEND_DELAY만큼 이전으로 설정
		objFound.sentTime = (new Date().getTime()) - CONST.SERIAL_SEND_DELAY;
		this._commandQueue.push(objFound);	// 실행 큐에 저장
		
		// 내부 상태정보 update 및 MQTT & ST로 상태정보 전송
		this.UpdateDeviceStatus(objFound); // 처리시간의 Delay때문에 미리 상태 반영
	}

	UpdateDeviceStatus(obj) {
		//log('UpdateDeviceStatus: deviceId[' + obj.deviceId + '], stateHex[' + obj.stateHex.toString('hex'));

		let arrPropertyName = Object.keys(obj.property);
		// 상태값이 아닌 항목들은 제외 [deviceId, type, stateHex, commandHex, sentTime]
		//const arrFilter = ['deviceId', 'type', 'stateHex', 'commandHex', 'sentTime'];
		//arrPropertyName = arrPropertyName.filter(propertyName => !arrFilter.includes(propertyName));

		// 상태값별 현재 상태 파악하여 변경되었으면 상태 반영
		arrPropertyName.forEach( (propertyName) => {
			// 상태값이 없거나 상태가 같으면 반영 중지
			let curStatus = this._deviceStatusCache[obj.deviceId + propertyName];
			if(obj.property[propertyName] == null || obj.property[propertyName] === curStatus) {
				//log('The status is same as before... skip...');
				return;
			}
	
			//log('UpdateDeviceStatus: deviceId[' + obj.deviceId + '], stateHex[' + obj.stateHex.toString('hex') + ']');
	
			// 미리 상태 반영한 device의 상태 원복 방지
			if(this._commandQueue.length > 0) {
				let found = this._commandQueue.find(q => q.deviceId === obj.deviceId && q.property[propertyName] === curStatus);
				if(found != null) return;
			}
	
			// 상태 반영
			this._deviceStatusCache[obj.deviceId + propertyName] = obj.property[propertyName];
			// 이전에 없던 device이면 새로 생성한다.
			let deviceStatus = this._deviceStatus.find(o => (o.id === obj.deviceId));
			if (!deviceStatus) {
				let len = this._deviceStatus.push({
					type: obj.type,
					id: obj.deviceId,
					uri: '/homenet/' + obj.deviceId,
					property: {}
				});
				deviceStatus = this._deviceStatus[len - 1];
			}
			deviceStatus.property[propertyName] = obj.property[propertyName];

			// MQTT publish
			this.UpdateMQTTDeviceStatus(obj.deviceId, propertyName, obj.property[propertyName]);
	
			// SmartThings send event
			this.UpdateSTDeviceStatus(obj.deviceId, propertyName, obj.property[propertyName]);
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// http server
	InitHttpServer() {
		var app = express();
		app.use(express.urlencoded({extended: false}));
		app.use(express.json());
		
		http.createServer(app).listen(CONST.HTTP_PORT, () => {
			log("[ST    ] 485server http server listening on port " + CONST.HTTP_PORT);
		});

		// root path로 접근하면 homenet으로 redirect 함
		app.get("/", (req, res) => res.redirect('homenet'));			

		// 각종 routing handler 등록
		app.get ('/homenet', 						(req, res) => this.HTTPCommonHandler(req, res, this.HTTP_get_homenet.bind(this)));
		app.get ('/homenet/:id', 					(req, res) => this.HTTPCommonHandler(req, res, this.HTTP_get_homenet_id.bind(this)));
		app.get ('/homenet/:id/:property', 			(req, res) => this.HTTPCommonHandler(req, res, this.HTTP_get_homenet_id_property.bind(this)));
		app.put ('/homenet/:id/:property/:value', 	(req, res) => this.HTTPCommonHandler(req, res, this.HTTP_put_homenet_id_property.bind(this)));
		app.put ('/homenet/serial/:cmd', 			(req, res) => this.HTTPCommonHandler(req, res, this.HTTP_put_homenet_serial.bind(this)));		
		app.post('/smartthings/installed', 			(req, res) => this.HTTPCommonHandler(req, res, this.HTTP_post_smartthings_installed.bind(this)));		
		app.post('/smartthings/uninstalled',		(req, res) => this.HTTPCommonHandler(req, res, this.HTTP_post_smartthings_uninstalled.bind(this)));
		app.get ('/status', 						(req, res) => this.HTTPCommonHandler(req, res, this.HTTP_get_status.bind(this)));
		app.get ('/packets', 						(req, res) => this.HTTPCommonHandler(req, res, this.HTTP_get_packets.bind(this)));
		app.get ('/log', 							(req, res) => this.HTTPCommonHandler(req, res, this.HTTP_get_log.bind(this)));
	}

	HTTPCommonHandler(req, res, callback) {
		log('[' + req.method + '] ' + req.url);
		var result = {};
		try {
			result = callback(req);
			res.status(200);
		} catch (e) {
			result.message = e.toString();
			res.status(400);
		}
		log('[result] : ' + JSON.stringify(result));
		res.send(result);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// http server handlers
	HTTP_get_homenet(req) {
		if (!this._deviceStatus || this._deviceStatus.length == 0) {
			throw new Error('No device found');
		}
		return this._deviceStatus;
	}

	// not used
	HTTP_get_homenet_id(req) {
		return this.GetDeviceStatus(req.params.id);
	}

	// not used
	HTTP_get_homenet_id_property(req) {
		return this.GetPropertyStatus(req.params.id, req.params.property);
	}

	HTTP_put_homenet_id_property(req) {
		this.SetDeviceProperty(req.params.id, req.params.property, req.params.value);
		return this.GetPropertyStatus(req.params.id, req.params.property);
	}

	// serial로 message 전달
	HTTP_put_homenet_serial(req) {
		this.WriteSerialCommand(req.params.cmd);
		return { message: "Success" };
	}

	// ST에서 smartapp이 설치되어서 초기화 될 때 호출됨. --> STInfo 파일 생성
	HTTP_post_smartthings_installed(req) {
		log('[ST    ] Writing to STInfo file');
		this._STInfo = req.body;
		fs.writeFileSync('STInfo', JSON.stringify(this._STInfo));
		return { message: "Success" };
	}

	// ST에서 smartapp이 uninstall 될 때 호출됨. --> STInfo 파일 삭제
	HTTP_post_smartthings_uninstalled(req) {
		fs.unlinkSync('STInfo');
		this._STInfo = undefined;
		return { message: "Success" };
	}

	HTTP_get_status(req) {
		var status = {
			deviceStatusCache: this._deviceStatusCache,
			deviceStatus: this._deviceStatus,
		};
		return { message: status };
	}

	HTTP_get_packets(req) {
		var packetList = [];
		for (const packet in this._packets) {
			if (this._packets.hasOwnProperty(packet)) {				
				var item = { name: packet, count: this._packets[packet] };
				packetList.push(item);
			}
		}
		return { packets: packetList };
	}

	HTTP_get_log(req) {
		var result = "<pre>";
		result += fs.readFileSync('log', 'utf8')
		result += "</pre>";
		return result;
	}
}

_RS485server = new RS485server();
