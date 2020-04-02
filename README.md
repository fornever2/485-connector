# Overview

485-connector는 RS485로 제어되는 homenet 기기들을 SmartThings로 제어하기 위한 connector 모듈이다.  
기본적인 concept은 Naver의 [SmartThings community](https://cafe.naver.com/stsmarthome/)에서 에리타님 게시물( https://cafe.naver.com/stsmarthome/7256 )을 참고하여 작성하였다.  
또한, 아기나무집님의 [mi-connector](https://github.com/fison67/mi_connector), [ty-connector](https://github.com/fison67/TY-Connector) 등 다양한 connector를 참고하여 작성되었다.  

-------------------------------------------------------------------------

목차

- [Prerequisites](#prerequisites)
- [How to install](#how-to-install)
  * [Install 485server](#install-485server)
  * [Install SmartApp](#install-smartapp)
    + [Manual install (copy & paste code)](#manual-install--copy---paste-code-)
    + [Install SmartApp using the GitHub Repo integration](#install-smartapp-using-the-github-repo-integration)
  * [Install DTH (Device Type Handler)](#install-dth--device-type-handler-)
    + [Manual install (copy & paste code)](#manual-install--copy---paste-code--1)
    + [Install DTH using the GitHub Repo integration](#install-dth-using-the-github-repo-integration)
- [How to setup](#how-to-setup)
  * [Configure 485server](#configure-485server)
    + [Serial Port](#serial-port)
  * [Run 485server](#run-485server)
  * [Install 485-connector SmartApp into SmartThings app](#install-485-connector-smartapp-into-smartthings-app)
- [How to analyze serial message](#how-to-analyze-serial-message)
  * [Parse RS485 serial message](#parse-rs485-serial-message)
  * [Writing serial message to RS485 system](#writing-serial-message-to-rs485-system)
  * [Log](#log)
    + [Watch Log](#watch-log)
    + [Reset Log File](#reset-log-file)
    + [Configure Log](#configure-log)
  * [485server Status](#485server-status)
    + [Current device Status](#current-device-status)
    + [Recieved Serial Messages](#recieved-serial-messages)
- [How to add/modify serial message handler](#how-to-add-modify-serial-message-handler)
- [미진사항](#미진사항)

-------------------------------------------------------------------------

# Prerequisites

- SmartThings 계정
- RS485 to Serial 모듈
- Node.js와 npm이 설치된 local server (Raspberry Pi, Linux Server 등)

-------------------------------------------------------------------------

# How to install

485-connector는 다음 3가지 주요 파트로 구성되어 있다.  
- **485server** : node.js로 구동되는 서버. homenet과 RS485 시리얼 포트와 연결되어 메세지 parsing 및 명령 전달을 수행하며, SmartThings hub를 통해 SmartThings cloud와 통신하여 이벤트 전달을 수행한다.  
- **SmartApp** : groovy로 작성된 SmartThings cloud에 설치되는 service application. 485server와 통신하여 SmartThings 동작을 수행한다.  
- **DTH (Device Type Handler)** : groovy로 작성된 SmartThings cloud에 설치되는 device handler. 각 RS485 homenet device의 동작을 처리한다.  

## Install 485server

github로부터 clone 또는 download 받아서 `npm install` 명령 수행  
```bash
$ git clone git@github.com:fornever2/485-connector.git
$ cd 485-connector/485server
$ npm install
```

## Install SmartApp

### Manual install (copy & paste code)

1. Go to the [SmartThings IDE](https://account.smartthings.com/)
2. Click `My SmartApps`
3. Click `New SmartApp`
4. Click `From Code`
5. Copy content of [`485-connector.groovy`](smartapps/fornever2/485-connector.src/485-connector.groovy) & Paste
6. Click `Create`
7. Click `My SmartApps` & `Edit properties` (485-connector)
8. Click `OAuth` option and click on the `Enable OAuth` button
9. Click `Update`

### Install SmartApp using the GitHub Repo integration

> 설치전에 GitHub integration을 수행하여야 함  
> [SmartThings guide](https://docs.smartthings.com/en/latest/tools-and-ide/github-integration.html#step-1-enable-github-integration) 를 참고하여 SmartThings account와  GitHub integration을 enable 한다.  

1. Go to the [SmartThings IDE](https://account.smartthings.com/)
2. Select the `My SmartApps` tab
  > 아래 3 ~ 5번 step은 이전에 수행한 이력이 있으면 생략 가능  
3. Click `Settings` button
4. Click `Add new repository` option and fill in the following information:   
    - Owner: fornever2   
    - Name: 485-connector   
    - Branch: master   
5. Click `Save` button
6. Click `Update from Repo` button and select the `485-connector (master)` option
7. Check the checkbox for all items in the `New (only in GitHub)` column
8. Check the `Publish` checkbox and click `Execute Update` button
9. Select the `My SmartApps` tab
10. Click `Edit Properties` icon button on the left of the 485-onnector SmartApp (fornever2 : 485-connector)
11. Click `OAuth` option and click on the `Enable OAuth` button
12. Click `Update` button

## Install DTH (Device Type Handler)

### Manual install (copy & paste code)

1. Go to the [SmartThings IDE](https://account.smartthings.com/)
2. Click `My Device Handlers`
3. Click `Create New Device Handlers`
4. Click `From Code`
5. Copy content of file in the [`devicetypes/forenver`](devicetypes/fornever2) folder to the area
6. Click `Create`
7. Loop until all of files are registered

### Install DTH using the GitHub Repo integration

> 설치전에 GitHub integration을 수행하여야 함  
> [SmartThings guide](https://docs.smartthings.com/en/latest/tools-and-ide/github-integration.html#step-1-enable-github-integration) 를 참고하여 SmartThings account와  GitHub integration을 enable 한다.  

1. Go to the [SmartThings IDE](https://account.smartthings.com/)
2. Select the `My Device Handlers` tab
  > 아래 3 ~ 5번 step은 이전에 수행한 이력이 있으면 생략 가능
3. Click `Settings` button
4. Click `Add new repository` option and fill in the following information:
    - Owner: fornever2  
    - Name: 485-connector  
    - Branch: master  
5. Click `Save` button
6. Click `Update from Repo` button and select the `485-connector (master)` option
7. Check the checkbox for the device types you need (or all of them) in the `New (only in GitHub)` column
8. Check the `Publish` checkbox and click on the `Execute Update` button

-------------------------------------------------------------------------

# How to setup

***TBD***

## Configure 485server

***TBD***

### Serial Port

***TBD***

## Run 485server

485server는 node.js를 기반으로 구동되므로 아래 명령으로 수행 가능하다.  
```bash
$ cd 485-connector/485server
$ node index.js
```
다만, 이렇게 수행할 경우, 명령을 수행한 shell이 종료될 때 server가 함께 종료되므로, debuggin 등 일시적으로 test 할 때에는 적절하지만, 지속적으로 구동되어야 하는 server로 동작하기에는 무리가 있다.  
따라서, [`forever`](https://www.npmjs.com/package/forever) service를 이용하여 상시 구동 가능하도록 설정한다.  
`forever` service는 아래 명령으로 설치 가능하다. (전역 설치를 위해 `-g` option 을 사용하였다.)  
```bash
$ npm install -g forever
```
또한, 파일 수정시 또는 문제발생하여 종료되었을 때 자동 재구동 되도록 watch 옵션을 설정하거나, log 파일등을 제어하기 위해 [`485server/forever.json`](485server/forever.json) 파일을 작성해 두었다.  

> ***주의 : 이 `forever.json` 파일 내의 path등은 개인의 환경에 맞게 수정되어야 함***  

그리고, `forever` service가 라즈베리파이 부팅시 자동 실행되도록 아래의 내용을 bashrc등 부팅 script에 추가하면 된다.  
```
mkdir -p ~/github/485-connector/485server/log
forever start ~/github/485-connector/485server/forever.json
```
위에서 `mkdir -p` 명령으로 log directory를 생성한 이유는, 해당 directory가 없을 경우, log 생성이 안되어 forever service 구동에 실패하기 때문이다.  
또한, `log` directory에 파일이 계속 생성/수정되기 때문에, `forever`의 `watch` option을 사용할 경우 무한 재기동이 될 수 있기 때문에, [`485server/.foreverignore`](485server/.foreverignore) 파일에 수정을 허용하는 파일에 대한 list를 명기하여야 한다.

## Install 485-connector SmartApp into SmartThings app

***TBD***

-------------------------------------------------------------------------

# How to analyze serial message

RS485 homenet의 경우 정해진 표준 protocol이 없기때문에, 각 회사나 아파트단지별로 각기 다른 protocol로 구동된다.  
그래서, 각자 자신의 환경에 맞도록 serial message를 분석해서 적용해야 한다.  
이를 위해 각각 기기를 동작시키면서 serial message를 모니터링하여 분석하는 환경이 필요하여, 몇가지 util성 기능을 추가하였다.  

## Parse RS485 serial message

참고로, 본 project의 parser는 네이버 SmartThings community의 에리타님께서 분석한 Samsung SDS homenet의 내용 ( https://cafe.naver.com/stsmarthome/7256 )을 참고하여 작성되었다. (일부는 우리집의 환경에 맞게 수정되었다.)  
		
각 serial message 별 spec은 [`485server/index.js`](485server/index.js) 파일 내의 `CONST.MSG_INFO` json object에 명시되어 있다.
```javascript
...
MSG_INFO: [
	// 난방 온도 제어
	{ prefix: 0xae, cmdCode: 0x7f, len: 8, log: true, req: 'set', type: 'thermostat', property: { setTemp: 0 }, managed: true,
		setPropertyToMsg: (buf, id, name, value) => {
			buf[2] = Number(id.substr(id.length - 1));	// deviceId의 끝자리 숫자
			buf[3] = Number(value);				// 설정 온도 문자열을 숫자로 변환
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
...
```
serial message는 첫 1byte(`prefix`)가 485 장치 ID를 나타내는 것으로 보인다.  
또한, 이에 대한 응답(ack)는 `prefix`가 0xb0로 시작하는 메세지가 전달되는 것으로 보인다.  

두번째 byte(`cmdCode`)가 명령어 ID를 나타내는 것으로 보이며, 각 명령에 따라 message의 길이가 결정되는 것으로 보인다 (`len`).  
특히 0xcc로 시작하는 message의 경우, 세번째 byte가 이후 전달되는 data의 길이를 나타낸다.  

각각의 message의 request type (`req`)는 다음과 같다.  
- sync : 각 메세지의 time slot 동기화를 위한 동기메세지  
- get : 상태 조회 요청 메세지  
- set : 제어 요청 메세지  
- ack : get / set 등의 요청에 대한 응답 메세지  
- reg : register callback - 특정 상황이 되면 cb 메세지를 보내달라고 요청하는 callback 등록 메세지  
- cb : reg 요청이 있었을 때, 특정 상황이 되면 불리는 callback 메세지  
- report : 별다른 요청이 없어도 특정 상황이 되거나, 특정 시간이 되면 상황을 report 하는 메세지 (날씨, SID 등)

`type`은 SmartThings의 DTH가 구분하는 device type이며 대략 아래와 같으며, 종류는 추가될 수 있다.
- sync1 / sync2 / sync3 / sync4 : 각 메세지에 할당된 time slot 동기화를 맞추기 위한 메세지로 보임.
- light : 조명
- thermostat : 난방
- SID : Smart Info Display (현관의 조그만 정보 표시장치로, 날씨, 주차위치, 미세먼지, 일괄조명 등의 상태 표시)

`property`는 SmartThings에서 해당 device에 대해 제어 가능한 항목들이다.  

이렇게 분석되어 parsing 및 명령이 가능한 message는 `managed` option을 `true`로 설정하였다.  

또한, serial message가 짧은 시간에 너무 많이 발생하기 때문에, log 분석에 어려움이 있어, message별로 log에 출력할지 여부를 `log` property를 통해 설정할 수 있게 하였다.

각 message 별로 parsing logic은 `parseToProperty` function에서 수행되도록 하였으며, 명령을 내리는 경우에는 `setPropertyToMsg` function을 통해 명령을 위한 serial message를 생성하도록 하였다.

그리고, 공통적으로 마지막 byte는 checksum을 나타낸다.  
Checksum 계산방법은 Checksum byte를 제외한 모든 byte를 XOR 한 후, 0x80을 한 번 더 XOR 한다. 단, checksum bite 직전 bite가 FF인 경우에는 0x80을 XOR 하지 않는다. (특이하게, 0xcc03으로 시작하는 경우에는 0xFF가 있어도 0x80 적용)  

## Writing serial message to RS485 system

RS485 통신 특성상 다른 message와의 충돌을 막기 위한 방법이 필요하다.  
업체마다 고유의 protocol을 사용할 수 있고, modbus 같은 표준 방식을 사용할 수도 있는데, Samsung SDS homenet의 경우 modbus를 사용하는 것 같지는 않아 보인다.  

serial log를 분석하다가 발견한 내용으로는 a15a007b, a25a0078, a35a0079, a45a007e 메세지(a.k.a. sync message)가 30ms 간격으로 발생한 후, 각각의 message들이 대략 30ms timeslot을 할당받은 것으로 보이며, 약 470ms 주기로 반복된다.  
이 중, 대부분의 상태조회 message는 0ms ~ 250ms 구간에 빈번하게 발생하며, 그 외의 message들은 250ms ~ 470ms 구간에 산발적으로 발생한다.  
따라서, 485server는 serial port에 message를 write 할 때 최대한 충돌을 피하기 위해 0ms ~ 300ms 구간을 피해서 write 하도록 설계하였다.  

485server는 485 명령을 test 하기 위해서 web url을 제공한다.  
아래 url을 browser에 입력함으로서 RS485 homenet에 serial message를 write 할 수 있다.  
```
http://<ip-address>:<port-number>/serial/<serial-message>
ex) http://192.168.29.100:8080/serial/ac79000154
```

## Log

### Watch Log

만약 485server를 `$ node index.js` 명령으로 수행했다면, console log가 바로 출력되어 log를 볼 수 있지만, `forever` service를 통하여 구동되었다면, log는 파일로 저장되기때문에, live log를 바로 직접 볼 수는 없을 것이다.  
이 경우, 아래의 방법들을 이용하여 log를 볼 수 있다.  
`Forever` service 는 [`485server/forever.json`](485server/forever.json) 파일에 아래와 같이 설정된 path의 파일에 log를 저장한다.  
```
  "logFile": "/home/pi/github/485-connector/485server/log/server.log"
```
log가 파일에 저장되기 때문에, live log를 보기 어려울 때에는 아래와 같이 linux의 `tail` 명령을 이용해서 실시간으로 볼 수 있다.  
```bash
$ tail -f /home/pi/github/485-connector/485server/log/server.log
```
또는, 485server가 정상적으로 구동되고 있다면, 아래의 url을 webbrowser로 열면 log를 볼 수 있다.  
단, webbrowser로는 live log가 지속 update 되지는 않으므로 refresh를 통해 갱신해 가면서 보아야 한다.  
```
http://<ip-address>:<port-number>/log
ex) http://192.168.29.100:8080/log
```

### Reset Log File

간혹, log파일이 너무 클 경우 browser에서 출력을 못하고 오류가 날 수도 있다.  
이 경우 아래의 url을 browser에서 열면 기존의 log는 `server-<date>-<time>.log` 파일 이름으로 변경되어 backup되고, 새로 log를 시작한다.  
```
http://<ip-address>:<port-number>/resetlog
ex) http://192.168.29.100:8080/resetlog
```

### Configure Log

앞서 설명한대로, Serial port로 전달되는 메세지가 너무 많기 때문에, 분석에 어려움이 있을 수 있어서, serial message 별로 로그 출력 여부를 설정할 수 있는 option을 추가하였다.  
[`485server/index.js`](485server/index.js) 파일 내에서 `CONST.MSG_INFO` json object 내의 각 message 별 항목 중 `log` property를 `true` 나 `false`로 설정하여 해당 message를 log에 출력할지 여부를 설정할 수 있다.  

## 485server Status

단순히 로그만으로 전체적인 message의 추이를 살펴보기에는 무리가 있기 때문에, 485server의 전반적은 상태를 모니터링 할 수 있는 webpage를 제공한다.  
browser에서 아래 url을 입력하면 전반적인 상태에 대해 보여준다.  

> ***주의 : 본 PROJECT는 필자 아파트의 HOMENET에 맞도록 구현되어 있으므로 모든 환경에 맞는 정보가 표시되지 않을 수 있다.***  

```
http://<ip-address>:<port-number>/status
ex) http://192.168.29.100:8080/status
```
그러면, 아래와 같은 화면이 표시된다.
```
 RS485 server - started at 4/1/2020, 8:02:40 PM

 Current device Status
=========================================================================================================================
Type           DeviceId       Properties
=========================================================================================================================
light          light1         {"switch":"off"}
light          light2         {"switch":"on"}
thermostat     thermostat5    {"mode":"off","setTemp":18,"curTemp":26}
thermostat     thermostat1    {"mode":"off","setTemp":18,"curTemp":27}
thermostat     thermostat3    {"mode":"off","setTemp":18,"curTemp":26}
thermostat     thermostat4    {"mode":"off","setTemp":18,"curTemp":26}
SID            gasValve       {"valve":"closed"}
SID            door           {"contact":"closed"}
=========================================================================================================================

 Recieved Serial Messages
=========================================================================================================================
U  Serial message       CS   Type            Req       Managed   Count   Period   Slot    Elapsed   Last received
=========================================================================================================================
-- Managed messages -----------------------------------------------------------------------------------------------------
*  a15a007b             OK   sync1           sync         O         81      469      0        197   4/1/2020, 8:03:17 PM
*  a25a0078             OK   sync2           sync         O         81      470     31        166   4/1/2020, 8:03:18 PM
*  a35a0079             OK   sync3           sync         O         81      469     60        137   4/1/2020, 8:03:18 PM
*  a45a007e             OK   sync4           sync         O         81      471     92        105   4/1/2020, 8:03:18 PM
*  ac79000154           OK   light           get          O         41      460    181        486   4/1/2020, 8:03:17 PM
*  b07921026a           OK   light           ack          O         41      459    195        472   4/1/2020, 8:03:17 PM
   ae7c050000000057     OK   thermostat      get          O         20     1850    226       1836   4/1/2020, 8:03:16 PM
   b07c0500121aff3e     OK   thermostat      ack          O         20     1852    253       1809   4/1/2020, 8:03:16 PM
   ae7c010000000053     OK   thermostat      get          O         20     1849    221       1373   4/1/2020, 8:03:16 PM
   b07c0100121bff3b     OK   thermostat      ack          O         20     1851    248       1346   4/1/2020, 8:03:16 PM
   ae7c030000000051     OK   thermostat      get          O         20     1854    219        909   4/1/2020, 8:03:17 PM
   b07c0300121aff38     OK   thermostat      ack          O         20     1856    247        881   4/1/2020, 8:03:17 PM
*  ae7c040000000056     OK   thermostat      get          O         20     1859    225        443   4/1/2020, 8:03:17 PM
*  b07c0400121aff3f     OK   thermostat      ack          O         20     1861    252        416   4/1/2020, 8:03:17 PM
   cc0b0300020046       OK   SID             report       O          1      NaN    277      22634   4/1/2020, 8:02:55 PM
   b00b01003a           OK   lock            ack          O          1      NaN    434      22477   4/1/2020, 8:02:55 PM
-- Unmanaged messages ---------------------------------------------------------------------------------------------------
*  a5410064             OK   SID-a5-41       get          X         81      471     92        105   4/1/2020, 8:03:18 PM
*  b0410071             OK   SID-response    ack          X        162       30    131         66   4/1/2020, 8:03:18 PM
*  a6410067             OK   SID-a6-41       get          X         81      469    121         76   4/1/2020, 8:03:18 PM
*  ab41006a             OK   SID-gas         get          X         81      470    151         47   4/1/2020, 8:03:18 PM
*  b0410170             OK   SID-response    ack          X         81      471    166         32   4/1/2020, 8:03:18 PM
*  cc4101000c           OK   SID-cc-41       get          X         76      465    281        386   4/1/2020, 8:03:17 PM
*  b041010070           OK   SID-response    ack          X         76      465    290        377   4/1/2020, 8:03:17 PM
*  ac41006d             OK   SID-light??     get          X         40     1395    180         18   4/1/2020, 8:03:18 PM
-- Log filtered messages ------------------------------------------------------------------------------------------------
   b00c01003d           OK   ???-cc-0c       cb           X          1      NaN    436      23401   4/1/2020, 8:02:54 PM
   cc0c010041           OK   ???-cc-0c       reg          X          1      NaN    276      23095   4/1/2020, 8:02:55 PM
   cc090300200066       OK   ???-cc-09       ???          X          1      NaN    278       4100   4/1/2020, 8:03:14 PM
   b009010038           OK   ???-cc-09       ack          X          1      NaN    434       3944   4/1/2020, 8:03:14 PM
   cc0701004a           OK   ???-cc-07       ???          X          1      NaN    281       3633   4/1/2020, 8:03:14 PM
   b007010137           OK   ???-cc-07       ack          X          1      NaN    441       3473   4/1/2020, 8:03:14 PM
-- Unknown messages -----------------------------------------------------------------------------------------------------
=========================================================================================================================
```

### Current device Status

이 표는 현재 정상적으로 parsing되어 관리되고 있는 485 homenet 기기들의 상태 정보를 표시한다.  

 Column     | Description
------------|------------
 Type       | SmartThings DTH (Device Type Handler)에서 사용되는 Device type name
 DeviceId   | SmartThings SmartApp과 DTH에서 사용되는 DeviceId
 Properties | SmartThings DTH에서 참조되어 monitoring 및 제어될 수 있는 각 device의 property

### Recieved Serial Messages

이 표는 모든 serial message에 대한 통계 정보를 표시한다.  
[`485server/index.js`](485server/index.js) 파일 내에서 `CONST.MSG_INFO` json object로 관리되는지 여부에 따라 아래와 같이 4가지 message로 구분된다.
```javascript
...
MSG_INFO: [
	{ prefix: 0xac, cmdCode: 0x7a, len: 5, log: true, req: 'set', type: 'light', property: { switch: 'off' }, managed: true },
...
```
- **Managed messages** : `CONST.MSG_INFO`에서 정상적으로 parsing 되어 관리되고 있는 message
- **Unmanaged messages** : `CONST.MSG_INFO`에 항목은 있지만, 분석/관리되지 않은 message (managed property가 false인 항목)
- **Log filtered messages** : log로 표시되지 않도록 설정된 message (log property가 false인 항목)
- **Unknown messages** : `CONST.MSG_INFO`에 존재하지 않는 message

표의 각 열에 대한 정보는 아래와 같다.

 Column         | Description      | Details 
----------------|------------------|---------
 U              | Updated          | Refresh 이전 대비 변경된 경우 * 표시
 Serial message |                  | 수신된 시리얼 메세지. 이 값을 기준으로 행이 생성된다.
 CS             | Checksum         | 수신된 시리얼 메세지를 checksum 계산하여 정상이면 OK, 비정상이면 계산된 checksum값을 표시한다.
 Type           | Message type     | 수신된 시리얼 메세지의 종류를 표시한다.
 Req            | Request type     | 메세지 요청의 종류를 표시한다.
 Managed        | 관리 메세지 여부  | 분석이 완료되어 CONST.MSG_INFO object에서 관리되는 메세지이면 O, 아니면 X 표시
 Count          |                  | 서버 구동 이후 동일 메세지의 발생 횟수
 Period         |                  | 본 메세지와 동일 메세지가 2회이상 발생했을 때, 최종 2회의 시간 간격 (ms)
 Slot           |                  | 본 메세지가 sync1 메세지(a15a007b) 발생 이후 몇 ms만에 발생하였는지 표시
 Elapsed        |                  | 현재시점 기준으로 본 메세지가 몇 ms 전에 발생하였는지 표시
 Last received  |                  | 본 메세지가 마지막으로 발생한 시간

-------------------------------------------------------------------------

# How to add/modify serial message handler

***TBD***

-------------------------------------------------------------------------

# 미진사항

- **다양한 DTH 추가** : 현재 DTH는 light와 thermostat만 작성되어 있다.  
- **On borading process** : 현재는 485server가 구동되면, wallpad가 요청하는 상태조회 요청에 응답하는 message 만으로 device list를 구성하는데, 정상적인 경우라면, device를 add 하는 제대로 된 절차가 필요하다.  
- **Frontend web page** : 현재는 text로만 상태를 알 수 있도록 간략히 구현되어 있지만, mi-connector 등과 같이 frontend web page가 구성되어야 device add, analyze, config 등을 수월하게 할 수 있을것으로 보인다.  
- **다양한 homenet 대응** : 현재는 Samsung SDS의 protocol을 기반으로 작성되어 있지만, 다양한 homenet을 적용 가능하도록 대응하는 것이 필요해 보인다.  
