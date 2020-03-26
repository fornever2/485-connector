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
const log = (...args) => console.log('[' + (new Date()).toLocaleString() + ']', args.join(' '));
const warn = (...args) => console.warn('[' + (new Date()).toLocaleString() + '] ** WARN **', args.join(' '));
const error = (...args) => console.error('[' + (new Date()).toLocaleString() + '] ** ERROR **', args.join(' '));

//////////////////////////////////////////////////////////////////////////////////////
const CONST = {
	// SerialPort 이름 설정
	SERIAL_PORT_NAME: "/dev/ttyUSB0",
	// SerialPort 전송 Delay(ms)
	SERIAL_SEND_RETRY_DELAY: 500,
	SERIAL_SEND_RETRY_COUNT: 10,
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

	/////////////////////////////////////////////////////////////////////////////
	// serial port에서 읽어진 message가 parsing 되어 상태 반영이 필요한 경우 parseToProperty() 함수를 정의해야 함.
	// parseToProperty(buf)
	//   - parameters
	//     . buf: 전달된 serial message buffer
	//   - returns : 반영되어야 하는 property 정보를 array
	// 또한, serial port에 명령을 write 하는 경우에 대해 setPropertyToMsg() 함수를 정의해야 함.
	// setPropertyToMsg(buf, id, name, value)
	//   - parameters
	//     . buf: 메세지 버퍼. 0번, 1번 및 checksum은 따로 정의하지 않아도 알아서 정의됨.
	//     . deviceId: property를 설정하고자 하는 device의 id
	//     . propertyName: property name
	//     . propertyValue: property value
	//   - returns : buf
	MSG_INFO: [
		/////////////////////////////////////////////////////////////////////////////
		// 제어
		// 조명 제어
		{ prefix: 0xac, cmdCode: 0x7a, len: 5, log: true, req: 'set', type: 'light', property: { switch: 'off' }, managed: true,
			setPropertyToMsg: (buf, id, name, value) => {
				buf[2] = Number(id.substr(id.length - 1));	// id의 끝자리 숫자
				buf[3] = Number(value == 'on');				// 'on' : 1, 'off' : 0
				return buf;
			}
		},
		// 조명 제어 응답
		{ prefix: 0xb0, cmdCode: 0x7a, len: 5, log: true, req: 'ack', type: 'light', property: { switch: 'off' }, managed: true,
			parseToProperty: (buf) => {
				// buf[2] : ID - 0x00:전부, 0x01: 1번조명, 0x02: 2번조명
				// buf[3] : 'on' : 1, 'off' : 0	
				if (buf[2] == 0) {
					// 원래 0이면 모든 조명이 꺼지는 것이지만, 현재 조명 갯수를 알 수 없으므로 그냥 무시....어차피 상태 조회할 때 처리됨
					return [];
				} else {
					return [{
						deviceId: ('light' + buf[2].toString()),
						propertyName: 'switch',
						propertyValue: (buf[3] ? 'on' : 'off'),	 // buf[3] 의 값을 bit 연산하여 상태값 읽어오기
					}];
				} 
			}
		},

		// 난방 모드 제어
		{ prefix: 0xae, cmdCode: 0x7d, len: 8, log: true, req: 'set', type: 'thermostat', property: { mode: 'off' }, managed: true,
			setPropertyToMsg: (buf, id, name, value) => {
				buf[2] = Number(id.substr(id.length - 1));	// deviceId의 끝자리 숫자
				buf[3] = Number(value == 'heat');	// 'heat' : 1, 'off' : 0
				return buf;
			}
		},
		// 난방 모드 응답
		{ prefix: 0xb0, cmdCode: 0x7d, len: 8, log: true, req: 'ack', type: 'thermostat', property: { mode: 'off' }, managed: true,
			parseToProperty: (buf) => {
				// buf[2]:방번호 (0인 경우 모든 난방 끄기), buf[3]:mode(0:off, 1:on), buf[4]:설정온도, buf[5]:현재온도
				let deviceId = 'thermostat' + buf[2].toString();
				return  [
					{ deviceId: deviceId, propertyName: 'mode',    propertyValue: (buf[3] ? 'heat' : 'off') },
					//{ deviceId: deviceId, propertyName: 'setTemp', propertyValue: buf[4] },
					//{ deviceId: deviceId, propertyName: 'curTemp', propertyValue: buf[5] },
				];
			}
		},

		// 난방 온도 제어
		{ prefix: 0xae, cmdCode: 0x7f, len: 8, log: true, req: 'set', type: 'thermostat', property: { setTemp: 0 }, managed: true,
			setPropertyToMsg: (buf, id, name, value) => {
				buf[2] = Number(id.substr(id.length - 1));	// deviceId의 끝자리 숫자
				buf[3] = Number(value);						// 설정 온도 문자열을 숫자로 변환
				return buf;
			}
		},
		// 난방 온도 제어 응답
		{ prefix: 0xb0, cmdCode: 0x7f, len: 8, log: true, req: 'ack', type: 'thermostat', property: { setTemp: 0 }, managed: true,
			parseToProperty: (buf) => {
				// buf[2]:방번호, buf[3]:mode(0:off, 1:on), buf[4]:설정온도, buf[5]:현재온도
				let deviceId = 'thermostat' + buf[2].toString();
				return [
					{ deviceId: deviceId, propertyName: 'setTemp', propertyValue: buf[3] },
				];
			}
		},
		
		// 환기 제어
		{ prefix: 0xc2, cmdCode: 0x4f, len: 6, log: true, req: 'set', type: 'vent', property: { switch: 'off', level: 1 }, managed: true,
			setPropertyToMsg: (buf, id, name, value) => {
				// 5:on, 6:off, 3:1단, 2:2단, 1:3단  (단계는 on 상태에서만 변경됨)
				if (name == 'switch') {
					buf[2] = Number((value == 'on') ? 5 : 6);	// 5:on, 6:off
				} else if (name == 'level') {
					buf[2] = Number(value);	// 3:1단, 2:2단, 1:3단  (단계는 on 상태에서만 변경됨)
				}
				return buf;
			}
	 	},
		// 환기 제어 응답
		{ prefix: 0xb0, cmdCode: 0x4f, len: 6, log: true, req: 'ack', type: 'vent', property: { switch: 'off', level: 1 }, managed: true,
			parseToProperty: (buf) => {
				// 5:on, 6:off, 3:1단, 2:2단, 1:3단  (단계는 on 상태에서만 변경됨)
				var value = undefined;
				if (buf[2] == 0x05 || buf[2] == 0x06) {
					value = (buf[2] == 0x05) ? 'on' : 'off';
				} else {
					value = buf[2];
				}
				return [{ deviceId: 'vent', propertyName: 'level', propertyValue: value }];
			}
	 	},

		// 가스밸브 제어 - 열기는 안됨.
		{ prefix: 0xab, cmdCode: 0x78, len: 4, log: true, req: 'set', type: 'gasValve', property: { valve: 'closed' }, managed: true,
			setPropertyToMsg: (buf, id, name, value) => {
				// 무조건 닫기만 가능함
				return buf;
			}
		},
		{ prefix: 0xb0, cmdCode: 0x78, len: 4, log: true, req: 'ack', type: 'gasValve', property: { valve: 'closed' }, managed: true,
			parseToProperty: (buf) => {
				// buf[2] - 0:열림-->잠김, 1:잠김->잠김 (무조건 잠김)
				// 값이 변경되지 않아도 무한로딩 되지 않게 force 옵션 적용
				return [{ deviceId: 'gasValve', propertyName: 'valve', propertyValue: 'closed' }];
			}
		},

		{ prefix: 0xad, cmdCode: 0x53, len: 4, log: true, req: 'set', type: 'intLight????', property: {  }}, 		// 일괄조명 제어
		{ prefix: 0xb0, cmdCode: 0x53, len: 4, log: true, req: 'ack', type: 'intLight????', property: {  }}, 		// 일괄조명 제어
		{ prefix: 0xad, cmdCode: 0x2f, len: 4, log: true, req: 'set', type: 'intControl????', property: {  }}, 		// 엘레베이터 제어  --> 복잡한 제어 routine 필요
		{ prefix: 0xb0, cmdCode: 0x2f, len: 4, log: true, req: 'ack', type: 'intControl????', property: {  }}, 		// 엘레베이터 제어  --> 복잡한 제어 routine 필요

		/////////////////////////////////////////////////////////////////////////////
		// 상태 조회
		// 조명 상태
		{ prefix: 0xac, cmdCode: 0x79, len: 5, log: false, req: 'get', type: 'light', property: { switch: 'off' }, managed: true,
			setPropertyToMsg: (buf, id, name, value) => {
				buf[2] = 0x00;
				buf[3] = 0x01;
				return buf;
			}
		},
		// 조명 상태 응답
		{ prefix: 0xb0, cmdCode: 0x79, len: 5, log: false, req: 'ack', type: 'light', property: { switch: 'off' }, managed: true,
			parseToProperty: (buf) => {
				// buf[2] : 조명갯수 (31: 3개, 21: 2개)
				// buf[3] : 조명상태 (최하단 bit 부터 조명 on/off 여부)					
				// 조명 갯수 읽어오기
				let lightNum = buf[2] >> 4; // parseInt(buf.toString('hex')[4]);	// b079310078 --> 3 : buf를 hex형태의 string으로 변환 후 4번 자리의 값을 숫자로 변환
				var propArr = [];
				for (let i = 0; i < lightNum; i++) {
					propArr.push({
						deviceId: ('light' + (i + 1).toString()),
						propertyName: 'switch',
						propertyValue: ((buf[3] & (1 << i)) ? 'on' : 'off'),	 // buf[3] 의 값을 bit 연산하여 상태값 읽어오기
					});
				}
				return propArr;
			}
		},

		// 난방 상태
		{ prefix: 0xae, cmdCode: 0x7c, len: 8, log: false, req: 'get', type: 'thermostat', property: { mode: 'off', setTemp: 0, curTemp: 0 }, managed: true,
			setPropertyToMsg: (buf, id, name, value) => {
				buf[2] = Number(id.substr(id.length - 1));	// deviceId의 끝자리 숫자
				return buf;
			}
		},
		// 난방 상태 응답
		{ prefix: 0xb0, cmdCode: 0x7c, len: 8, log: false, req: 'ack', type: 'thermostat', property: { mode: 'off', setTemp: 0, curTemp: 0 }, managed: true,
			parseToProperty: (buf) => {
				// buf[2]:방번호, buf[3]:mode(0:off, 1:on), buf[4]:설정온도, buf[5]:현재온도
				let deviceId = 'thermostat' + buf[2].toString();
				return [
					{ deviceId: deviceId, propertyName: 'mode',    propertyValue: (buf[3] ? 'heat' : 'off') },
					{ deviceId: deviceId, propertyName: 'setTemp', propertyValue: buf[4] },
					{ deviceId: deviceId, propertyName: 'curTemp', propertyValue: buf[5] },
				];
			}
		},

		// 환기 상태
		{ prefix: 0xc2, cmdCode: 0x4e, len: 6, log: true, req: 'get', type: 'vent', property: { switch: 'off', level: 1 }, managed: true,
			setPropertyToMsg: (buf, id, name, value) => {
				return buf;
			}
		},
		// 환기 상태 응답
		{ prefix: 0xb0, cmdCode: 0x4e, len: 6, log: true, req: 'ack', type: 'vent', property: { switch: 'off', level: 1 }, managed: true,
			parseToProperty: (buf) => {
				return [
					{ deviceId: 'vent', propertyName: 'switch', propertyValue: (buf[4] ? 'on' : 'off') },
					{ deviceId: 'vent', propertyName: 'level', propertyValue: buf[2] },
				];
			}
		},

		/////////////////////////////////////////////////////////////////////////////
		// cc : SmartInfoDisplay (현관 정보표시기)

		// 홈정보 cc0b0300020046 : [3]-가스밸브(0:잠김, 1:열림), [4]-???, [5]-현관문(0:닫힘, 1:열림)
		// b0 ackponse는 5byte 길이이며, 별다른 상태값은 없음 (무조건 0) b00b01003a
		// b00c01003d > cc0c010041 > cc0b0300020046 > b00b01003a 의 순서대로 호출됨
		// smartthings capability : Contact Sensor
		// attribute : contact
		// value : (enum : closed / open)
		{ prefix: 0xcc, cmdCode: 0x0b, len: 7, log: true, req: 'report', type: 'SID', property: { valve: 'closed', contact: 'closed' }, managed: true,
			parseToProperty: (buf) => {

				return [
					{ deviceId: 'gasValve', propertyName: 'valve', propertyValue: (buf[3] ? 'open' : 'closed') },
					{ deviceId: 'door', propertyName: 'contact', propertyValue: (buf[5] ? 'open' : 'closed') },
				];
			}
		},
		{ prefix: 0xb0, cmdCode: 0x0b, len: 5, log: true, req: 'ack', type: 'lock', property: { }, managed: true },


		// 날씨 : 매시 3분, 33분, 55분에 발생
		//    cmd 길이 날짜    시간    현재온도  향후5일간 날씨 (날씨종류/최고기온/최저기온) 날씨종류 - 01:맑음, 04:??, 0b:?? 
		// cc 01  16   140315 0f2123  10        041307 011005 010f04 011106 011207 48
		{ prefix: 0xcc, cmdCode: 0x01, len: 26, log: true, req: 'report', type: 'weather', property: { info: { date: '', curTemp: '0', future: [{ type: '0', maxTemp: '0', minTemp: '0'}, { type: '0', maxTemp: '0', minTemp: '0'}, { type: '0', maxTemp: '0', minTemp: '0'}, { type: '0', maxTemp: '0', minTemp: '0'}, { type: '0', maxTemp: '0', minTemp: '0'}]}}, managed: true,
			parseToProperty: (buf) => {
				return [{ deviceId: 'weather', propertyName: 'info', propertyValue: {
						date: new Date(2000 + buf[3], buf[4] - 1, buf[5], buf[6], buf[7], buf[8], 0), // TODO : local 시간 --> UTC으로 저장
						curTemp: buf[9], 
						future: [
							{ type: buf[10], maxTemp: buf[11], minTemp: buf[12]}, 
							{ type: buf[13], maxTemp: buf[14], minTemp: buf[15]}, 
							{ type: buf[16], maxTemp: buf[17], minTemp: buf[18]}, 
							{ type: buf[19], maxTemp: buf[20], minTemp: buf[21]}, 
							{ type: buf[22], maxTemp: buf[23], minTemp: buf[24]}
						]}
					}];
			}
		}, 
		{ prefix: 0xb0, cmdCode: 0x01, len: 5, log: true, req: 'ack', type: 'weather', property: { }, managed: true },

		// 주차위치 상태 (날짜, 시간, 층, 위치) - 현관에 동작감지되면 불림
		//    cmd 길이 ID  날짜    시간   ??         층(B2) 위치(33) padding CS
		// cc 03  14   11  120c01 162231 0030303030 4202 ff 0303     ffffff  10 0x80
		{ prefix: 0xcc, cmdCode: 0x03, len: 24, log: true, req: 'report', type: 'parking', property: { info: { date: '', location: '' }}, managed: true,
			parseToProperty: (buf) => {
				return [{ deviceId: 'parking' + (buf[3] >> 4).toString() , propertyName: 'info', propertyValue: {
						date: new Date(2000 + buf[4], buf[5], buf[6], buf[7], buf[8], buf[9], 0), 
						location: (String.fromCharCode(buf[15]) + buf[16].toString() + '-' + buf[18].toString() + buf[19].toString())
					}}];
			}
		},
		{ prefix: 0xb0, cmdCode: 0x03, len: 5, log: true, req: 'ack', type: 'parking', property: { }, managed: true },


		// 월패드에서 외출설정시 불림. (cc1001015c --> 별도로 ack는 발생 안함)
		{ prefix: 0xcc, cmdCode: 0x10, len: 5, log: true, req: 'report???', type: 'security-away', property: { }},
		{ prefix: 0xb0, cmdCode: 0x10, len: 5, log: true, req: 'ack!!!!', type: 'security-away', property: { }},

		// 월패드에서 외출해제시 불림. (cc0d010040 --> b00d01003c ack)
		{ prefix: 0xcc, cmdCode: 0x0d, len: 5, log: true, req: 'report???', type: 'security-off', property: { }},
		{ prefix: 0xb0, cmdCode: 0x0d, len: 5, log: true, req: '???', type: 'security-off', property: { }},

		// 일괄소등버튼 callback 등록. 이후 버튼 눌리면 아래 ack 발생
		//  --> b00801'00'39 : 일괄조명 off (전등 꺼짐 (ab780053), 가스밸브 잠김 (ac7a000056))
		//  --> b00801'01'39 : 일괄조명 on (전등 켜짐 (485 제어 전등 제외), 가스밸브는 다시 열지 않음)
		{ prefix: 0xcc, cmdCode: 0x08, len: 5, log: true, req: 'reg', type: 'SID-intLight',	property: { switch: 'off' }, managed: true },
		{ prefix: 0xb0, cmdCode: 0x08, len: 5, log: true, req: 'cb',  type: 'SID-intLight',	property: { switch: 'off' }, managed: true,
			parseToProperty: (buf) => {
				return [{ deviceId: 'SID-intLight', propertyName: 'switch', propertyValue: (buf[3] ? 'on' : 'off')}];	// active / inactive
			}
		},

		// 현관 모션센서 callback 등록. 이후 모션 감지되어서 SID 켜지면 ack 발생
		// --> cc03 parking 정보 2개 report 됨
		// [3/24/2020, 8:49:00 AM] [Serial] b004010035 - type: ???-cc-04
		// [3/24/2020, 8:49:00 AM] [Serial] cc04010049 - type: ???-cc-04
		// [3/24/2020, 8:49:01 AM] [Serial] cc031411120c0116223100303030304202ff0303ffffff10 - type: parking
		// [3/24/2020, 8:49:01 AM] [MQTT  ] Publish MQTT : homenet/parking1/info/state -> [object Object]
		// [3/24/2020, 8:49:01 AM] [ST    ] Send event   : /updateProperty/parking1/info/[object Object]
		// [3/24/2020, 8:49:01 AM] [Serial] b003010032 - type: parking
		// [3/24/2020, 8:49:01 AM] [Serial] cc031422110a130a181300303030304202ff0300ffffff33 - type: parking
		// [3/24/2020, 8:49:01 AM] [MQTT  ] Publish MQTT : homenet/parking2/info/state -> [object Object]
		// [3/24/2020, 8:49:01 AM] [ST    ] Send event   : /updateProperty/parking2/info/[object Object]
		// [3/24/2020, 8:49:01 AM] [Serial] b003010032 - type: parking
		{ prefix: 0xcc, cmdCode: 0x04, len: 5, log: true, req: 'reg', type: 'SID-motion', 	property: { motion: 'active' }, managed: true },
		{ prefix: 0xb0, cmdCode: 0x04, len: 5, log: true, req: 'cb',  type: 'SID-motion', 	property: { motion: 'active' }, managed: true,
			parseToProperty: (buf) => {
				// TODO : 일정시간 후에 다시 property를 되돌려 놓아야 함.
				return [{ deviceId: 'SID-motion', propertyName: 'motion', propertyValue: 'active'}];	// active / inactive
			}
		},


		// b006010037 --> cc0601004b --> cc0501ff37 --> b005010034 순으로 주기적으로 불림
		{ prefix: 0xcc, cmdCode: 0x06, len: 5, log: true, req: 'reg', type: '???-cc-06',	property: {  }},
		{ prefix: 0xb0, cmdCode: 0x06, len: 5, log: true, req: 'cb',  type: '???-cc-06',	property: {  }},
		{ prefix: 0xcc, cmdCode: 0x05, len: 5, log: true, req: '???', type: '???-cc-05', 	property: {  }},
		{ prefix: 0xb0, cmdCode: 0x05, len: 5, log: true, req: 'ack', type: '???-cc-05', 	property: {  }},

		{ prefix: 0xcc, cmdCode: 0x0a, len: 5, log: true, req: 'reg', type: '???-cc-0a', 	property: {  }},
		{ prefix: 0xb0, cmdCode: 0x0a, len: 5, log: true, req: 'cb',  type: '???-cc-0a', 	property: {  }},
		{ prefix: 0xcc, cmdCode: 0x0c, len: 5, log: true, req: 'reg', type: '???-cc-0c', 	property: {  }},
		{ prefix: 0xb0, cmdCode: 0x0c, len: 5, log: true, req: 'cb',  type: '???-cc-0c', 	property: {  }},

		{ prefix: 0xcc, cmdCode: 0x09, len: 7, log: true, req: '???', type: '???-cc-09', 	property: {  }},
		{ prefix: 0xb0, cmdCode: 0x09, len: 5, log: true, req: 'ack', type: '???-cc-09', 	property: {  }},
		{ prefix: 0xcc, cmdCode: 0x07, len: 5, log: true, req: '???', type: '???-cc-07', 	property: {  }},
		{ prefix: 0xb0, cmdCode: 0x07, len: 5, log: true, req: 'ack', type: '???-cc-07', 	property: {  }},



		// 41 명령에 대한 응답
		{ prefix: 0xb0, cmdCode: 0x41, len: 4, log: false, req: 'ack', type: 'SID-response', property: {  }},	// 41번 SID에 대한 응답

		//{ prefix: 0xab, cmdCode: 0x41, len: 4, log: false, req: 'get', type: 'SID-gas',		property: {  }},	// 가스밸브 상태
		// // 가스밸브 상태
		// { prefix: 0xab, cmdCode: 0x41, len: 4, log: true, req: 'get', type: 'gasValve', property: { valve: 'closed' }, managed: true,
		// 	setPropertyToMsg: (buf, id, name, value) => {
		// 		return buf;
		// 	}
		// },
		// // 가스밸브 상태 응답
		// { prefix: 0xb0, cmdCode: 0x41, len: 4, log: true, req: 'ack', type: 'gasValve', property: { valve: 'closed' }, managed: true,
		// 	parseToProperty: (buf) => {
		// 		// buf[2] - 0:열림상태, 1:잠김상태
		// 		return [{ deviceId: 'gasValve', propertyName: 'valve', propertyValue: (buf[2] ? 'open' : 'closed') }];
		// 	}
		// },


		{ prefix: 0xac, cmdCode: 0x41, len: 5, log: false, req: 'get', type: 'SID-light??',	property: {  }},	// 여러가지 상태 조회
		{ prefix: 0xad, cmdCode: 0x41, len: 4, log: false, req: 'get', type: 'SID-elevator', property: {  }},	// 엘레베이터 상태??	// 우리집에서는 안나옴
		{ prefix: 0xa5, cmdCode: 0x41, len: 4, log: false, req: 'get', type: 'SID-a5-41',	property: {  }},
		{ prefix: 0xa6, cmdCode: 0x41, len: 4, log: false, req: 'get', type: 'SID-a6-41',	property: {  }},
		{ prefix: 0xcc, cmdCode: 0x41, len: 5, log: false, req: 'get', type: 'SID-cc-41',	property: {  }},

		{ prefix: 0xa1, cmdCode: 0x5a, len: 4, log: false, req: 'sync', type: 'sync1',property: {  }, managed: true},	// 요청만 발생하고, 응답은 없음
		{ prefix: 0xa2, cmdCode: 0x5a, len: 4, log: false, req: 'sync', type: 'sync2',property: {  }, managed: true},	// 요청만 발생하고, 응답은 없음
		{ prefix: 0xa3, cmdCode: 0x5a, len: 4, log: false, req: 'sync', type: 'sync3',property: {  }, managed: true},	// 요청만 발생하고, 응답은 없음
		{ prefix: 0xa4, cmdCode: 0x5a, len: 4, log: false, req: 'sync', type: 'sync4',property: {  }, managed: true},	// 요청만 발생하고, 응답은 없음

		// 분석필요
		{ prefix: 0xa5, cmdCode: 0x31, len: 4, log: true, req: '???', type: '???-a5-31',	property: {  }},
		{ prefix: 0xa6, cmdCode: 0x31, len: 4, log: true, req: '???', type: '???-a6-31',	property: {  }},
		{ prefix: 0xa5, cmdCode: 0x32, len: 4, log: true, req: '???', type: '???-a5-32',	property: {  }},
		{ prefix: 0xa6, cmdCode: 0x32, len: 4, log: true, req: '???', type: '???-a6-32',	property: {  }},
		{ prefix: 0xa5, cmdCode: 0x3e, len: 4, log: true, req: '???', type: '???-a5-3e',	property: {  }},
		{ prefix: 0xa6, cmdCode: 0x3e, len: 4, log: true, req: '???', type: '???-a6-3e',	property: {  }},
	],
};

