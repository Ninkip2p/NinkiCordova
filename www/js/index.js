/*

* Licensed to the Apache Software Foundation (ASF) under one

* or more contributor license agreements.  See the NOTICE file

* distributed with this work for additional information

* regarding copyright ownership.  The ASF licenses this file

* to you under the Apache License, Version 2.0 (the

* "License"); you may not use this file except in compliance

* with the License.  You may obtain a copy of the License at

*

* http://www.apache.org/licenses/LICENSE-2.0

*

* Unless required by applicable law or agreed to in writing,

* software distributed under the License is distributed on an

* "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY

* KIND, either express or implied.  See the License for the

* specific language governing permissions and limitations

* under the License.

*/

var app = {

    // Application Constructor

    initialize: function () {

        this.bindEvents();

        this.isScanning = false;

    },

    // Bind Event Listeners

    //

    // Bind any events that are required on startup. Common events are:

    // 'load', 'deviceready', 'offline', and 'online'.

    bindEvents: function () {

        document.addEventListener('deviceready', this.onDeviceReady, false);

        document.addEventListener("pause", this.onPause, false);
        
    

        document.getElementById('qr').addEventListener('touchstart', this.scan, false);

        document.getElementById('qrcontact').addEventListener('touchstart', this.scancontact, false);

        document.getElementById('qrval').addEventListener('touchstart', this.validatecontact, false);

        document.getElementById('qrpair').addEventListener('touchstart', this.scanpair, false);

        
        //here lets setup the platform specific css adjustiments
        
        

    },

    // deviceready Event Handler

    //

    // The scope of 'this' is the event. In order to call the 'receivedEvent'

    // function, we must explicitly call 'app.receivedEvent(...);'

    onDeviceReady: function () {


        //app.receivedEvent('deviceready');

    },

    onPause: function () {



        if (!app.isScanning) {



            //console.log(window.hasSession());



            if (localStorage.getItem("guid")) {



                if ($("#isactive").val() == 1) {

                    if ($(".footer").is(":visible")) {

                        $("#footermode").val(1);

                    } else {

                        $("#footermode").val(0);

                    }

                }



                $("#isactive").val(0);



                window.resetPin();



                $("#paddel").hide();

                $('.numdone').attr("style", "background-color:white");

                $("#loginpinno").val('');

                $("#pinloginmessage").text("Enter your PIN number");



                $("#pinimage").show();

                $("#pinpair").hide();

                $("#pinrepeat").hide();



                $("#loginpin").show();

                $("#nonlogin").hide();



                $(".footer").hide();



            }





        } else {

            if (device.platform == "Android") {

                app.isScanning = false;

            }

        }



    },





    // Update DOM on a Received Event

    receivedEvent: function (id) {

        var parentElement = document.getElementById(id);

        var listeningElement = parentElement.querySelector('.listening');

        var receivedElement = parentElement.querySelector('.received');



        listeningElement.setAttribute('style', 'display:none;');

        receivedElement.setAttribute('style', 'display:block;');



        console.log('Received Event: ' + id);

    },



    scan: function () {



        app.isScanning = true;



        var scanner = cordova.require("cordova/plugin/BarcodeScanner");



        scanner.scan(function (result) {



            if (result.text.length > 0) {

                var toAddress = document.getElementById("toAddress");

                toAddress.value = result.text;



                $("#toAddress").trigger('change');



            }



            if (device.platform == "iOS") {

                app.isScanning = false;

            }



        }, function (error) {

            console.log("Scanning failed: ", error);

            app.isScanning = false;

        });







    },

    scancontact: function () {



        app.isScanning = true;



        var scanner = cordova.require("cordova/plugin/BarcodeScanner");



        scanner.scan(function (result) {



            var hdqrcontact = document.getElementById("hdqrcontact");

            if (result.text.length > 0) {

                hdqrcontact.value = result.text;

                console.log(result.text);

                console.log('calling trigger change');

                $("#hdqrcontact").trigger('change');

                console.log($("#hdqrcontact"));

            }



            if (device.platform == "iOS") {

                app.isScanning = false;

            }



        }, function (error) {

            console.log("Scanning failed: ", error);

            app.isScanning = false;

        });

    },



    validatecontact: function () {



        app.isScanning = true;



        var scanner = cordova.require("cordova/plugin/BarcodeScanner");



        scanner.scan(function (result) {



            var hdqrcontact = document.getElementById("hdvalcontact");

            if (result.text.length > 0) {

                hdqrcontact.value = result.text;

                console.log(result.text);

                console.log('calling trigger change');

                $("#hdvalcontact").trigger('change');

                console.log($("#hdvalcontact"));

            }



            if (device.platform == "iOS") {

                app.isScanning = false;

            }



        }, function (error) {

            console.log("Scanning failed: ", error);

            app.isScanning = false;

        });

    },



    scanpair: function () {



        app.isScanning = true;



        var scanner = cordova.require("cordova/plugin/BarcodeScanner");



        scanner.scan(function (result) {



            var pairdeviceblob = document.getElementById("pairdeviceblob");

            if (result.text.length > 0) {

                pairdeviceblob.value = result.text;

                console.log(result.text);

                console.log('calling trigger change');

                $("#pairdeviceblob").trigger('change');

                console.log($("#pairdeviceblob"));

            }



            if (device.platform == "iOS") {

                app.isScanning = false;

            }



        }, function (error) {

            console.log("Scanning failed: ", error);

            app.isScanning = false;

        });



    }



};