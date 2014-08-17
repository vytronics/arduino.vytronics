//sim-board.js
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
Enables a driver sim mode for development and demo when no board is
connected. TTo enable sim mode set the config.sim_mode property to true.

Suggestion is to use environment vars so that the same config file can
be used in production and for development/demo as follows:

    config: {
        sim_mode: !!vy/env DRIVER_SIM_MODE:false,
        log_level: !!vy/env DRIVER_LOG_LEVEL:all,
        port_name: !!vy/env DRIVER_PORT:COM1,
        sampling_interval: 1000
    }    

*/

"use strict";

module.exports.version = '0.0.0';

//Dependencies
var events = require("events");
var firmata = require('firmata');
var common = require('./common');

var Board = function(port, options, callback) {
    
    console.log('CREATING ARDUINO SIMULATION DRIVER OBJECT.');
    
    this.fakeit();
    
    this.emmiter = new events.EventEmitter();
    if (typeof options === "function" || typeof options === "undefined") {
        callback = options;
    }
    //Note that sim ignores options.
    
    this.port = port; //Just for log messages
    this.ready = 0;
    
    //Set a timer to simulate ready function
    var self = this;
    setTimeout( function (){
        self.ready = 1;
        
        //Init a bunch of pins, more than can ever have just to be safe
        for (var i=0; i<50; i++) {
            self.pins.push({
                supportedModes: [],
                mode: self.MODES.UNKNOWN,
                value: 0,
                report: 1
            });

            self.analogPins.push({
                supportedModes: [],
                mode: self.MODES.ANALOG,
                value: 520,
                report: 1
            });
        }
        callback();
    }, 5000);
};

Board.prototype.setSamplingInterval = function(interval) {
  var safeint = interval < 10 ? 10 : (interval > 65535 ? 65535 : interval); // constrained
  this.sampling_interval = safeint;
};

Board.prototype.close = function (callback){
    //TODO - stop all timers
    //this.pins[pin].interval_id
    
};

Board.prototype.digitalWrite = function(pin, value) {
    this.pins[pin].value = value;
    
    //Dont have to do anything. arduino driver will do a queryPinState after
    //write but TODO - maybe simulate a pin value event.
};

Board.prototype.queryPinState = function(pin, callback) {
    //Simulate an event
    var self = this;
    setTimeout(function (){
        callback(self.pins[pin].value || 0);
    }, 500);
};

Board.prototype.pinMode = function(pin, mode) {
    if ( ! this.pins[pin] ) this.pins[pin] = { value:0};
    this.pins[pin].mode = mode;
};

Board.prototype.digitalRead = function(pin, callback) {
    
    //start an interval timer to randomly change value
    var self = this;
    
    if ( this.pins[pin].mode === this.MODES.OUTPUT) return;
    
    this.pins[pin].interval_id = setInterval( function (){
        var value = getRandomInt(0, 2);
        self.pins[pin].value = value;
        callback(value);
    }, this.sampling_interval);
};

Board.prototype.analogRead = function(pin, callback) {

    //start an interval timer to randomly change value
    var self = this;
    this.analogPins[pin].interval_id = setInterval( function (){
        var value = self.analogPins[pin].value + getRandomInt(-100, 100);
        value = (value < 0) ? 0 : value;
        value = (value > 1023) ? 0 : value;
        self.analogPins[pin].value = value;
        
        //Report event
        callback(value);
    }, this.sampling_interval);
};

//Need to imitate a bunch of vars from real firmata board
Board.prototype.fakeit = function () {
  this.MODES = {
    INPUT: 0x00,
    OUTPUT: 0x01,
    ANALOG: 0x02,
    PWM: 0x03,
    SERVO: 0x04,
    SHIFT: 0x05,
    I2C: 0x06,
    ONEWIRE: 0x07,
    STEPPER: 0x08,
    IGNORE: 0x7F,
    UNKOWN: 0x10
  };

  this.I2C_MODES = {
    WRITE: 0x00,
    READ: 1,
    CONTINUOUS_READ: 2,
    STOP_READING: 3
  };

  this.STEPPER = {
    TYPE: {
      DRIVER: 1,
      TWO_WIRE: 2,
      FOUR_WIRE: 4
    },
    RUNSTATE: {
      STOP: 0,
      ACCEL: 1,
      DECEL: 2,
      RUN: 3
    },
    DIRECTION: {
      CCW: 0,
      CW: 1
    }
  };

  this.HIGH = 1;
  this.LOW = 0;
  this.pins = [];
  this.analogPins = [];
};




module.exports = {
    Board: Board
};



function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}
