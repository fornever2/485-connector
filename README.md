# 485-connector

SmartThings connector for RS485 homenet devices.

# Overview

***TBD***

# Prerequisites

- SmartThings account
- RS485 to Serial
- Node.js and npm installed local server (Raspberry Pi, Linux Server, etc.)

# How to install

485-connector consists of three main parts.
- **485server** : node.js server which connected to RS485 serial port and provide information to SmartThings cloud.
- **SmartApp** : SmartThings service application which communicates with 485server.
- **DTH (Device Type Handler)** : SmartThings device handler codes for each devices of RS485 homenet.

## Install 485server

Clone or download this repository and run `npm install`
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

> Enable the GitHub integration before continuing the installation.  
> Perform step 1 and 2 in the [SmartThings guide](https://docs.smartthings.com/en/latest/tools-and-ide/github-integration.html#step-1-enable-github-integration) to enable the GitHub integration for your SmartThings account.

1. Go to the [SmartThings IDE](https://account.smartthings.com/)
2. Select the `My SmartApps` tab
  > Step 3 ~ 5 are only needed if the repo has not been added earlier
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

> Enable the GitHub integration before continuing the installation.  
> Perform step 1 and 2 in the [SmartThings guide](https://docs.smartthings.com/en/latest/tools-and-ide/github-integration.html#step-1-enable-github-integration) to enable the GitHub integration for your SmartThings account.

1. Go to the [SmartThings IDE](https://account.smartthings.com/)
2. Select the `My Device Handlers` tab
  > Step 3 ~ 5 are only needed if the repo has not been added earlier
3. Click `Settings` button
4. Click `Add new repository` option and fill in the following information:
    - Owner: fornever2  
    - Name: 485-connector  
    - Branch: master  
5. Click `Save` button
6. Click `Update from Repo` button and select the `485-connector (master)` option
7. Check the checkbox for the device types you need (or all of them) in the `New (only in GitHub)` column
8. Check the `Publish` checkbox and click on the `Execute Update` button

# How to setup

***TBD***

## Configure 485server

***TBD***

### Serial Port

***TBD***

## Run 485server

485server is based on node.js. So, you can run with below command.
```bash
$ cd 485-connector/485server
$ node index.js
```
But, this can not be run all the time even though you exited the shell.  
This can be useful when you analyze the serial message or debug, but you might need the method the consistant service running.  
In order to solve this problem, I used [`forever`](https://www.npmjs.com/package/forever) service.  
You can install `forever` service with below command. (I added `-g` option in order to install globally.)  
```bash
$ npm install -g forever
```
And I also added [`forever.json`](485server/forever.json) file which has options for running server.  
**NOTE THAT `forever.json` FILE SHOULD BE MODIFIED IF THE PATH OF SERVER FILE IS DIFFERENT.**  
Also, you might need to run forever service when booting raspberry pi.  
It can be done by adding below lines to the bashrc script file of your system.  
```
mkdir -p ~/github/485-connector/485server/log
forever start ~/github/485-connector/485server/forever.json
```

## Install 485-connector SmartApp into SmartThings app

***TBD***

# How to analyze serial message

Since RS485 homenet has no standard specification, each company or apartment has different protocol spec.  
So, we have to analyze serial message by monitoring serial and triggering functions from wallpad / SID / etc.  
In my case, my apartment has Samsung SDS homenet system.  
(But little bit different with previously analyzed by Erita in Naver SmartThings community (https://cafe.naver.com/stsmarthome/7256))  
485server provides some utility function to analyze RS485 serial messages.

## Parse RS485 serial message

***TBD***

## Log

### Watch Log

If you started 485server with `$ node index.js` command, console log will be shown on console.  
But, if you started 485server with `forever` service, log will not be shown on console.
Then, you can use below ways to watch log.  
`Forever` service stores log file on the path described in [`forever.json`](485server/forever.json) file like below.  
```
  "logFile": "/home/pi/github/485-connector/485server/log/server.log"
```
Since the log is written in file, in order to see the live log from shell with `tail` command like below.  
```bash
$ tail -f /home/pi/github/485-connector/485server/log/server.log
```
Or, if the 485server is successfully running, you can get log from webbrowser with below url.  
```
http://<ip-address>:<port-number>/log
ex) http://192.168.29.100:8080/log
```

### Reset Log File

Sometimes it fails to get log if the log is too big. Then, you can reset log with below url.  
```
http://<ip-address>:<port-number>/resetlog
ex) http://192.168.29.100:8080/resetlog
```
Then, the log will be backup as renamed file with format `server-<date>-<time>.log` and restart to log.  

### Configure Log

Since too many serial messages are comming from RS485 serial port, it is hard to see and store log files.  
So, I added configure options to enable/disable log for each serial messages.  
You can set `log` property to `true` or `false` at the `CONST.MSG_INFO` json object in file [`485server/index.js`](485server/index.js).
```javascript
...
MSG_INFO: [
	{ prefix: 0xac, cmdCode: 0x7a, len: 5, log: true, req: 'set', type: 'light', property: { switch: 'off' }, managed: true },
...
```

## 485server Status

If the 485server is successfully running, you can get device status and recieved serial messages status from webbrowser with below url.  
**NOTE THAT THIS PROJECT IS OPTIMIZED TO MY HOMENET RS485 SPEC. (SAMSUNG SDS HOMENET)**  

```
http://<ip-address>:<port-number>/status
ex) http://192.168.29.100:8080/status
```
Then, you can get text looks like below.
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

This table shows the current status of parsed and managed 485 homenet devices.

| Column     | Description                                                                  |
|------------|------------------------------------------------------------------------------|
| Type       | Device type name which is related to SmartThings DTH (Device Type Handler)   |
| DeviceId   | Device identifier which can be used by SmartThings SmartApp and DTH          |
| Properties | Properties of device which can be referred and controlled by SmartThings DTH |

### Recieved Serial Messages

This table shows the statistics of every parsed serial messages including managed/unmanaged/filtered/unknown
- **Managed messages** : 
- **Unmanaged messages** :
- **Log filtered messages** :
- **Unknown messages** :

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

***TBD***

# How to add/modify serial message handler

***TBD***
