//arduino.js
/*
Copyright 2014 Vytroncs.com and Charles Weissman

This file is part of "Vytroncs HMI, the 100% Free, Open-Source SCADA/HMI Initiative"
herein referred to as "Vytronics HMI".

Vytronics HMI is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

Vytronics HMI is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with Vytronics HMI.  If not, see <http://www.gnu.org/licenses/>.
*/

/*
This is a vytronics.hmi compatible driver that can used in a vytronics SCADA project
or stand-alone. See README.md for usage.

The driver is intended to abstract communications with an Arduino microcontroller
into simple asynchronous methods.
*/

"use strict";

module.exports.version = '0.0.0';

//Dependencies
var events = require("events");
var common = require('./common');


//Drivr must define a create function that returns required methods for a
//vytronics.hmi compatible driver. Hides the actual ArduinoDriver object
//for better modularization making all other methods private to callers.
module.exports.create = function (config){
    
    //Choose between the real firmata driver or simulation
    var is_sim = config && (config.sim_mode == 'true') ? true : config.sim_mode === true;
        
    var firmata = is_sim ? require('./sim-board') : require('firmata');
    
    var arduino = new ArduinoFirmataDriver(config, firmata);
    
    if (!arduino) return undefined;
        
    return {
        start: function (){ arduino.start(); },
        stop: function (){ arduino.stop(); },
        register: function (item){ arduino.register(item); },
        write_item: function (item, value){ arduino.write_item(item, value); },
        read_item: function (item){ return arduino.read_item(item); },
        on: function (type, listener){ arduino.emitter.on(type, listener); }
    };    
};

////////////// Private stuff //////////////////////

/*
Create a driver from config object
    config: {
        log_level: 'all',   //see all log messages for driver
        port_name: 'COM1',  //Options. Leave undefined for auto search
        sampling_interval   //Board default is 19ms which is way fast. We make default 1000ms
    }    
    
*/
function ArduinoFirmataDriver (config, firmata){
    
    var self = this;
    
    //define some built in items
    this.built_in_items =  common.create_builtin_types();
    
    //Subscribed items.
    this.items = {
    };
    
    //Create ArduinoDriver specific logging functions
    var logger = require('log4js').getLogger();
    this.log = [];
    ['trace','debug','info','warn','error','fatal'].forEach(
    function(levelString) {
        self.log[levelString] = function () {
            var args = Array.prototype.slice.call(arguments);
            args.unshift('arduino.async port:' + self.port_name + ' - ');
            logger[levelString].apply(logger, args);
        }
    });
       
    this.port_name = config.port_name;
    
    logger.setLevel(config.log_level || 'warn');
    
    this.emitter = new events.EventEmitter();
    
    //Use 1 seconds as default instead of the 19ms
    this.sampling_interval = config.sampling_interval || 1000;
        
    this.board = new firmata.Board(this.port_name, function(){
        self.onBoardReady();
    });

}

ArduinoFirmataDriver.prototype.start = function (){
    
    var self = this;
       
    //TODO - stop any prev running board???
    
    this.log.info('started');
    



};

ArduinoFirmataDriver.prototype.stop = function (){
    this.log.info('driver stop method called');
    
    //TODO - cleanup?
    
    this.board.close(function() { /*do nothing?*/ });
};

/*
itemname formats:
    digital:13:input - digital pin 13 for input
    digital:13:output - digital pin 13 for output
    analog:1 - analog pin 1, input
    ###TODO - PWM etc.
*/

