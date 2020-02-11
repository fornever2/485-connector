/**
 *  485-connector
 *
 *  Copyright 2020 fornever2@gmail.com
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 *  in compliance with the License. You may obtain a copy of the License at:
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License
 *  for the specific language governing permissions and limitations under the License.
 *
 */
import groovy.json.JsonSlurper

definition(
    name: "485-connector",
    namespace: "fornever2",
    author: "fornever2@gmail.com",
    description: "A Connector between RS485 Homenet and SmartThings",
    category: "My Apps",
    iconUrl: "https://www.shareicon.net/data/256x256/2016/01/19/705449_connection_512x512.png",
    iconX2Url: "https://www.shareicon.net/data/256x256/2016/01/19/705449_connection_512x512.png",
    iconX3Url: "https://www.shareicon.net/data/256x256/2016/01/19/705449_connection_512x512.png"
)


preferences {
    page(name: "settingPage")
    page(name: "connectingPage")
    page(name: "donePage")
}

def installed() {
	log.debug "Installed with settings: ${settings}"

	initialize()
}

def updated() {
	log.debug "Updated with settings: ${settings}"

	// Unsubscribe from all events
	unsubscribe()
    // Subscribe to stuff
	initialize()
}

def uninstalled() {
	log.debug "uninstalled()"
}

def childUninstalled() {
	// TODO : check call if child device is deleted.
	log.debug "childUninstalled()"
}
//////////////////////////////////////////////////////////

def initialize() {
	// TODO: subscribe to attributes, devices, locations, etc.
    log.debug "initialize() called..."
}

// TODO: implement event handlers


def settingPage(){	
	state.addedCountNow = 0
	state.curStatus = "setting"    
	dynamicPage(name:"settingPage", title:"Settings", nextPage: "connectingPage", uninstall: true) {
        section("Label") {
        	label name: "label", title:"You can chane the name of this smartapp", required: false, multiple: false, description: name
        }
		section("RS485 server setting") {
        	input "serverAddress", "text", title: "IP Address of RS485 server (ex. 192.168.29.101:8888)", required: true, value: "192.168.29.101:8888"
        }
	}
}

def connectingPage(){
    def addr = settings.serverAddress
    log.debug "connectingPage() - settings.serverAddress : ${addr}, state.curStatus : ${state.curStatus}"
    
    if (state.curStatus == "setting") {
    	state.curStatus = "connecting"
        getStatusOfConnector(addr, connectorCallback)
        //state.count = 1;
    } 
    
    if (state.curStatus == "setting" || state.curStatus == "connecting") {
        //state.count = state.count + 1;
        log.debug "connectingPage() 111 - ${state.curStatus} , ${state.count}"
        //if (state.count > 5) 
        	//state.curStatus = "connected"

        dynamicPage(name:"connectingPage", title:"Connecting", refreshInterval:1) {
			section("Connecting") {
        		paragraph "Trying to connect ${addr}\nPlease wait...."        	
        	}
		}        
    } else if (state.curStatus == "connected") {
    	log.debug "connectingPage() 222 - ${state.curStatus}"
        dynamicPage(name:"connectingPage", title:"Connected", nextPage: "donePage", install: true, uninstall: true) {
			section("Connected") {
        		paragraph "Connected to ${addr}"
        	}
		}
    }
}

def donePage(){
	log.debug "donePage() - ${state.curStatus}"
	dynamicPage(name:"donePage", title:"Done", install: true) {
    	log.debug "dynamicPage() - 333"
		section("Done") {
        	log.debug "section() - 333"
        	paragraph "@@@@@@@@"
        }
	}
}

def getStatusOfConnector(address, _callback) {	
    def options = [
     	"method": "GET",
        "path": "/homenet",
        "headers": [
        	"HOST": address,
            "Content-Type": "application/json"
        ]
    ]
    log.debug "getStatusOfConnector() - sendHubCommand : ${options}"
    sendHubCommand(new physicalgraph.device.HubAction(options, null, [callback: _callback]))
}

def connectorCallback(physicalgraph.device.HubResponse hubResponse){
	log.debug "connectorCallback() - hubResponse : ${hubResponse}"
	def msg, status, json
    try {
        msg = parseLanMessage(hubResponse.description)
        
        def jsonObj = msg.json
        log.debug jsonObj
        
        state.curStatus = "connected"
        log.debug "connected"
	} catch (e) {
        log.error("Exception caught while parsing data: "+e);
    }
}
