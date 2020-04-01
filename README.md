# 485-connector
SmartThings connector for RS485 homenet devices.

# Overview

# Prerequisites
- SmartThings account
- RS485 to Serial
- Node.js and npm installed local server (Raspberry Pi, Linux Server, etc.)

# How to install
## Install 485-server
Clone or download this repository and run `npm install`
```
$ git clone git@github.com:fornever2/485-connector.git
$ cd 485-connector
$ npm install
```

## Install DTH (Device Type Handler)
### Manual install (copy & paste code)
1. Go to the SmartThings IDE (https://account.smartthings.com/)
2. Click `My Device Handlers`
3. Click `Create New Device Handlers`
4. Copy content of file in the `devicetypes/forenver` folder to the area
5. Click `Create`
6. Loop until all of file is registered

### Install DTH using the GitHub Repo integration
> Enable the GitHub integration before continuing the installation. Perform step 1 and 2 in the [SmartThings guide](https://docs.smartthings.com/en/latest/tools-and-ide/github-integration.html#step-1-enable-github-integration) to enable the GitHub integration for your SmartThings account.
1. Go to the SmartThings IDE (https://account.smartthings.com/)
2. Select the My Device Handlers tab
3. Click `Settings` button
4. Click `Add new repository` option and fill in the following information:
    - Owner: fornever2  
    - Name: 485-connector  
    - Branch: master  
5. Click `Save` button
6. Click `Update from Repo` button and select the `485-connector (master)` option
7. Check the checkbox for the device types you need (or all of them) in the `New (only in GitHub)` column
8. Check the `Publish` checkbox and click on the `Execute Update` button

## Install SmartApp
### Manual install (copy & paste code)
See the [Manual](doc/install/smartapp/README.md) file for details
1. Go to the SmartThings IDE (https://account.smartthings.com/)
2. Click `My SmartApps`
3. Click `New SmartApp`
4. Click `From Code`
5. Copy content of `485-connector.groovy` & Paste
6. Click `Create`
7. Click `My SmartApps` & `Edit properties` (485-connector)
8. Click `OAuth` option and click on the `Enable OAuth` button
9. Click `Update`

### Install SmartApp using the GitHub Repo integration
> Enable the GitHub integration before continuing the installation. Perform step 1 and 2 in the [SmartThings guide](https://docs.smartthings.com/en/latest/tools-and-ide/github-integration.html#step-1-enable-github-integration) to enable the GitHub integration for your SmartThings account.
1. Go to the SmartThings IDE (https://account.smartthings.com/)
2. Select the `My SmartApps` tab
3. Click `Settings` button
4. Click `Add new repository` option and fill in the following information:   
    - Owner: fornever2   
    - Name: 485-connector   
    - Branch: master   
5. Click `Save` button
6. Click `Update from Repo` button and select the `485-connector (master)` option
7. Check the checkbox for the device types you need (or all of them) in the `New (only in GitHub)` column
8. Check the `Publish` checkbox and click `Execute Update` button
9. Select the `My SmartApps` tab
10. Click `Edit Properties` button for the 485 Connector SmartApp (fornever2 : 485-connector)
11. Click `OAuth` option and click on the `Enable OAuth` button
12. Click `Update` button

Step 3 and 4 are only needed if the repo has not been added earlier (e.g. in the DTH installation).

# Configuration
- Serial Port

# Analysis
## Parse serial message for each homenet

## Device Status
[Device Status 분석](https://github.com/fornever2/485-connector/blob/master/serial_analysis_sds.md)

## Log

# How to add/modify serial message handler
