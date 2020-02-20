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
        	label name: "label", title:"You can change the name of this smartapp", required: false, multiple: false, description: name
        }
		section("RS485 server setting") {
        	paragraph "RS485 server should be accessible from SmartThings cloud. Please input RS485 server's IP address including port number.\nNOTE) Do not input local network address."
        	input "serverAddress", "text", title: "IP address (ex. 111.111.111.111:11)", required: true, value: "211.218.213.108:8888"
        }
	}
}

def connectingPage(){
    def addr = settings.serverAddress
    log.debug "connectingPage() - settings.serverAddress : ${addr}, state.curStatus : ${state.curStatus}"
    
    if (state.curStatus == "setting") {
    	state.curStatus = "connecting"
        getStatusOfConnector(addr, connectorCallback)
    } 
    
    if (state.curStatus == "setting" || state.curStatus == "connecting") {
        dynamicPage(name:"connectingPage", title:"Connecting", refreshInterval:1) {
			section("Connecting") {
        		paragraph "Trying to connect ${addr}\nPlease wait...."        	
        	}
		}        
    } else if (state.curStatus == "connected") {
        dynamicPage(name:"connectingPage", title:"Connected", install: true, uninstall: true) {
			section("Connected") {
        		paragraph "Connected to ${addr}"
                paragraph "Added Count : " + state.addedCountNow
        	}
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
        
        log.debug "jsonObj.status : ${jsonObj.status}"
        log.debug "jsonObj.message : ${jsonObj.message}"
        def count = 0
        jsonObj.message.each{ item->
            def dni = "485-connector-" + item.id.toLowerCase()
            log.debug "dni : ${dni}, item : ${item}"
            if(!getChildDevice(dni)){
            	try{
                	def typeName
                	if (item.type == "Light") {
						typeName = "485-switch"
                    } else if (item.type == "Thermo") {
                    	typeName = "485-switch"
                    }
                    
                    def childDevice = addChildDevice("fornever2", typeName, dni, location.hubs[0].id, [
                    	"label": item.id,
                        "uri": item.uri
                    ])

                    childDevice.setUrl("${settings.serverAddress}")
                    childDevice.setPath("/homenet/${item.id}")
                    //childDevice.setEspName(name)
                    //childDevice.setAutoRefresh(settings.devAutoRefreshMode)
                    
                    state.addedCountNow = (state.addedCountNow.toInteger() + 1)
                    log.debug "ADD >> ${dni}"
                }catch(e){
                	log.error("ADD DEVICE Error!!! ${e}")
                }
            }
        }
        
        
        state.curStatus = "connected"
        log.debug "connected"
	} catch (e) {
        log.error("Exception caught while parsing data: "+e);
    }
}