ArduinoFirmataDriver.prototype.register = function (itemname){
    
    var self = this;
        
    var modes = {
        input: this.board.MODES.INPUT,
        output: this.board.MODES.OUTPUT
    };
    
    this.log.debug('registering item:' + itemname);
    
    //TODO - validate, ignore duplicate pin registration. First one
    //always sticks
    
    var match;
    
    //Is this a built in item?
    var item = this.built_in_items[itemname];
    if ( item ) {
        this.items[itemname] = item;
    }
    //Digital pin values
    else if (match = /^digital:(\d{1,2}):(input|output)$/.exec(itemname)) {

        var pin = parseInt(match[1],10);
        var mode = match[2];
       
        //TODO - should any of these be reservered, i.e. 0,1 for TxRx?
        if ( (pin > 13) || (pin <0)){
            this.log.error('invalid itemname: ' + itemname + ' - pin out of range:' + pin);
            return;
        }
                
        //Init digital items to 0
        this.items[itemname] = {
            type: 'digital',
            mode: mode,
            pin: pin,
            value: 0,
            write: function(value) {
                //Note closure captures pin and mode var from match
                if (mode === 'input') return false;
                self.board.digitalWrite(pin, value);
                self.flashRxTx();
                //Query board to get readback since output pins do not report
                self.board.queryPinState(pin, function() {
                    self.flashRxTx();
                    self.update_item( itemname, value);
                });
            },
            start: function (){
                //Note closure captures pin and mode var from match
                                
                self.board.pinMode( pin, modes[mode]);
                self.board.digitalRead( pin, function (value){
                    self.flashRxTx();
                    self.update_item(itemname, value);
                });
                
                //Cause artifical pin mode event if subscribed since does not look
                //like firmata driver can query pin modes yet
                var mode_item = 'digital:' + pin + ':mode';
                if ( self.items[mode_item] ) {
                    
                    self.update_item(mode_item, modes[mode]);
                }
            }
        };        
    }
    //Pin modes
    else if (match = /^digital:(\d{1,2}):mode$/.exec(itemname)) {
        var pin = parseInt(match[1],10);
        
        //TODO - should any of these be reservered, i.e. 0,1 for TxRx?
        if ( (pin > 13) || (pin <0)){
            this.log.error('invalid itemname: ' + itemname + ' - pin out of range:' + pin);
            return;
        }
                
        this.items[itemname] = {
            type: 'digital',
            mode: undefined,
            pin: pin,
            write: undefined, //TODO - maybe let user set pin mode from GUI?
            start: function (){
                //Query of pin mode not supported so just read current board data
                self.update_item(itemname, self.board.pins[pin].mode);
            }
        };                
    }
    //Analog pin values. Just input types for now
    else if (match = /^analog:(\d{1,2}):input$/.exec(itemname)) {

        var pin = parseInt(match[1],10);
        var mode = 'analog';
       
        if ( (pin > 5) || (pin <0)){
            this.log.error('invalid itemname: ' + itemname + ' - pin out of range:' + pin);
            return;
        }
                
        //Init analog items to 0
        this.items[itemname] = {
            type: 'analog',
            mode: mode,
            pin: pin,
            value: 0,
            start: function (){
                self.board.analogRead( pin, function (value){
                    self.flashRxTx();
                    self.update_item(itemname, value);
                });                
            }
        };        
    }
    
    //TODO - other formats such as analog
    else {
        this.log.error('invalid itemname:' + itemname);
    }
};


ArduinoFirmataDriver.prototype.write_item = function (itemname, value){
    var item = this.items[itemname];
    
    if (!item || !item.write) return false;
    
    item.write(value);
    
};

ArduinoFirmataDriver.prototype.read_item = function (itemname){
    var item = this.items[itemname];
    
    if (!item) return undefined;
    
    return item.value;
    
};


//Have to wait until board is ready before you can init pins and setup read callbacks
ArduinoFirmataDriver.prototype.onBoardReady = function (){
    this.log.info("board ready", this.board.pins);
    
    var modes = {
        input: this.board.MODES.INPUT,
        output: this.board.MODES.OUTPUT
    };
    
    this.board.setSamplingInterval(this.sampling_interval);
    
    Object.getOwnPropertyNames(this.items).forEach( function (itemname){
        
        var item = this.items[itemname];
        
        item.start();
        
    }, this);

    
    this.update_item('ready', 1);
};

ArduinoFirmataDriver.prototype.update_item = function (itemname, value) {
    
    var self = this;
    
    //Dont complain for built in items that are not registered
    var item = self.items[itemname];
    if ( !item ) {
        
        //This has to be a programmer error?
        if ( !self.built_in_items[itemname] ) {
            self.log.error('update_item program error - itemname not found:' + itemname);
        }
        
        return;   
    }
        
    //Avoid excessive noise.
    item.value = value;
    if ( item._update_timer ) {
        return
    }
 
    var last_val = item.value;
    item._update_timer = setTimeout( function (){
        item._update_timer = undefined;
        var value = self.items[itemname].value;
        if ( value !== last_val ) {
            self.update_item(itemname, value);
        }
    }, self.sampling_interval);
    
    this.log.debug('update_value itemname:' + itemname + ' value:' + value);
    this.emitter.emit('itemvalue', itemname, value,
                      1); //TODO - need quality constants
};

//Simulate RxTx lamps
ArduinoFirmataDriver.prototype.flashRxTx = function(itemname) {
    var self = this;
    
    var item = this.items[itemname];
    if ( !item ) return;
    
    if (item.value !== 0) return;
    
    this.update_item(itemname, 1);
    setTimeout( function() {
        self.update_item(itemname, 0);
    }, 500);
};
