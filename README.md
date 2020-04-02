# 485-connector

SmartThings connector for RS485 homenet devices.

# Overview

***TBD***

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
또한, 파일 수정시 또는 문제발생하여 종료되었을 때 자동 재구동 되도록 watch 옵션을 설정하거나, log 파일등을 제어하기 위해 [`forever.json`](485server/forever.json) 파일을 작성해 두었다.  

> ***주의 : 이 `forever.json` 파일 내의 path등은 개인의 환경에 맞게 수정되어야 함***  

그리고, `forever` service가 라즈베리파이 부팅시 자동 실행되도록 아래의 내용을 bashrc등 부팅 script에 추가하면 된다.  
```
mkdir -p ~/github/485-connector/485server/log
forever start ~/github/485-connector/485server/forever.json
```

## Install 485-connector SmartApp into SmartThings app

***TBD***

-------------------------------------------------------------------------

# How to analyze serial message

RS485 homenet의 경우 정해진 표준 protocol이 없기때문에, 각 회사나 아파트단지별로 각기 다른 protocol로 구동된다.  
그래서, 각자 자신의 환경에 맞도록 serial message를 분석해서 적용해야 한다.  
이를 위해 각각 기기를 동작시키면서 serial message를 모니터링하여 분석하는 환경이 필요하여, 몇가지 util성 기능을 추가하였다.  

## Parse RS485 serial message

참고로, 본 project의 parser는 네이버 SmartThings community의 에리타님께서 분석한 Samsung SDS homenet의 내용(https://cafe.naver.com/stsmarthome/7256)을 참고하여 작성되었다. (일부는 우리집의 환경에 맞게 수정되었다.)  
***TBD***

## Log

### Watch Log

만약 485server를 `$ node index.js` 명령으로 수행했다면, console log가 바로 출력되어 log를 볼 수 있지만, `forever` service를 통하여 구동되었다면, log는 파일로 저장되기때문에, live log를 바로 직접 볼 수는 없을 것이다.  
이 경우, 아래의 방법들을 이용하여 log를 볼 수 있다.  
`Forever` service 는 [`forever.json`](485server/forever.json) 파일에 아래와 같이 설정된 path의 파일에 log를 저장한다.  
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

Serial port로 전달되는 메세지가 너무 많기 때문에, 분석에 어려움이 있을 수 있어서, serial message 별로 로그 출력 여부를 설정할 수 있는 option을 추가하였다.  
[`485server/index.js`](485server/index.js) 파일 내에서 `CONST.MSG_INFO` json object 내의 각 message 별 항목 중 `log` property를 `true` 나 `false`로 설정하여 해당 message를 log에 출력할지 여부를 설정할 수 있다.  
```javascript
...
MSG_INFO: [
	{ prefix: 0xac, cmdCode: 0x7a, len: 5, log: true, req: 'set', type: 'light', property: { switch: 'off' }, managed: true },
...
```

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
 Type           | Message type     | 수신된 시리얼 메세지의 종류를 표시한다.<br> - sync1 / sync2 / sync3 / sync4 : 각 메세지에 할당된 time slot 동기화를 맞추기 위한 메세지로 보임.<br> - light : 조명<br> - thermostat : 난방<br> - SID : Smart Info Display (현관의 조그만 정보 표시장치로, 날씨, 주차위치, 미세먼지, 일괄조명 등의 상태 표시)
 Req            | Request type     | 메세지 요청의 종류를 표시한다.<br> - sync : 각 메세지의 time slot 동기화를 위한 동기메세지<br> - get : 상태 조회 요청 메세지<br> - set : 제어 요청 메세지<br> - ack : get / set 등의 요청에 대한 응답 메세지<br> - reg : register callback - 특정 상황이 되면 cb 메세지를 보내달라고 요청하는 callback 등록 메세지<br> - cb : reg 요청이 있었을 때, 특정 상황이 되면 불리는 callback 메세지<br> - report : 별다른 요청이 없어도 특정 상황이 되거나, 특정 시간이 되면 상황을 report 하는 메세지 (날씨, SID 등)
 Managed        | 관리 메세지 여부  | 분석이 완료되어 CONST.MSG_INFO object에서 관리되는 메세지이면 O, 아니면 X 표시
 Count          |                  | 서버 구동 이후 동일 메세지의 발생 횟수
 Period         |                  | 본 메세지와 동일 메세지가 2회이상 발생했을 때, 최종 2회의 시간 간격 (ms)
 Slot           |                  | 본 메세지가 sync1 메세지(a15a007b) 발생 이후 몇 ms만에 발생하였는지 표시
 Elapsed        |                  | 현재시점 기준으로 본 메세지가 몇 ms 전에 발생하였는지 표시
 Last received  |                  | 본 메세지가 마지막으로 발생한 시간

***TBD***

## Write serial message

485server가 정상적으로 구동중이면, 아래 url을 browser에 입력함으로서 RS485 homenet에 serial message를 write 할 수 있다.  
이 기능을 이용하여 명령 전달 등을 test 할 수 있다.  
```
http://<ip-address>:<port-number>/serial/<serial-message>
ex) http://192.168.29.100:8080/serial/ac79000154
```

-------------------------------------------------------------------------

# How to add/modify serial message handler

***TBD***
