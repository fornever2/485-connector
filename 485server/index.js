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
const log = (...args) => console.log('[' + new Date().toISOString().replace('T', ' ').replace('Z', '') + ']', args.join(' '));


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

	MSG_INFO: [
		// 상태 조회
		{ deviceCode: 0xac, cmdCode: 0x79, len: 5, managed: true,  req: 'get', type: 'light', 		propertyName: ''}, 			// 조명 상태
		{ deviceCode: 0xae, cmdCode: 0x7c, len: 8, managed: true,  req: 'get', type: 'thermostat',	propertyName: ''}, 			// 난방 상태
		{ deviceCode: 0xc2, cmdCode: 0x4e, len: 6, managed: false, req: 'get', type: 'vent', 		propertyName: ''}, 			// 환기 상태
		{ deviceCode: 0xad, cmdCode: 0x52, len: 4, managed: false, req: 'get', type: 'intLight', 	propertyName: ''}, 			// 일괄조명 상태	
		{ deviceCode: 0xab, cmdCode: 0x41, len: 4, managed: false, req: 'get', type: 'gasValve', 	propertyName: ''}, 			// 가스밸브 상태
		{ deviceCode: 0xad, cmdCode: 0x41, len: 4, managed: false, req: 'get', type: 'intControl', 	propertyName: ''}, 			// 엘레베이터 상태	
		// 제어                                                     
		{ deviceCode: 0xac, cmdCode: 0x7a, len: 5, managed: true,  req: 'set', type: 'light', 		propertyName: 'switch' },	// 조명 제어
		{ deviceCode: 0xae, cmdCode: 0x7d, len: 8, managed: true,  req: 'set', type: 'thermostat',	propertyName: 'mode' 	},	// 난방 상태 제어
		{ deviceCode: 0xae, cmdCode: 0x7f, len: 8, managed: true,  req: 'set', type: 'thermostat',	propertyName: 'setTemp'},	// 난방 온도 제어
		{ deviceCode: 0xc2, cmdCode: 0x4f, len: 6, managed: false, req: 'set', type: 'vent', 		propertyName: ''}, 			// 환기 제어
		{ deviceCode: 0xad, cmdCode: 0x53, len: 4, managed: false, req: 'set', type: 'intLight', 	propertyName: ''}, 			// 일괄조명 제어
		{ deviceCode: 0xab, cmdCode: 0x78, len: 4, managed: false, req: 'set', type: 'gasValve', 	propertyName: ''}, 			// 가스밸브 제어  --> 복잡한 제어 routine 필요
		{ deviceCode: 0xad, cmdCode: 0x2f, len: 4, managed: false, req: 'set', type: 'intControl', 	propertyName: ''}, 			// 엘레베이터 제어  --> 복잡한 제어 routine 필요
	],
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
		//log('[Serial] chunk : ' + chunk.toString('hex'))
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
					case 0x41: // 가스밸브 / 엘레베이터 등 현관 외출 버튼 상태 조회
					case 0x52: case 0x53: // 일괄조명 상태 / 제어
					case 0x54: case 0x55: case 0x56: // ???
					case 0x78: // 가스밸브 제어
					case 0x2f: // 엘레베이터 제어
						this._msgLength = 4; break;
					case 0x79: case 0x7A: // 조명 상태 / 제어
						this._msgLength = 5; break;
					case 0x4e: case 0x4f: // 환기 상태 / 제어					
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
		this._receivedMsgs = [];
		this._serialReady = false;
		this._lastReceive = new Date();
		this._commandQueue = new Array();
		this._serialCmdQueue = new Array();
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
			var path = '/updateProperty/' + deviceId + '/' + propertyName + '/' + propertyValue;
			log("[ST    ] Send event   : " + path);
			const url = new URL(this._STInfo.app_url + this._STInfo.app_id + path + '?access_token=' + this._STInfo.access_token);
			const options = { method: 'POST' };
			const req = https.request(url, options, (resp) => {
				let data = '';				
				resp.on('data', chunk => data += chunk );	// A chunk of data has been received.
				resp.on('end', () => {	// The whole response has been received. Print out the result.
					//log('[ST    ] Send to ST end - ' + data);
				});
			});
			req.on("error", err => log("[ST    ] Error: " + err.message) );
			//req.write(JSON.stringify(deviceStatus));
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
					log('[MQTT  ] MQTT Subscribe fail! -', CONST.MQTT_DEVICE_TOPIC);
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
		log('[MQTT  ] Publish MQTT :', topic, '->', propertyValue);
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

	CalcChecksum(dataHex) {
		var bite = 0;
		// 모든 bite를 xor 시킨다.
		for(let i = 0 ; i < dataHex.length ; i++) {
			bite ^= dataHex[i];
		}		
		// checksum bite 직전 bite가 FF인 경우를 제외하면 0x80을 한번 더 xor 한다.
		if (dataHex[dataHex.length - 2] != 0xFF) {
			bite ^= 0x80;
		}
		return bite;
	}

	// 홈넷에서 SerialPort로 상태 정보 수신
	SerialMessageHandler(dataHex) {
		//console.log('[Serial] Receive interval: ', new Date()-this._lastReceive, 'ms ->', dataHex.toString('hex'));
		this._lastReceive = new Date();

		// 수신된 package list에서 찾는다.
		var receivedMsg = this._receivedMsgs.find(e => e.codeHex.equals(dataHex));
		// 이전에 수신된 것이 아니면 새로 생성하여 list에 추가한다.
		if (!receivedMsg) {
			// dataHex[1] 바이트가 command이므로 이를 기반으로 명령을 구분한다.
			var foundMsgInfo = CONST.MSG_INFO.find(e => e.cmdCode == dataHex[1]);

			receivedMsg = {
				code: dataHex.toString('hex'),
				codeHex: dataHex,
				count: 0,
				info: foundMsgInfo
			};
			this._receivedMsgs.push(receivedMsg);
			log("[Serial] New received : " + JSON.stringify(receivedMsg));
		}
		receivedMsg.count++;
		receivedMsg.lastlastReceive = receivedMsg.lastReceive;
		receivedMsg.lastReceive = this._lastReceive;

		// checksum 확인
		receivedMsg.checksum = this.CalcChecksum(dataHex);
		if (receivedMsg.checksum != 0) {
			log("[Serial] Checksum is not match - " + receivedMsg.code + ", checksum : 0x" + receivedMsg.checksum.toString(16));
			//return;
		}

		// 관리되지 않는(모르는) message는 처리하지 않는다.
		if (!receivedMsg.info || !receivedMsg.info.managed) {
			//log("[Serial] Drop Unmanaged message - " + receivedMsg.code);
			return;
		}

		// dataHex[0] 바이트가 'b0'이 아닌것은 ack가 아닌 요청 메세지이므로 처리하지 않는다.
		if (dataHex[0] != 0xb0) {
			//log("[Serial] Skip request message - " + receivedMsg.code);
			return;
		}

		// packet length 확인
		if (receivedMsg.info.len != dataHex.length) {
			log("[Serial] Message length is not match. drop message - " + receivedMsg.code + ". expected len : " + receivedMsg.info.len + ", real len : " + dataHex.length);
			return;
		}

		

		if (receivedMsg.info.req == 'get') {
			// 상태 조회 요청에 대한 ack를 받았으면, 상태값을 내부 관리 데이터에 반영한다.
			switch (receivedMsg.info.type) {
				case 'light':
					// dataHex[2] : 조명갯수 (31: 3개, 21: 2개)
					// dataHex[3] : 조명상태 (최하단 bit 부터 조명 on/off 여부)					
					// 조명 갯수 읽어오기
					let lightNum = parseInt(dataHex.toString('hex')[4]);	// b079310078 --> 3 : dataHex를 hex형태의 string으로 변환 후 4번 자리의 값을 숫자로 변환
					for(let i = 0 ; i < lightNum ; i++) {
						let deviceId = receivedMsg.info.type + (i + 1).toString();
						let switchValue = ( dataHex[3] & (1 << i) ) ? 'on' : 'off'; // dataHex[3] 의 값을 bit 연산하여 상태값 읽어오기
						this.UpdateDeviceProperty(receivedMsg.info.type, deviceId, 'switch', switchValue);
					}
					break;
				case 'thermostat':
					// dataHex[2] : 방번호
					// dataHex[3] : mode (00:off, 01:on)
					// dataHex[4] : 설정온도
					// dataHex[5] : 현재온도
					// dataHex[6] : 무조건 FF
					// dataHex[7] : checksum
					let deviceId = receivedMsg.info.type + dataHex[2].toString();
					this.UpdateDeviceProperty(receivedMsg.info.type, deviceId, 'mode', dataHex[3] ? 'heat' : 'off');
					this.UpdateDeviceProperty(receivedMsg.info.type, deviceId, 'setTemp', dataHex[4].toString());
					this.UpdateDeviceProperty(receivedMsg.info.type, deviceId, 'curTemp', dataHex[5].toString());
					break;
				case 'vent':
					break;
				case 'intLight':
					break;
				case 'gasValve':
					break;
				case 'intControl':
					break;
			}
		} else {
			// 제어 요청에 대한 ack를 받은 것이라면, 제어 성공했으므로 명령큐에서 삭제
			// var foundIdx = this._commandQueue.findIndex(e => ((receivedMsg.info.deviceCode == e.commandHex[0]) && (receivedMsg.info.cmdCode == e.commandHex[1])));
			// while (foundIdx > -1) {
			// 	log('[Serial] Success command:', dataHex.toString('hex'));
			// 	this._commandQueue.splice(foundIdx, 1);
			// 	var foundIdx = this._commandQueue.findIndex(e => ((receivedMsg.info.deviceCode == e.commandHex[0]) && (receivedMsg.info.cmdCode == e.commandHex[1])));
			// }
			
			var foundIdx = this._serialCmdQueue.findIndex(e => (receivedMsg.info.cmdCode == e.cmdHex[1]));
			while (foundIdx > -1) {
				log('[Serial] Success command:', dataHex.toString('hex'));
				this._serialCmdQueue.splice(foundIdx, 1);
				var foundIdx = this._serialCmdQueue.findIndex(e => (receivedMsg.info.cmdCode == e.cmdHex[1]));
			}
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
		if (this._serialCmdQueue.length == 0) return;
		

		// 기존 홈넷 RS485 메시지와 충돌하지 않도록 Delay를 줌
		var delay = new Date() - this._lastReceive;
		if (delay < CONST.SERIAL_SEND_DELAY) return;

		// 큐에서 제어 메시지 가져오기
		var serialCmd = this._serialCmdQueue.shift();		

		// serial port에 해당 hex command를 입력한다.
		this._serialPort.write(serialCmd.cmdHex, (err) => { if (err) return log('[Serial] Send Error: ', err.message); });
		this._lastReceive = new Date();
		serialCmd.sentTime = this._lastReceive;	// 명령 전송시간 sentTime으로 저장
		log('[Serial] Send to Device:' + serialCmd.deviceId + '-' + serialCmd.property + '->', serialCmd.value, '(' + delay + 'ms) ', serialCmd.cmdHex.toString('hex'));

		// 다시 큐에 저장하여 Ack 메시지 받을때까지 반복 실행
		this._serialCmdQueue.push(serialCmd);
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

	SetDeviceProperty(deviceId, propertyName, propertyValue) {
		log('[Server] ' + deviceId + ' - ' + propertyName + ' : ' + propertyValue);
	
		// 현재 상태와 같으면 Skip
		// if (propertyValue === this._deviceStatusCache[deviceId + propertyName]) {
		// 	log('[Server] property value is same with before. skip.');
		// 	return;
		// }

		var type = this.GetDeviceStatus(deviceId).type;
		log('type : ' + type);

		var msgInfo = CONST.MSG_INFO.find(e => ((e.req == 'set') && (e.type == type) && (e.propertyName == propertyName)));
		log('msgInfo : ' + JSON.stringify(msgInfo));
		var cmdHex = Buffer.alloc(msgInfo.len);
		cmdHex[0] = msgInfo.deviceCode;
		cmdHex[1] = msgInfo.cmdCode;
		
		switch (type) {
			case 'light':
				cmdHex[2] = Number(deviceId.substr(deviceId.length - 1));// deviceId의 끝자리 숫자
				cmdHex[3] = Number(propertyValue == 'on');	// 'on' : 1, 'off' : 0
				break;
			case 'thermostat':
				cmdHex[2] = Number(deviceId.substr(deviceId.length - 1));	// deviceId의 끝자리 숫자
				if (propertyName == 'mode') {
					cmdHex[3] = Number(propertyValue == 'heat');	// 'heat' : 1, 'off' : 0
				} else if (propertyName == 'setTemp') {
					cmdHex[3] = Number(propertyValue);	// 설정 온도 문자열을 숫자로 변환
				}
				break;
			case 'vent':
				break;
			case 'intLight':
				break;
			case 'gasValve':
				break;
			case 'intControl':
				break;
		}
		// checksum 붙이기
		cmdHex[msgInfo.len - 1] = this.CalcChecksum(cmdHex);

		// Serial메시지 제어명령 전송
		// 최초 실행시 딜레이 없도록 sentTime을 현재시간 보다 SERIAL_SEND_DELAY만큼 이전으로 설정
		log('[Server] Add to queue for applying new value. - ' + cmdHex.toString('hex'));
		var serialCmd = {};
		serialCmd.cmdHex = cmdHex;
		serialCmd.sentTime = new Date() - CONST.SERIAL_SEND_DELAY;
		serialCmd.deviceId = deviceId;
		serialCmd.property = propertyName;
		serialCmd.value = propertyValue;
		this._serialCmdQueue.push(serialCmd);	// 실행 큐에 저장
		
		// 내부 상태정보 update 및 MQTT & ST로 상태정보 전송
		this.UpdateDeviceProperty(type, deviceId, propertyName, propertyValue);	// 처리시간의 Delay때문에 미리 상태 반영
	}

	UpdateDeviceProperty(type, deviceId, propertyName, propertyValue) {
		// 상태값이 없거나 상태가 같으면 반영 중지
		let curPropertyValue = this._deviceStatusCache[deviceId + propertyName];
		if(propertyValue === curPropertyValue) {
			//log('[Server] The status is same as before... skip...');
			return;
		}
		//log('[Server] UpdateDeviceStatus: deviceId[' + deviceId + '], stateHex[' + obj.stateHex.toString('hex') + ']');

		// 미리 상태 반영한 device의 상태 원복 방지
		if(this._serialCmdQueue.length > 0) {
			let found = this._serialCmdQueue.find(e => e.deviceId === deviceId && e.property === propertyName && e.value === curPropertyValue);
			if(found != null) return;
		}

		this._deviceStatusCache[deviceId + propertyName] = propertyValue;
		// 이전에 없던 device이면 새로 생성한다.
		let deviceStatus = this._deviceStatus.find(o => (o.id === deviceId));
		if (!deviceStatus) {
			let len = this._deviceStatus.push({
				type: type,
				id: deviceId,
				uri: '/homenet/' + deviceId,
				property: {}
			});
			deviceStatus = this._deviceStatus[len - 1];
		}
		// 상태 반영
		deviceStatus.property[propertyName] = propertyValue;

		// MQTT publish
		this.UpdateMQTTDeviceStatus(deviceId, propertyName, propertyValue);

		// SmartThings send event
		this.UpdateSTDeviceStatus(deviceId, propertyName, propertyValue);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// http server
	InitHttpServer() {
		var app = express();
		app.use(express.urlencoded({extended: false}));
		app.use(express.json());
		
		http.createServer(app).listen(CONST.HTTP_PORT, () => {
			log("[HTTP  ] 485server http server listening on port " + CONST.HTTP_PORT);
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
		app.get ('/log', 							(req, res) => this.HTTPCommonHandler(req, res, this.HTTP_get_log.bind(this)));
		app.get ('/received', 						(req, res) => this.HTTPCommonHandler(req, res, this.HTTP_get_received.bind(this)));
	}

	HTTPCommonHandler(req, res, callback) {
		log('[HTTP  ] ' + req.method + ' : ' + req.url);
		var result = {};
		try {
			result = callback(req);
			res.status(200);
			log('[HTTP  ] result : OK');
		} catch (e) {
			result.message = e.toString();
			res.status(400);
			log('[HTTP  ] result : FAIL - ' + e.stack);
		}
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

	HTTP_get_log(req) {
		var result = "<pre>";
		result += fs.readFileSync('log', 'utf8')
		result += "</pre>";
		return result;
	}

	HTTP_get_received(req) {
		const filter = [
			"cc4101000c",
			"b041010070",
			"a15a007b",
			"a25a0078",
			"a35a0079",
			"a45a007e",
			"a6410067",
			"a5410064",
			"ab41006a",
			"ac41006d",
			"b0410071",
			"b0410170",
		];
		var managedStr = "";
		var knownStr = "";
		var filteredStr = "";
		var unknownStr = "";

		var result = '<pre>';
		result += "U  Serial message       CS   Type         Req   Managed   Count   Period   Time(ms)   Last received\n";
		result += "=============================================================================================================\n";
		for (let i in this._receivedMsgs) {
			let msg = this._receivedMsgs[i];
			let isUpdated = (msg.lastCount != msg.count) ? "*  " : "   ";
			let cs = (msg.checksum == 0) ? ' OK ' : '0x' + msg.checksum.toString(16).padStart(2, '0');
			let type = msg.info ? msg.info.type : "";
			let req = msg.info ? msg.info.req : "   ";
			let managed = (msg.info && msg.info.managed) ? "O "  : "X ";
			let period = (msg.lastReceive - msg.lastlastReceive).toString();
			let time = (new Date() - msg.lastReceive).toString();

			let str = 
				isUpdated +
				msg.code.padEnd(20, ' ') +
				cs + '  ' +
				type.padEnd(12, ' ') + ' ' +
				req + '      ' +
				managed +
				msg.count.toString().padStart(10, ' ') + ' ' +
				period.padStart(8, ' ') + ' ' +
				time.padStart(10, ' ') + '   ' +
				msg.lastReceive.toISOString().replace('T', ' ').replace('Z', '') +
				'\n';			
			msg.lastCount = msg.count;

			if (msg.info) {
				if (msg.info.managed) {
					managedStr += str;
				} else {
					knownStr += str;
				}
			} else if (filter.includes(msg.code)) {
				filteredStr += str;
			} else {
				unknownStr += str;
			}
		}
		
		result += "-- Known & Managed messages ---------------------------------------------------------------------------------\n";
		result += managedStr;
		result += "-- Known but unmanaged messages -----------------------------------------------------------------------------\n";
		result += knownStr;
		result += "-- Filtered messages ----------------------------------------------------------------------------------------\n";
		result += filteredStr;
		result += "-- Unknown messages -----------------------------------------------------------------------------------------\n";
		result += unknownStr;
		result += '</pre>';
		return result;
	}
}

_RS485server = new RS485server();
