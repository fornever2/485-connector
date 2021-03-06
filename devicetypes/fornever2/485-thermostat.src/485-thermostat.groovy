/**
 *  485-thermostat
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
 */
metadata {
	definition (name: "485-thermostat", namespace: "fornever2", author: "fornever2@gmail.com", cstHandler: true) {
    	capability "Switch"
    	//capability "Thermostat Operating State"
        //capability "Thermostat Fan Mode"
        //capability "Thermostat Cooling Setpoint"
        //capability "Thermostat Setpoint"
        capability "Temperature Measurement"
        capability "Thermostat Mode"
        capability "Thermostat Heating Setpoint"
		capability "Refresh"
		capability "Actuator"
		capability "Sensor"
	}
    
	simulator {
		// TODO: define status and reply messages here
	}

/*
	tiles(scale: 2) {
    	main("thermostatFull")        
		multiAttributeTile(name:"thermostatFull", type:"thermostat", width:6, height:4) {
            tileAttribute("device.temperature", key: "PRIMARY_CONTROL") {
                attributeState("temp", label:'${currentValue}', unit:"dF", defaultState: true)
            }            
            tileAttribute("device.temperature", key: "VALUE_CONTROL") {
                attributeState("VALUE_UP", action: "tempUp")
                attributeState("VALUE_DOWN", action: "tempDown")
            }
            tileAttribute("device.thermostatMode", key: "THERMOSTAT_MODE") {
                attributeState("off", label:'${name}')
                attributeState("heat", label:'${name}')
                //attributeState("cool", label:'${name}')
                //attributeState("auto", label:'${name}')
            }
            tileAttribute("device.heatingSetpoint", key: "HEATING_SETPOINT") {
                attributeState("heatingSetpoint", label:'${currentValue}', unit:"dF", defaultState: true)
            }
            
            tileAttribute("device.humidity", key: "SECONDARY_CONTROL") {
                attributeState("humidity", label:'${currentValue}%', unit:"%", defaultState: true)
            }
            tileAttribute("device.thermostatOperatingState", key: "OPERATING_STATE") {
                attributeState("idle", backgroundColor:"#00A0DC")
                attributeState("heating", backgroundColor:"#e86d13")
                attributeState("cooling", backgroundColor:"#00A0DC")
            }
            tileAttribute("device.coolingSetpoint", key: "COOLING_SETPOINT") {
                attributeState("coolingSetpoint", label:'${currentValue}', unit:"dF", defaultState: true)
            }
        }
	}
*/
}


def installed() {
	log.debug "installed()"
}

// parse events into attributes
def parse(String description) {
	log.debug "Parsing '${description}'"
	// TODO: handle attributes
}

// handle commands
def setThermostatMode(mode) {
	log.debug "Executing 'setThermostatMode' value : ${mode}"
    setProperty("mode", mode)
}

def setHeatingSetpoint(setTemp) {
	log.debug "Executing 'setHeatingSetpoint' value: ${setTemp}"
    setProperty("setTemp", "${setTemp}")
}

def heat() {
	log.debug "Executing 'heat'"
    setProperty("mode", "heat")
}

def off() {
	log.debug "Executing 'off'"
    setProperty("mode", "off")
}

def on() {
	log.debug "Executing 'on' --> set mode to 'heat'"
    setProperty("mode", "heat")
}

def refresh() {
	log.debug "Executing 'refresh'"
    try{
        def options = [
            "method": "GET",
            "path": state.path,
            "headers": [
                "HOST": state.address,
                "Content-Type": "application/json"
            ]
        ]
        log.debug "Try to get data from ${state.address} - options : ${options}"
        def myhubAction = new physicalgraph.device.HubAction(options, null, [callback: refreshCallback])
        sendHubCommand(myhubAction)
    }catch(e){
    	log.error "Error!!! ${e}"
    }
}

def refreshCallback(physicalgraph.device.HubResponse hubResponse) {
	log.debug "refreshCallback() - hubResponse : ${hubResponse}"
	def msg, status, json
    try {
        msg = parseLanMessage(hubResponse.description)
        log.debug msg.json
        updateProperty("mode", msg.json.property.mode)
    	updateProperty("setTemp", msg.json.property.setTemp)
    	updateProperty("curTemp", msg.json.property.curTemp)
	} catch (e) {
        log.error("Exception caught while parsing data: "+e)
    }
}

////////////////////////////////////////////////////////////////

def init(data) {
	log.debug "init >> ${data}"
    log.debug "supportedThermostatModes : ${["heat", "off"]}"
    sendEvent(name: "supportedThermostatModes", value: ["heat", "off"])
}

def setUrl(String url){
	log.debug "URL >> ${url}"
    state.address = url
}

def setPath(String path){
	log.debug "path >> ${path}"
    state.path = path
}

def updateProperty(propertyName, propertyValue) {
	log.debug "updateProperty - ${propertyName} : ${propertyValue}"
    switch(propertyName) {
        case "mode":
            sendEvent(name: "thermostatMode", value: propertyValue)
    		if (propertyValue == "off") {
    			sendEvent(name:"switch", value:"off")
    		} else {
	    		sendEvent(name:"switch", value:"on")
    		}
            break
        case "setTemp":
            sendEvent(name: "heatingSetpoint", value: propertyValue)
            break
        case "curTemp":
            sendEvent(name: "temperature", value: propertyValue)
            break
        default:
            log.debug "UNKNOWN PROPERTY!!"
    }
}

////////////////////////////////////////////////////////////////

def setProperty(String name, String value) {
	try{    
        def options = [
            "method": "PUT",
            "path": state.path + "/" + name + "/" + value,
            "headers": [
                "HOST": state.address,
                "Content-Type": "application/json"
            ]
        ]
        log.debug "setProperty - send to 485server : ${options}"
        def myhubAction = new physicalgraph.device.HubAction(options, null, [callback: setPropertyCallback])
        sendHubCommand(myhubAction)
    }catch(e){
    	log.error "Error!!! ${e}"
    }
}

def setPropertyCallback(physicalgraph.device.HubResponse hubResponse) {
	log.debug "setPropertyCallback() - hubResponse : ${hubResponse}"
	def msg, status, json
    try {
        msg = parseLanMessage(hubResponse.description)
        log.debug msg.json
       	// TODO : sendEvent for response property
	} catch (e) {
        log.error("Exception caught while parsing data: "+e);
    }
}




/////////////////////////
// Not used below

// gets the address of the Hub
private getCallBackAddress() {
    return device.hub.getDataValue("localIP") + ":" + device.hub.getDataValue("localSrvPortTCP")
}

// gets the address of the device
private getHostAddress() {
    def ip = getDataValue("ip")
    def port = getDataValue("port")

    if (!ip || !port) {
        def parts = device.deviceNetworkId.split(":")
        if (parts.length == 2) {
            ip = parts[0]
            port = parts[1]
        } else {
            log.warn "Can't figure out ip and port for device: ${device.id}"
        }
    }

    log.debug "Using IP: $ip and port: $port for device: ${device.id}"
    return convertHexToIP(ip) + ":" + convertHexToInt(port)
}

private Integer convertHexToInt(hex) {
    return Integer.parseInt(hex,16)
}

private String convertHexToIP(hex) {
    return [convertHexToInt(hex[0..1]),convertHexToInt(hex[2..3]),convertHexToInt(hex[4..5]),convertHexToInt(hex[6..7])].join(".")
}