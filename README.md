# 485-connector
SmartThings connector for RS485 homenet devices.

# Overview

# Prerequisites
- SmartThings account
- RS485 to Serial
- Node.js and npm installed local server (Raspberry Pi, Linux Server, etc.)

# How to install
485-connector consists of three main parts.
- 485-server : node.js server which connected to RS485 serial port and provide information to SmartThings cloud.
- SmartApp : SmartThings service application which communicates with 485-server.
- DTH (Device Type Handler) : SmartThings device handler codes for each devices of RS485 homenet.

## Install 485-server
Clone or download this repository and run `npm install`
```
$ git clone git@github.com:fornever2/485-connector.git
$ cd 485-connector/485server
$ npm install
```

## Install SmartApp
### Manual install (copy & paste code)
See the [Manual](doc/install/smartapp/README.md) file for details
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

# Configuration
- Serial Port

# Run 485Server
485server is based on node.js. So, you can run with below command.
```
$ cd 485-connector/485server
$ node index.js
```
But, this can not be run all the time even though you exited the shell.  
This can be useful when you analyze the serial message or debug, but you might need the method the consistant service running.  
In order to solve this problem, I used [forever](https://www.npmjs.com/package/forever) service.  
You can install forever service with below command. (I added -g option in order to install globally.)  
```
$ npm install -g forever
```
And I also added [forever.json](485server/forever.json) file which has options for running server.  
**NOTE THAT forever.json FILE SHOULD BE FMODIFIED IF THE PATH OF SERVER FILE IS DIFFERENT.**
Also, you might need to run forever service when booting raspberry pi.
It can be done by adding below lines to the bashrc script file of your system.
```
mkdir -p ~/github/485-connector/485server/log
forever start ~/github/485-connector/485server/forever.json
```

# Analysis
## Parse serial message for each homenet

## Device Status
[Device Status 분석](https://github.com/fornever2/485-connector/blob/master/serial_analysis_sds.md)

## Log

# How to add/modify serial message handler