class Device {
	constructor(type, id) {
		this.type = type;
		this.id = id;
		this.uri = '/homenet/' + id;
		this.property = {};
	}
}

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
				if (chunk[i - 1] == 0xcc) {
					// prefix가 cc인 경우 메시지 종류 바이트 다음 바이트가 길이를 나타낸다.
					this._msgLength = chunk[i + 1];
				} else {
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
		this._syncTime = new Date();
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
			req.on("error", err => error("[ST    ] " + err.message) );
			//req.write(JSON.stringify(deviceStatus));
			req.end();
		} else {
			error("[ST    ] Send to ST FAILED due to no STInfo...");
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// MQTT
	InitMQTTClient() {
		const client = mqtt.connect(CONST.MQTT_BROKER, {clientId: CONST.MQTT_CLIENTID});
		client.on('connect', () => {
			client.subscribe(CONST.MQTT_DEVICE_TOPIC, (err) => {
				if (err) {
					error('[MQTT  ] MQTT Subscribe fail! -', CONST.MQTT_DEVICE_TOPIC);
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
			warn('[MQTT  ] MQTT is not ready... drop message...');
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
				return error('[Serial] Error opening port:', err.message)
			}
		})
		serial.pipe(new CustomTransform()).on('data', this.SerialMessageHandler.bind(this));
		
		return serial;
	}

	CalcChecksum(dataHex) {
		var bite = 0;
		// 모든 bite를 xor 시킨다.
		for(let i = 0 ; i < dataHex.length ; i++) {
			bite ^= dataHex[i];
		}		
		// checksum bite 직전 bite가 FF인 경우를 제외하면 0x80을 한번 더 xor 한다.
		// cc03의 경우, FF가 있어도 0x80 적용한다.
		if ((dataHex[dataHex.length - 2] != 0xFF) || 
			(dataHex[0] == 0xcc && dataHex[1] == 0x03)) {
			bite ^= 0x80;
		}
		return bite;
	}

	// 홈넷에서 SerialPort로 상태 정보 수신
	SerialMessageHandler(dataHex) {
		// 일반적으로 RS485 네트워크에서의 충돌 방지는 마스터가 모든 슬래이브들을 순차적으로 Polling 하는 master/slave 관계로 수행됨. 
		// 대기시간은 모든 노드들의 수와 반응시간에 따라 도출 되기 때문에 훨씬 더 길어짐.

		// SDS의 homenet용 RS485통신의 경우 대략 460ms 주기로 master가 polling 하는 것으로 보임.
		// 항상 a15a007b 메세지로 시작되며, 이 메세지는 약 450 ~ 460ms 주기로 불림.
		// 이 메세지 이후로 약 30ms 간격으로 여러 메세지들이 polling 됨.

		// 각각의 메세지들이 자기가 요청해야 하는 time slot이 정해져 있는 것으로 보임 (30ms 간격)
		// a로 시작하는 메세지는 0~240ms 까지 할당된 것 같고 이에 대한 응답은 대부분 30ms 내에 발생함.
		// cc로 시작하는 명령은 270 ~ 290 사이에 호출되고 응답은 430 ~ 440 ms 내에 발생함.
		
		// 따라서 새로운 메세지를 write 하는 시점은 최초 sync message 이후 300ms정도 지난 후에 하는것이 적절함

		//log('[Serial] Receive interval: ' + (new Date()-this._lastReceive).toString().padStart(5, ' ') + 'ms ->' + dataHex.toString('hex'));
		let isNew = false;
		this._lastReceive = new Date();
		if (dataHex[0] == 0xa1 && dataHex[1] == 0x5a) {
			this._syncTime = this._lastReceive;
		}

		// 수신된 package list에서 찾는다.
		let receivedMsg = this._receivedMsgs.find(e => e.codeHex.equals(dataHex));
		// 이전에 수신된 것이 아니면 새로 생성하여 list에 추가한다.
		if (!receivedMsg) {
			isNew = true;
			// 앞 2바이트로 msginfo를 찾는다.
			var foundMsgInfo = CONST.MSG_INFO.find(e => e.prefix == dataHex[0] && e.cmdCode == dataHex[1]);
			if (!foundMsgInfo) {
				// 만약 없으면 첫번째 바이트는 'b0'로 간주하고 두번째 cmdCode로 msginfo를 찾는다.
				foundMsgInfo = CONST.MSG_INFO.find(e => e.cmdCode == dataHex[1]);
			}
			receivedMsg = {
				code: dataHex.toString('hex'),
				codeHex: dataHex,
				count: 0,
				info: foundMsgInfo
			};
			receivedMsg.checksum = this.CalcChecksum(dataHex);
			this._receivedMsgs.push(receivedMsg);
		}
		receivedMsg.count++;
		receivedMsg.lastlastReceive = receivedMsg.lastReceive;
		receivedMsg.lastReceive = this._lastReceive;
		receivedMsg.timeslot = this._lastReceive - this._syncTime;

		// log - 새로운 메세지이거나, info가 없는 경우이거나, info가 있는데, log 출력을 켠 경우 log 출력함
		if (isNew || !receivedMsg.info || (receivedMsg.info && receivedMsg.info.log)) {
			// 1초 갭이 발생하면 구분자 출력
			if (new Date - this._lastLog > 1000) {
				log("[Serial]------------")
			}
			this._lastLog = new Date();
			let type = (receivedMsg.info) ? receivedMsg.info.type : "unknown";
			log("[Serial] " + (isNew ? "New - " : "") + receivedMsg.code + " - type: " + type);
		}

		// checksum 확인
		if (receivedMsg.checksum != 0) {
			warn("[Serial] Checksum is not match. drop - " + receivedMsg.code + ", checksum : 0x" + receivedMsg.checksum.toString(16));
			return;
		}

		// 관리되지 않는(모르는) message는 처리하지 않는다.
		if (!receivedMsg.info) {
			//warn("[Serial] Drop Unmanaged message - " + receivedMsg.code);
			return;
		}

		// packet length 확인
		// if (receivedMsg.info.len != dataHex.length) {
		// 	warn("[Serial] Message length is not match. drop message - " + receivedMsg.code + ". expected len : " + receivedMsg.info.len + ", real len : " + dataHex.length);
		// 	return;
		// }

		// 제어 요청에 대한 ack를 받았으면, 해당 명령의 callback 호출 후 명령큐에서 삭제
		let foundIdx = this._serialCmdQueue.findIndex(e => ((dataHex[0] == 0xb0) && (dataHex[1] == e.cmdHex[1])));
		if (foundIdx > -1) {
			log('[Serial] Success command:', dataHex.toString('hex'));
			// 해당 명령에 callback이 정의되어 있으면 호출한다.
			if (this._serialCmdQueue[foundIdx].callback) {
				this._serialCmdQueue[foundIdx].callback(receivedMsg);
			}
			this._serialCmdQueue.splice(foundIdx, 1);
			// 요청에 의한 응답은 값이 변경되지 않아도 무조건 update하여 각 platform에 response가 전달되도록 한다.
			var force = true;
		}

		// 메세지를 parsing 하여 property로 변환한다.
		if (receivedMsg.info.parseToProperty) {
			// Serial 메세지 내용을 parsing 하여 property로 변환한다.
			var propArray = receivedMsg.info.parseToProperty(dataHex);
			// 각 property 값을 반영한다.
			for(var prop of propArray) {
				this.UpdateDeviceProperty(receivedMsg.info.type, prop.deviceId, prop.propertyName, prop.propertyValue, force);
			}
		}
	}

	AddSerialCommandToQueue(cmdHex, deviceId, propertyName, propertyValue, callback) {
		let now = new Date();
		var serialCmd = {
			cmdHex: cmdHex,
			deviceId: deviceId,
			property: propertyName,
			value: propertyValue,
			callback: callback,
			sentTime: now,
			retryCount: CONST.SERIAL_SEND_RETRY_COUNT
		};
		// 실행 큐에 저장
		log('[Serial] Send to Device : ' + serialCmd.cmdHex.toString('hex') + ' : ' + serialCmd.deviceId + '-' + serialCmd.property + '->' + serialCmd.value);
		this._serialCmdQueue.push(serialCmd);

		// 실행 process 수행 (가급적 빈 timeslot에 명령을 넣도록 한다.)
		// 메세지 충돌을 방지하기 위해서 sync 메세지 (a15a007b) 발생 이후 300ms 이후시간에 요청하도록 함
		let elapsed = now - this._syncTime;
		let delay = (elapsed < 300) ? 300 - elapsed : 0;
		if (delay != 0) {
			log('[Serial] Sync message occured ' + elapsed + 'ms ago. In order to prevent confliction, send message after ' + delay + 'ms.');
		}
		setTimeout(this.ProcessSerialCommand.bind(this), delay);
	}

	// SerialPort로 제어 명령 전송
	ProcessSerialCommand() {
		// 큐에 처리할 메시지가 없으면 종료
		if (this._serialCmdQueue.length == 0) return;

		// 큐에서 제어 메시지 가져오기
		var serialCmd = this._serialCmdQueue.shift();
		serialCmd.sentTime = new Date();

		if (serialCmd.retryCount != CONST.SERIAL_SEND_RETRY_COUNT) {
			warn('[Serial] Retrying send to Device - ' + serialCmd.cmdHex.toString('hex') + ' : ' + serialCmd.deviceId + '-' + serialCmd.property + '->' + serialCmd.value);
		}

		// serial port에 해당 hex command를 입력한다.
		this._serialPort.write(serialCmd.cmdHex, (err) => { if (err) return error('[Serial] Send Error: ', err.message); });

		// 재시도
		if (serialCmd.retryCount > 0) {
			// ack 메세지 받을때까지는 재시도 횟수만큼 retry 한다.
			serialCmd.retryCount--;
			this._serialCmdQueue.push(serialCmd);
			setTimeout(this.ProcessSerialCommand.bind(this), CONST.SERIAL_SEND_RETRY_DELAY);
		} else {
			// retry 횟수를 초과하면 err callback을 부른다.
			let errorMsg = '[Serial] ERROR!! No response after retrying ' + CONST.SERIAL_SEND_RETRY_COUNT + ' times.';
			error(errorMsg);
			if (serialCmd.callback) {
				serialCmd.callback.call(this, );
			}
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// RS485 devices
	
	AddDevice(type, id, property) {
		var deviceStatus = {
			type: type,
			id: id,
			uri: '/homenet/' + id,
			property: (property ? property : {})
		};
		log('[Server] Adding new deviceStatus - ' + JSON.stringify(deviceStatus));
		this._deviceStatus.push(deviceStatus);
		// TODO : 각 platform에 device 생성 event 보냄
		return deviceStatus;
	}

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

	SetDeviceProperty(deviceId, propertyName, propertyValue, callback) {
		log('[Server] SetDeviceProperty - ' + deviceId + '/' + propertyName + ' -> ' + propertyValue);
	
		// 현재 상태와 같으면 Skip
		// if (propertyValue === this._deviceStatusCache[deviceId + propertyName]) {
		// 	log('[Server] property value is same with before. skip.');
		// 	return;
		// }

		var type = this.GetDeviceStatus(deviceId).type;
		//log('type : ' + type);

		// 해당 type 중, 해당 propertyName을 가진 msgInfo를 찾는다.
		var msgInfo = CONST.MSG_INFO.find(e => ((e.setPropertyToMsg) && (e.type == type) && e.property.hasOwnProperty(propertyName)));

		if (!msgInfo) {
			warn('[Server] There is no message info regarding to type : ' + type + ', propertyName : ' + propertyName);
			return;
		}

		//log('msgInfo : ' + JSON.stringify(msgInfo));
		var cmdHex = Buffer.alloc(msgInfo.len);
		cmdHex[0] = msgInfo.prefix;
		cmdHex[1] = msgInfo.cmdCode;
		cmdHex = msgInfo.setPropertyToMsg(cmdHex, deviceId, propertyName, propertyValue);
		cmdHex[msgInfo.len - 1] = this.CalcChecksum(cmdHex);

		// Serial메시지 제어명령 전송
		log('[Server] Add to queue for applying new value. - ' + cmdHex.toString('hex'));
		this.AddSerialCommandToQueue(cmdHex, deviceId, propertyName, propertyValue, callback);
		
		// 내부 상태정보 update 및 MQTT & ST로 상태정보 전송
		//this.UpdateDeviceProperty(type, deviceId, propertyName, propertyValue);	// 처리시간의 Delay때문에 미리 상태 반영
	}

	UpdateDeviceProperty(type, deviceId, propertyName, propertyValue, force) {
		// 이전과 상태가 같으면 반영 중지
		let curPropertyValue = this._deviceStatusCache[deviceId + propertyName];
		if(!force && curPropertyValue && (propertyValue === curPropertyValue)) {
			//log('[Server] The status is same as before... skip...');
			return;
		}
		log('[Server] UpdateDeviceStatus: type:' + type + ', deviceId:' + deviceId + ', propertyName:' + propertyName + ', propertyValue:' + propertyValue);

		// 미리 상태 반영한 device의 상태 원복 방지
		//if(this._serialCmdQueue.length > 0) {
		//	let found = this._serialCmdQueue.find(e => e.deviceId === deviceId && e.property === propertyName && e.value === curPropertyValue);
		//	if(found != null) return;
		//}

		this._deviceStatusCache[deviceId + propertyName] = propertyValue;
		// 이전에 없던 device이면 새로 생성한다.
		let deviceStatus = this._deviceStatus.find(o => (o.id === deviceId));
		if (!deviceStatus) {
			deviceStatus = this.AddDevice(type, deviceId);
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
		app.post('/smartthings/installed', 			(req, res) => this.HTTPCommonHandler(req, res, this.HTTP_post_smartthings_installed.bind(this)));		
		app.post('/smartthings/uninstalled',		(req, res) => this.HTTPCommonHandler(req, res, this.HTTP_post_smartthings_uninstalled.bind(this)));
		app.get ('/serial/:cmd', 					(req, res) => this.HTTPCommonHandler(req, res, this.HTTP_get_homenet_serial.bind(this)));		
		app.get ('/log', 							(req, res) => this.HTTPCommonHandler(req, res, this.HTTP_get_log.bind(this)));
		app.get ('/resetlog', 						(req, res) => this.HTTPCommonHandler(req, res, this.HTTP_get_resetlog.bind(this)));
		app.get ('/status', 						(req, res) => this.HTTPCommonHandler(req, res, this.HTTP_get_status.bind(this)));
		app.get ('/scan',							(req, res) => this.HTTPCommonHandler(req, res, this.HTTP_get_scan.bind(this)));
	}

	HTTPCommonHandler(req, res, callback) {
		log('[HTTP  ] ' + req.method + ' : ' + req.url);
		var result = {};
		try {
			result = callback(req, res);
			res.status(200);
			log('[HTTP  ] result : OK');
		} catch (e) {
			result.message = e.toString();
			res.status(400);
			error('[HTTP  ] result : FAIL - ' + e.stack);
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
		this.SetDeviceProperty(req.params.id, req.params.property, req.params.value, () => {

		});
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
	
	// serial로 message 전달
	HTTP_get_homenet_serial(req) {
		var cmdHex = Buffer.alloc(req.params.cmd.length / 2, req.params.cmd, 'hex');
		this.AddSerialCommandToQueue(cmdHex);
		return { message: "Success" };
	}

	HTTP_get_log(req) {
		var result = "<pre>";
		result += fs.readFileSync('log/server.log', 'utf8')
		result += "</pre>";
		return result;
	}

	HTTP_get_resetlog(req) {
		// 로그파일명에 날짜/시간을 붙이기 위해 형식 지정
		let date = new Date();
		let Y = date.getFullYear();
		let M = date.getMonth() + 1;
		if (M < 10) M = '0' + M;
		let D = date.getDate();
		if (D < 10) D = '0' + D;
		let h = date.getHours();
		if (h < 10) h = '0' + h;
		let m = date.getMinutes();
		if (m < 10) m = '0' + m;
		let s = date.getSeconds();
		if (s < 10) s = '0' + s;
		let dateStr = Y + M + D + "-" + h + m + s;

		let logFileName = 'log/server.log';
		let targetFileName = 'log/server-' + dateStr + '.log';
		log('Backup log file ' + logFileName + ' --> ' + targetFileName);
		fs.copyFile(logFileName, targetFileName, (err) => {
			if (err) throw err;
			log(logFileName + ' was copied to ' + targetFileName);
			fs.truncate(logFileName, 0, () => {
				log(logFileName + ' was truncated.');
			})
		});

		return { message: "Success" };
	}

	HTTP_get_status(req) {
		var result = "<pre>";

		result += "         Current device Status1\n";
		result += "=========================================================================================================================\n";
		result += "Type           DeviceId       Properties\n";
		result += "=========================================================================================================================\n";
		for (let i in this._deviceStatus) {
			let type = this._deviceStatus[i].type;
			let id = this._deviceStatus[i].id;
			let property = JSON.stringify(this._deviceStatus[i].property);
			result += 
				type.padEnd(14, ' ') + ' ' +
				id.padEnd(14, ' ') + ' ' +
				property +
				'\n';
		}
		result += "=========================================================================================================================\n";


		var managedStr = "";
		var knownStr = "";
		var filteredStr = "";
		var unknownStr = "";
		result += "\n         Recieved Serial Messages\n";
		result += "=========================================================================================================================\n";
		result += "U  Serial message       CS   Type            Req       Managed   Count   Period   slot   Time(ms)   Last received\n";
		result += "=========================================================================================================================\n";
		for (let i in this._receivedMsgs) {
			let msg = this._receivedMsgs[i];
			let isUpdated = (msg.lastCount != msg.count) ? "*  " : "   ";
			let code = (msg.code.length <= 20) ? msg.code.padEnd(20, ' ') : msg.code + "\n" + "                       ";
			let cs = (msg.checksum == 0) ? ' OK ' : '0x' + msg.checksum.toString(16).padStart(2, '0');
			let type = msg.info ? msg.info.type : "";
			let req = msg.info ? msg.info.req.padEnd(7, ' ') : "       ";
			let managed = (msg.info && msg.info.managed) ? "O "  : "X ";
			let period = (msg.lastReceive - msg.lastlastReceive).toString();
			let slot = (msg.timeslot).toString();
			let time = (new Date() - msg.lastReceive).toString();

			let str = 
				isUpdated +
				code +
				cs + '  ' +
				type.padEnd(15, ' ') + ' ' +
				req + '      ' +
				managed +
				msg.count.toString().padStart(10, ' ') + ' ' +
				period.padStart(8, ' ') + ' ' +
				slot.padStart(6, ' ') + ' ' +
				time.padStart(10, ' ') + '   ' +
				msg.lastReceive.toLocaleString() +
				'\n';			
			msg.lastCount = msg.count;

			if (msg.info) {
				if (msg.info.managed) {
					managedStr += str;
				} else if (msg.info.log) {
					filteredStr += str;
				} else {
					knownStr += str;
				}
			} else {
				unknownStr += str;
			}
		}
		
		result += "-- Managed messages -----------------------------------------------------------------------------------------------------\n";
		result += managedStr;
		result += "-- Unmanaged messages ---------------------------------------------------------------------------------------------------\n";
		result += knownStr;
		result += "-- Log filtered messages ------------------------------------------------------------------------------------------------\n";
		result += filteredStr;
		result += "-- Unknown messages -----------------------------------------------------------------------------------------------------\n";
		result += unknownStr;
		result += "=========================================================================================================================\n";

		result += "</pre>";
		return result;
	}

	HTTP_get_scan(req) {
		// 상태 조회 가능한 device 종류에 대해 request 해본 후 응답 오는 device에 대해 회신한다.		
		const msgInfos = CONST.MSG_INFO.filter(e => ((e.managed == true) && (e.req == 'get') && (e.setPropertyToMsg)));
		for(var msgInfo of msgInfos) {
			if (msgInfo.type == 'thermostat') {
				for(let i = 0 ; i < 5 ; i++) {
					log('msgInfo : ' + JSON.stringify(msgInfo));
					let cmdHex = Buffer.alloc(msgInfo.len);
					cmdHex[0] = msgInfo.prefix;
					cmdHex[1] = msgInfo.cmdCode;
					cmdHex = msgInfo.setPropertyToMsg(cmdHex, msgInfo.type + i);
					cmdHex[msgInfo.len - 1] = this.CalcChecksum(cmdHex);
	
					// this.AddSerialCommandToQueue(cmdHex, msgInfo.type + i, null, null, () => {
					// 	log('CONFIRMED!!! - msgInfo.type + i');
					// });
				}

			} else {
				log('msgInfo : ' + JSON.stringify(msgInfo));
				let cmdHex = Buffer.alloc(msgInfo.len);
				cmdHex[0] = msgInfo.prefix;
				cmdHex[1] = msgInfo.cmdCode;
				cmdHex = msgInfo.setPropertyToMsg(cmdHex, msgInfo.type);
				cmdHex[msgInfo.len - 1] = this.CalcChecksum(cmdHex);

				// this.AddSerialCommandToQueue(cmdHex, msgInfo.type, null, null, () => {
				// 	log('CONFIRMED!!! - msgInfo.type + i');
				// });
			}
		}		
		return { message: "Success" };
	}	
}

_RS485server = new RS485server();
