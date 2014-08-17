//common.js
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
Common vars and methods
*/

"use strict";

var common = require('./common');

module.exports.version = '0.0.0';

module.exports.create_builtin_types = function (){
    
    return {
        
        //Board ready status indication. 0==not reaady 1== ready
        ready: {
            type: 'internal',
            mode: 'input',
            value: 0,
            start: function (){
                //nothing really to do
            }
        }
    };
};

