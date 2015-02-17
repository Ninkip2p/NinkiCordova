"use strict";

function downloadAndOpenWalletUI(params, callback) {

    assert(params.guid, "GUID is blank");
    assert(params.password, "Password is blank");

    assert(isRealGuid(params.guid), "GUID is invalid");
    assert(
		params.password.length > config.walletSecurity.minimumPasswordLength,
		"Password is too short (minimum length is " + config.walletSecurity.minimumPasswordLength + ")"
	);
    assert(callback, "Callback not specified");

    var guid = params.guid;
    var password = params.password;
    var twoFactorCode = params.twoFactorCode;

    getWalletFromServer(guid, twoFactorCode, function (err, wallet) {

        console.log(err, wallet);

        if (err) {
            throw err;
        }

        if (wallet && wallet == "GUID not found") {
            return callback("That GUID does not exist on the server.", err);
        }

        if (wallet.guid && wallet.guid != guid) {
            throw new Error("Blob has wrong guid!")
        }

        try {
            var decryptedPayload = decrypt(wallet.Payload, password);
        } catch (err) {
            if (err.message == 'Unexpected end of input') {
                return callback("Could not decrypt.\n\n(Is your password correct?)", err);
            } else {
                //Something very strange happened.
                return callback("Could not decrypt.", err);
            }
        }
        return callback(null, decryptedPayload);
    });
}

//TODO Ben's API gives wrongly slashed output - using this to fix it.
function stripslashes(str) {

    return (str + '')
		.replace(/\\(.?)/g, function (s, n1) {
		    switch (n1) {
		        case '\\':
		            return '\\';
		        case '0':
		            return '\u0000';
		        case '':
		            return '';
		        default:
		            return n1;
		    }
		});
}

function getWalletFromServer(guid, twoFactorCode, callback) {
    assert(guid, "Guid not specified");
    assert(isRealGuid(guid), "Not a GUID");
    assert(callback, "Callback not specified");

    var postData = { guid: guid, twoFactorCode: twoFactorCode };
    return post("/api/1/u/getaccountdetails", postData, function (err, dataStr) {
        var data = JSON.parse(dataStr);
        return callback(err, data);
    });
}


function getBalance(guid, callback) {
    assert(guid, "Guid not specified");
    assert(isRealGuid(guid), "Not a GUID");
    assert(callback, "Callback not specified");

    var postData = { guid: guid };
    return post("/api/1/u/getbalance", postData, function (err, dataStr) {
        console.log(dataStr);
        return callback(err, dataStr);
    });
}


function getNickname(guid, callback) {
    assert(guid, "Guid not specified");
    assert(isRealGuid(guid), "Not a GUID");
    assert(callback, "Callback not specified");

    var postData = { guid: guid };
    return post("/api/1/u/getnickname", postData, function (err, dataStr) {
        console.log(dataStr);
        return callback(err, dataStr);
    });
}

function getUserNetwork(params, callback) {


    var postData = { guid: params.guid };
    return post("/api/1/u/getusernetwork", postData, function (err, dataStr) {
        var friends = JSON.parse(dataStr);

        for (var i = 0; i < friends.length; i++) {
            var friend = friends[i];
            if (friend.packet != '') {
                var payload = decrypt(friend.packet, params.password);
                if (payload.validated) {
                    friend.validated = true;
                }
            }
        }

        console.log(dataStr);
        return callback(err, friends);
    });
}

function getFriendRequests(guid, callback) {
    assert(guid, "Guid not specified");
    assert(isRealGuid(guid), "Not a GUID");
    assert(callback, "Callback not specified");

    var postData = { guid: guid };
    return post("/api/1/u/getfriendrequests", postData, function (err, dataStr) {
        var jdata = JSON.parse(dataStr);
        console.log(dataStr);
        return callback(err, jdata);
    });
}

function getUserPacket(guid, callback) {
    assert(guid, "Guid not specified");
    assert(isRealGuid(guid), "Not a GUID");
    assert(callback, "Callback not specified");

    var postData = { guid: guid };
    return post("/api/1/u/getuserpacket", postData, function (err, dataStr) {
        console.log(dataStr);
        dataStr = dataStr.replace('"', '');
        return callback(err, dataStr);
    });
}


function createAddress(guid, path, callback) {
    //TODO Add asserts

    assert(guid, "GUID not specified");
    assert(path, "Path not specified");
    assert(isRealGuid(guid), "Not a GUID");
    assert(callback, "Callback not specified");

    var postData = { guid: guid, path: path };
    return post("/api/1/u/createaddress", postData, function (err, response) {
        var data1 = response.body;
        console.log(data1);
        //console.log(dataStr);
        //var data1 = stripslashes(dataStr);
        //console.log(data1);

        //Because of broken JSON from Ben's API
        //data1=data1.replace(':"{"',':{"');
        //data1=data1.replace('"}"}','"}}');

        var data2 = JSON.parse(data1);
        console.log(data2);
        return callback(err, data2.Message);
    });
}


//temp function

//derive to support m/0/0/0

function deriveChild(path, hdwallet) {

    var e = path.split('/');
    var ret = hdwallet;
    // Special cases:
    if (path == 'm' || path == 'M' || path == 'm\'' || path == 'M\'') return this;

    for (var i in e) {
        var c = e[i];

        if (i == 0) {
            if (c != 'm') throw new Error("invalid path");
            continue;
        }

        var use_private = (c.length > 1) && (c[c.length - 1] == '\'');
        var child_index = parseInt(use_private ? c.slice(0, c.length - 1) : c) & 0x7fffffff;

        if (use_private)
            child_index += 0x80000000;

        ret = ret.derive(child_index);
    }

    return ret;
}


//temp function


function createFriend(params, callback) {

    var guid = params.guid;
    var password = params.password;
    var friendUserName = params.username;

    //we should probably pass the payload in here from the hbs
    getWalletFromServer(guid, "", function (err, wallet) {

        console.log(err, wallet);

        if (err) {
            throw err;
        }

        if (wallet && wallet == "GUID not found") {
            return callback("That GUID does not exist on the server.", err);
        }

        if (wallet.guid && wallet.guid != guid) {
            throw new Error("Blob has wrong guid!")
        }

        try {
            var decryptedPayload = decrypt(wallet.Payload, password);

            //get the next friend node
            var node = "";

            var postData = { guid: guid, username: friendUserName };
            post("/api/1/u/getnextnodeforfriend", postData, function (err, node) {

                var bipHot = Bitcoin2.HDWallet.fromBase58(decryptedPayload.hotPub);
                var bipCold = Bitcoin2.HDWallet.fromBase58(decryptedPayload.coldPub);
                var bipNinki = Bitcoin2.HDWallet.fromBase58(decryptedPayload.ninkiPubKey);

                var hotKey = deriveChild(node, bipHot).toString();
                var coldKey = deriveChild(node, bipCold).toString();
                var ninkiKey = deriveChild(node, bipNinki).toString();

                //get the friends public RSA key
                var rsaKey = '';
                var postRSAData = { username: friendUserName };
                post("/api/1/u/getrsakey", postRSAData, function (err, rsaKey) {

                    var crypt = new JSEncrypt();
                    crypt.setPublicKey(rsaKey.body);

                    //generate a hash from the RSA key and public keys for verification
                    var verifystring = rsaKey.body + hotKey + coldKey + ninkiKey;
                    var hashVerify = Bitcoin2.convert.wordArrayToBytes(Bitcoin2.Crypto.SHA256(verifystring));

                    hashVerify = encrypt(hashVerify, password);

                    var pub1 = crypt.encrypt(hotKey);
                    var pub2 = crypt.encrypt(coldKey);
                    var pub3 = crypt.encrypt(ninkiKey);

                    var pubset = pub1 + ' ' + pub2 + ' ' + pub3;

                    console.log(pubset);

                    var result = "";

                    var postFriendData = { guid: guid, userName: friendUserName, node: node, packetForFriend: pubset, validationHash: hashVerify.toString() };
                    post("/api/1/u/createfriend", postFriendData, function (err, result) {

                        return callback(err, result);

                    });

                });

            });

        } catch (err) {
            if (err.message == 'Unexpected end of input') {
                return callback("Could not decrypt.\n\n(Is your password correct?)", err);
            } else {
                //Something very strange happened.
                return callback("Could not decrypt.", err);
            }
        }
    });
}


function isNetworkExist(params, callback) {

    post("/api/1/u/doesnetworkexist", params, function (err, result) {
        var exists = JSON.parse(result);
        return callback(err, exists);

    });

}

function acceptFriendRequest(params, callback) {

    var guid = params.guid;
    var password = params.password;
    var friendUserName = params.username;
    var twofactor = "";
    var postData = { guid: guid, username: friendUserName };


    //we should probably pass the payload in here from the hbs
    getWalletFromServer(guid, "", function (err, wallet) {

        var decryptedPayload = decrypt(wallet.Payload, password);

        getUserPacket(guid, function (err, encpacket) {

            //get the RSA private key from the encrypted payload
            var rsaPriv = decrypt(encpacket, password);

            post("/api/1/u/getfriendrequestpacket", postData, function (err, packet) {

                packet = packet.replace('"', '');
                //get the packet from friend containing the public key set to
                //be used for address generation
                var res = packet.split(" ");
                var decrypt = new JSEncrypt();
                decrypt.setPrivateKey(rsaPriv.RSAPriv);
                var key1 = decrypt.decrypt(res[0]);
                var key2 = decrypt.decrypt(res[1]);
                var key3 = decrypt.decrypt(res[2]);

                var verifystring = rsaPriv.RSAPub + key1 + key2 + key3;
                var hashVerify = Bitcoin2.Crypto.SHA256(verifystring);

                //var secret = getVerificationCode(hashVerify.toString());

                hashVerify = Bitcoin2.convert.bytesToHex(Bitcoin2.convert.wordArrayToBytes(hashVerify));


                //now encrypt the keys with the user's password and save the packet
                //beck to the server

                var encryptedPayload = encrypt({
                    hotPub: key1,
                    coldPub: key2,
                    ninkiPub: key3,
                    validationHash: hashVerify
                }
			, password);

                postData = { guid: guid, username: friendUserName, packet: encryptedPayload.toString() };

                post("/api/1/u/updatefriend", postData, function (err, result) {

                    return callback(err, result);

                });

            });

        });

    });

}


function getVerification(params, callback) {

    var guid = params.guid;
    var password = params.password;
    var friendUserName = params.username;

    var postData = { guid: guid, username: friendUserName };

    post("/api/1/u/getfriendpacket", postData, function (err, packet) {

        packet = packet.replace('"', '');
        //get the packet from friend containing the public key set to
        //be used for address generation
        var payload = decrypt(packet, password);

        //hash verify what you used to encrypt your keys and send to
        //your friend, this code is given to your friend to verify that
        //what you have matches their key set
        var hashVerifyToTellFriend = getVerificationCode(payload.validationHash);



        return callback(err, hashVerifyToTellFriend.join(""));

        //next we need to verify that the validation sequence
        //provided by my friend matches what i have in my encrypted packet
        //get the packet for your friend
        //get his public keys assigned by you
        //get your own RSA key from your user packet and generate the hash

        //        post("/api/1/u/getverificationcode", postData, function (err, packet) {

        //            packet = packet.replace('"', '');
        //            //get the packet from friend containing the public key set to
        //            //be used for address generation
        //            var hashVerifyForChecking = decrypt(packet, password);



        //        });

    });

}

//function isFriendVerified(params) {

//    var postData = { guid: params.guid, username: params.username };

//    post("/api/1/u/getfriendpacket", postData, function (err, packet) {

//        packet = packet.replace('"', '');
//        //get the packet from friend containing the public key set to
//        //be used for address generation
//        var payload = decrypt(packet, password);

//        return payload.validated;
//       
//    });

//}

function verifyFriendData(params, callback) {

    var guid = params.guid;
    var password = params.password;
    var friendUserName = params.username;
    var code = params.code;

    var postData = { guid: guid, username: friendUserName };

    //next we need to verify that the validation sequence
    //provided by my friend matches what i have in my encrypted packet
    //get the packet for your friend
    //get his public keys assigned by you
    //get your own RSA key from your user packet and generate the hash

    post("/api/1/u/getverificationcode", postData, function (err, packet) {

        packet = packet.replace('"', '');
        //get the packet from friend containing the public key set to
        //be used for address generation
        var hashVerifyForChecking = Crypto.util.bytesToHex(decrypt(packet, password));

        var checkCode = verifyCode(hashVerifyForChecking, code);
        if (code == checkCode) {

            //update packet with status as verified and log
            //the verification code
            var postData = { guid: params.guid, username: params.username };

            post("/api/1/u/getfriendpacket", postData, function (err, packet) {

                packet = packet.replace('"', '');
                //get the packet from friend containing the public key set to
                //be used for address generation
                var payload = decrypt(packet, password);

                var encryptedPayload = encrypt({
                    hotPub: payload.hotPub,
                    coldPub: payload.coldPub,
                    ninkiPub: payload.ninkiPub,
                    validationHash: payload.validationHash,
                    validated: true
                }
			    , password);

                postData = { guid: guid, username: friendUserName, packet: encryptedPayload.toString() };

                post("/api/1/u/updatefriend", postData, function (err, result) {

                    return callback(err, result);

                });

            });

            return callback(err, true);
        } else {
            return callback(err, false);
        }

    });



}


function verifyCode(hashVerify, code) {
    //derive the verification code
    var r1 = code[4] * 1;
    var r2 = code[5] * 1;

    var shash = hashVerify;
    var secret = [];
    var inc = r2;
    for (var i = 0; i < 4; i++) {

        if (inc > shash.length) {
            inc = inc - shash.length;
        }

        secret.push(shash[inc]);

        inc = inc + r1;
    }

    secret.push(r1.toString());
    secret.push(r2.toString());

    return secret.join("");
}

function getVerificationCode(hashVerify) {
    //derive the verification code
    var r1 = Math.floor(Math.random() * 10);
    var r2 = Math.floor(Math.random() * 10);

    var shash = hashVerify;
    var secret = [];
    var inc = r2;
    for (var i = 0; i < 4; i++) {

        if (inc > shash.length) {
            inc = inc - shash.length;
        }

        secret.push(shash[inc]);

        inc = inc + r1;
    }

    secret.push(r1.toString());
    secret.push(r2.toString());

    return secret;
}





function sendTransactionUI() {
    var toAddress = $('#toAddress').val();
    var amount = $('#amount').val();

    getUnspentOutputs(guid, function (err, result) {
        console.log("getUnspentOutputs", err, result);

        var resultObj = JSON.parse(result);

        console.log(resultObj);

        //txrebuild

        var sec = walletPayload.hotPriv;
        var addr = toAddress;
        var unspent = result; //TODO is this right?
        var balance = resultObj.Amount;
        var fee = "0.0001";

        try {
            var res = parseBase58Check(sec);
            var version = res[0];
            var payload = res[1];
        } catch (err) {
            console.log(err);
            return;
        }

        var compressed = false;
        if (payload.length > 32) {
            payload.pop();
            compressed = true;
        }

        var eckey = new Bitcoin.ECKey(payload);

        eckey.setCompressed(compressed);

        TX.init(eckey);

        var fval = 0;
        //var o = txGetOutputs();


        var o = [{ "dest": toAddress, "fval": amount}];


        for (i in o) {
            TX.addOutput(o[i].dest, o[i].fval);
            fval += o[i].fval;
        }

        // send change back or it will be sent as fee
        if (balance > fval + fee) {
            var change = balance - fval - fee;
            TX.addOutput(addr, change);
        }

        console.log("before try");
        try {
            var sendTx = TX.construct();
            console.log("1");
            var buf = sendTx.serialize();
            console.log("2");
            var txHex = Crypto.util.bytesToHex(buf);

        } catch (err) {
            console.log("err", err);
        }

        //end texrebuild

        var rawTransaction = txHex;

        var transaction = {
            "hashesForSigning": [
						resultObj.TransactionId
					],
            "pathsToSignWith": [
                        resultObj.NodeLevel
					],
            "rawTransaction": rawTransaction,
            "guid": guid
        };

        console.log("transaction", transaction);
        sendTransaction(JSON.stringify(transaction), function (err, result) {
            console.log("Sent transaction", result);
            alert("Sent transaction");
        });
    });
    // });

}

function getUnspentOutputs(guid, callback) {

    assert(guid, "GUID not specified");
    assert(callback, "Callback not specified");

    assert(isRealGuid(guid), "Not a GUID");

    var postData = { guid: guid };
    return post("/api/1/u/getunspentoutputs", postData, function (err, response) {
        console.log(err, response);
        var data1 = response.body;
        var data2 = JSON.parse(data1);
        return callback(err, data2.Message);
    });
}


function getTransactionRecords(guid, callback) {

    var postData = { guid: guid };

    post("/api/1/u/gettransactionrecords", postData, function (err, transactions) {

        var jtran = JSON.parse(transactions.body);

        return callback(err, jtran);

    });

}

function getInvoiceList(params, callback) {

    var guid = params.guid;
    var password = params.password;

    var postData = { guid: guid, status: 0 };

    getUserPacket(guid, function (err, encpacket) {

        //get the RSA private key from the encrypted payload
        var rsaPriv = decrypt(encpacket, password);
        var crypt = new JSEncrypt();
        crypt.setPrivateKey(rsaPriv.RSAPriv);

        post("/api/1/u/getinvoicestopay", postData, function (err, invoices) {

            var jtran = JSON.parse(invoices.body);

            //iterate and decrypt each packet
            var bytes = [];

            var c = 0;
            var bytes = [];

            for (var k = 0; k < jtran.length; k++) {
                if (jtran[k].Packet.length < 172) {
                    jtran[k].Packet = crypt.decrypt(jtran[k].Packet);
                } else {
                    var s = ''
                    var encblocks = '';
                    for (var i = 0; i < jtran[k].Packet.length; ++i) {
                        s += jtran[k].Packet[i];
                        c++;
                        if (c == 172) {
                            var block = crypt.decrypt(s);
                            c = 0;
                            s = '';
                            encblocks += block;
                        }

                    }
                    jtran[k].Packet = encblocks;
                }
            }
            return callback(err, jtran);

        });

    });

}


function createInvoice(params, callback) {

    var guid = params.guid;
    var password = params.password;
    var userName = params.userName;
    var invoice = params.invoice;

    var packetForMe = "";
    var packetForThem = "";

    var jsonInvoice = JSON.stringify(invoice);

    //get the contacts RSA key
    var packetForMe = encrypt(invoice, password).toString();

    var rsaKey = '';
    var postRSAData = { username: userName };
    post("/api/1/u/getrsakey", postRSAData, function (err, rsaKey) {

        var crypt = new JSEncrypt();
        crypt.setPublicKey(rsaKey.body);


        //encrypt into 128 byte blocks
        var bytes = [];

        var c = 0;
        var bytes = [];

        if (jsonInvoice.length < 117) {
            packetForThem = crypt.encrypt(jsonInvoice);
        } else {
            var encblocks = '';
            var s = ''
            for (var i = 0; i < jsonInvoice.length; ++i) {
                s += jsonInvoice[i];
                c++;
                if (c == 117 || i == jsonInvoice.length - 1) {
                    var block = crypt.encrypt(s);
                    c = 0;
                    s = '';
                    encblocks += block;
                }

            }
            packetForThem = encblocks;
        }



        var pdata = { guid: guid, userName: userName, packetForMe: packetForMe, packetForThem: packetForThem };
        post("/api/1/u/createinvoice", pdata, function (err, invoiceid) {

            return callback(err, invoiceid.body);

        });

    });

}

function updateInvoice(params, callback) {
    var postData = { userName: params.userName, invoiceId: params.invoiceId, transactionId: params.transactionId, status: params.status };
    return post("/api/1/u/updateinvoice", postData, function (err, dataStr) {
        console.log(dataStr);
        return callback(err, dataStr);
    });
}


function aMultiSig2Of3Transaction(userSigs, publicKeys, outputsToSpend, outputsToSend) {


}

function aMultiSigHashForSigning3(publickey1, publickey2, publickey3, index, outputsToSpend, outputsToSend, addressToSend) {


    //var tmpAddress = "2N26KoEMgxj6upRCnkDiajRbPsH6s1EzhFT";

    var tx = new Bitcoin2.Transaction();

    var ins = [];
    var outs = [];


    var script = [0x52];
    script.push(33);
    script = script.concat(publickey1);
    script.push(33);
    script = script.concat(publickey2);
    script.push(33);
    script = script.concat(publickey3);
    script.push(0x53);
    script.push(0xae);


    for (var i = 0; i < outputsToSpend.length; i++) {
        var p = outputsToSpend[i].transactionId + ':' + outputsToSpend[i].outputIndex.toString();
        tx.addInput(p);
        if (i == index) {
            tx.ins[i].script = new Bitcoin2.Script(script);
        } else {
            tx.ins[i].script = new Bitcoin2.Script([0]);
        }
    }

    var test = '';
    for (var i = 0; i < outputsToSend.length; i++) {
        var addr = new Bitcoin2.Address(addressToSend[i]);
        tx.addOutput(addressToSend[i], outputsToSend[i]);
    }

    //var txHash = Array.apply([], tx.serialize());

    //txHash.push(0x01);
    //txHash.push(0x00);
    //txHash.push(0x00);
    //txHash.push(0x00);



    //var txHash = Crypto.SHA256(Crypto.SHA256(txHash, { asBytes: true }), { asBytes: true });

    var txHash = tx.hashTransactionForSignature(tx.ins[index].script, index, 1);

    return txHash;

}


function aGetTransaction(publickeys, outputsToSpend, outputsToSend, addressToSend, sigs) {


    //var tmpAddress = "2N26KoEMgxj6upRCnkDiajRbPsH6s1EzhFT";

    var tx = new Bitcoin2.Transaction();

    var ins = [];
    var outs = [];




    for (var i = 0; i < outputsToSpend.length; i++) {

        var len = sigs[i].length;
        var script = [];
        script = script.concat(sigs[i]);
        script.unshift(len);
        script.unshift(0x00);
        script.push(0x4c);
        script.push(105);
        script.push(0x52);
        script.push(33);
        script = script.concat(publickeys[i][0]);
        script.push(33);
        script = script.concat(publickeys[i][1]);
        script.push(33);
        script = script.concat(publickeys[i][2]);
        script.push(0x53);
        script.push(0xae);




        var p = outputsToSpend[i].transactionId + ':' + outputsToSpend[i].outputIndex.toString();
        tx.addInput(p);
        //if (i == index) {
        tx.ins[i].script = new Bitcoin2.Script(script);
        //} else {
        //    tx.ins[i].script = new Bitcoin.Script([0]);
        //}
    }

    var test = '';
    for (var i = 0; i < outputsToSend.length; i++) {
        //var addr = new Bitcoin2.Address.fromBase58Check(addressToSend[i]);
        tx.addOutput(addressToSend[i], outputsToSend[i]);
    }

    var txHash = Array.apply([], tx.serialize());

    return txHash;
}


function aGetTransactionData(params, callback) {


    var derivedPublicKeys = [];
    var derivedPrivateKeys = [];

    var signatures = [];
    var hashesForSigning = [];
    for (var i = 0; i < params.outputsToSpend.length; i++) {
        var path = params.paths[i];
        //derive all the public keys

        var hashForSigning = aMultiSigHashForSigning3(params.publicKeys[i][0], params.publicKeys[i][1], params.publicKeys[i][2], i, params.outputsToSpend, params.amountsToSend, params.addressToSend);

        hashesForSigning.push(Bitcoin2.convert.bytesToHex(hashForSigning));

        var key = params.userHotPrivKeys[i];

        var sig = key.sign(hashForSigning).concat([1]);

        //var sigt = tx.signScriptSig(0, tx.ins[0].script, key, 1)

        signatures.push(sig);
    }

    var txn = aGetTransaction(params.publicKeys, params.outputsToSpend, params.amountsToSend, params.addressToSend, signatures);

    //generate the signatures






    return callback("", hashesForSigning, Bitcoin2.convert.bytesToHex(txn));
}



function sendTestTransaction(params, callback) {

    var minersFee = 50000;

    var guid = params.guid;
    var password = params.password;
    var friendUserName = params.friendUser;
    var amount = (params.amount) * 100000000;
    amount = Math.round(amount);
    var postData = { guid: guid, username: friendUserName, amount: amount };

    //we should probably pass the payload in here from the hbs
    getWalletFromServer(guid, "", function (err, wallet) {

        var decryptedPayload = decrypt(wallet.Payload, password);

        var bipHot = Bitcoin2.HDWallet.fromBase58(decryptedPayload.hotPriv);

        var bipHotPub = Bitcoin2.HDWallet.fromBase58(decryptedPayload.hotPub);
        var bipCold = Bitcoin2.HDWallet.fromBase58(decryptedPayload.coldPub);
        var bipNinki = Bitcoin2.HDWallet.fromBase58(decryptedPayload.ninkiPubKey);


        var pdata = { guid: guid };

        post("/api/1/u/getunspentoutputs", pdata, function (err, outputs) {

            var outputs = JSON.parse(outputs.body);
            var outputsToSpend = [];
            var amountsToSend = [];
            var addressToSend = [];
            var userHotPrivKeys = [];

            var userHotPrivKeysTest = [];

            var nodeLevels = [];
            var publicKeys = [];
            var packet = { addressToSend: addressToSend, amountsToSend: amountsToSend, outputsToSpend: outputsToSpend, userHotPrivKeys: userHotPrivKeys, guid: guid, paths: nodeLevels, publicKeys: publicKeys };

            var testpacket = { addressToSend: addressToSend, amountsToSend: amountsToSend, outputsToSpend: outputsToSpend, userHotPrivKeys: userHotPrivKeysTest, guid: guid };


            //get outputs to spend, calculate change amount minus miners fee

            var amountSoFar = 0;
            for (var i = 0; i < outputs.length; i++) {

                var pitem = outputs[i];
                var pout = { transactionId: pitem.TransactionId, outputIndex: pitem.OutputIndex, amount: pitem.Amount, address: pitem.Address }

                nodeLevels.push(pitem.NodeLevel);

                outputsToSpend.push(pout);

                userHotPrivKeys.push(deriveChild(pitem.NodeLevel, bipHot).priv);

                userHotPrivKeysTest.push(userHotPrivKeys[i].toString(' '));

                var dbipHotPub = deriveChild(pitem.NodeLevel, bipHotPub).pub.toBytes();
                var dbipColdPub = deriveChild(pitem.NodeLevel, bipCold).pub.toBytes();
                var dbipNinkiPub = deriveChild(pitem.NodeLevel, bipNinki).pub.toBytes();

                publicKeys.push([dbipHotPub, dbipColdPub, dbipNinkiPub]);

                amountSoFar += pitem.Amount;

                if ((amountSoFar - amount) >= minersFee) {
                    break;
                }

                //test the keys out

                //bipHotPub
                //userHotPrivKeys[i]

            }

            amountsToSend.push(amount);
            //now create the change

            var changeAmount = amountSoFar - (amount + minersFee);

            if (changeAmount < 0) {
                return callback(err, "Not enough funds");
            }


            amountsToSend.push(changeAmount);

            //create a new address for my change to be sent back to me


            var params = { guid: guid, username: friendUserName, amount: amount, password: password };
            createAddressForFriend(params, function (err, address) {

                addressToSend.push(address);

                var addrParams = { guid: guid, nodePath: 'm/0/1', wallet: decryptedPayload };
                createAddress(addrParams, function (err, changeaddress) {

                    //address = "2MyCxHAEcT4tQL6CDTUvX7QRfgY6Be2Vb8R";

                    addressToSend.push(changeaddress);

                    var tparams = { jsonPacket: JSON.stringify(testpacket) };
                    //now get the test transaction
                    //post("/api/1/u/getrawtransactionfortesting", tparams, function (err, rawtrans1) {

                    //var test123 = rawtrans1.body;

                    //var ttt = [48, 68, 2, 32, 30, 211, 202, 114, 159, 135, 126, 149, 142, 62, 224, 99, 74, 208, 49, 191, 200, 6, 130, 149, 4, 49, 89, 23, 118, 107, 249, 166, 175, 118, 143, 126, 2, 32, 56, 240, 230, 61, 89, 213, 203, 90, 35, 207, 26, 71, 51, 235, 194, 157, 160, 244, 103, 236, 136, 84, 211, 158, 10, 156, 225, 184, 18, 6, 206, 227, 1];


                    aGetTransactionData(packet, function (err, hashesForSigning, rawTransaction) {

                        var jsonSend = { guid: guid, hashesForSigning: hashesForSigning, rawTransaction: rawTransaction, pathsToSignWith: nodeLevels }

                        var jsonp1 = { jsonPacket: JSON.stringify(jsonSend) };
                        //var jsonp = { jsonPacket: test123 };
                        post("/api/1/u/sendtransaction", jsonp1, function (err, transactionid) {

                            var tran = JSON.parse(transactionid.body);

                            //we have a transaction id so lets make a not of the transaction in the database
                            var params = { guid: guid, username: friendUserName, transactionid: tran.Message, address: address, amount: amount };

                            post("/api/1/u/createtransactionrecord", params, function (err, result) {

                                return callback(err, tran.Message);

                            });


                        });

                        //});


                    });
                });

            });

        });

    });


    //get private key from packet

    //get unspent outputs

    //get an address to send to



}




//function sendTestTransaction(params, callback) {

//    var guid = params.guid;
//    var password = params.password;
//    var friendUserName = params.friendUser;
//    var amount = ((params.amount) * 100000000).toFixed(0);

//    var postData = { guid: guid, username: friendUserName, amount: amount };

//    //we should probably pass the payload in here from the hbs
//    getWalletFromServer(guid, "", function (err, wallet) {

//        var decryptedPayload = decrypt(wallet.Payload, password);

//        var bipHot = new BIP32(decryptedPayload.hotPriv);

//        var pdata = { guid: guid };

//        post("/api/1/u/getunspentoutputs", pdata, function (err, outputs) {

//            var outputs = JSON.parse(outputs.body);
//            var outputsToSpend = [];
//            var amountsToSend = [];
//            var addressToSend = [];
//            var userHotPrivKeys = [];

//            var packet = { addressToSend: addressToSend, amountsToSend: amountsToSend, outputsToSpend: outputsToSpend, userHotPrivKeys: userHotPrivKeys, guid: guid };

//            var nodeLevels = [];
//            for (var i = 0; i < outputs.length; i++) {
//                var pitem = outputs[i];
//                var pout = { transactionId: pitem.TransactionId, outputIndex: pitem.OutputIndex, amount: pitem.Amount, address: pitem.Address }
//                nodeLevels.push(pitem.NodeLevel);
//                outputsToSpend.push(pout);
//                userHotPrivKeys.push(bipHot.derive(pitem.NodeLevel).extended_private_key_string('base58'));
//            }

//            amountsToSend.push(amount);

//            //get address here

//            var params = { guid: guid, username: friendUserName, amount: amount, password: password };
//            createAddressForFriend(params, function (err, address) {

//                addressToSend.push(address);

//                var params = { jsonPacket: JSON.stringify(packet) };
//                //now get the test transaction
//                post("/api/1/u/getrawtransactionfortesting", params, function (err, rawtrans) {


//                    var tester = JSON.parse(rawtrans.body);
//                    params = { jsonPacket: rawtrans.body };
//                    post("/api/1/u/sendtransaction", params, function (err, transactionid) {

//                        var tran = JSON.parse(transactionid.body);

//                        //we have a transaction id so lets make a not of the transaction in the database
//                        var params = { guid: guid, username: friendUserName, transactionid: tran.Message, address: address, amount: amount };

//                        post("/api/1/u/createtransactionrecord", params, function (err, result) {

//                            return callback(err, tran.Message);

//                        });


//                    });


//                });


//            });

//        });

//    });


//    //get private key from packet

//    //get unspent outputs

//    //get an address to send to



//}


function createAddress(params, callback) {

    var postData = { guid: params.guid, pathToUse: params.nodePath };

    post("/api/1/u/getnextleaf", postData, function (err, leaf) {

        var path = params.nodePath + '/' + leaf;

        var bipHot = Bitcoin2.HDWallet.fromBase58(params.wallet.hotPub);
        var bipCold = Bitcoin2.HDWallet.fromBase58(params.wallet.coldPub);
        var bipNinki = Bitcoin2.HDWallet.fromBase58(params.wallet.ninkiPubKey);

        var hotKey = deriveChild(path, bipHot);
        var coldKey = deriveChild(path, bipCold);
        var ninkiKey = deriveChild(path, bipNinki);

        //now create the multisig address
        var script = [0x52];
        script.push(33);
        script = script.concat(hotKey.pub.toBytes());
        script.push(33);
        script = script.concat(coldKey.pub.toBytes());
        script.push(33);
        script = script.concat(ninkiKey.pub.toBytes());
        script.push(0x53);
        script.push(0xae);
        var address = multiSig(script);

        var postData = { guid: params.guid, path: path };
        post("/api/1/u/createaddress", postData, function (err, result) {

            return callback(err, address, path);

        });

        //now update the address to the server

    });

}


function createAddressForFriend(params, callback) {

    var postData = { guid: params.guid, username: params.username };

    post("/api/1/u/getfriendpacket", postData, function (err, packet) {

        packet = packet.replace('"', '');
        //get the packet from friend containing the public key set to
        //be used for address generation
        var pubkeys = decrypt(packet, password);


        post("/api/1/u/getnextleafforfriend", postData, function (err, leaf) {

            var path = 'm/' + leaf;

            var bipHot = Bitcoin2.HDWallet.fromBase58(pubkeys.hotPub);
            var bipCold = Bitcoin2.HDWallet.fromBase58(pubkeys.coldPub);
            var bipNinki = Bitcoin2.HDWallet.fromBase58(pubkeys.ninkiPub);

            var hotKey = deriveChild(path, bipHot);
            var coldKey = deriveChild(path, bipCold);
            var ninkiKey = deriveChild(path, bipNinki);

            //now create the multisig address
            var script = [0x52];
            script.push(33);
            script = script.concat(hotKey.pub.toBytes());
            script.push(33);
            script = script.concat(coldKey.pub.toBytes());
            script.push(33);
            script = script.concat(ninkiKey.pub.toBytes());
            script.push(0x53);
            script.push(0xae);
            var address = multiSig(script);

            var postData = { guid: params.guid, username: params.username, address: address, leaf: leaf };
            post("/api/1/u/createaddressforfriend", postData, function (err, result) {

                return callback(err, address);

            });

            //now update the address to the server



        });

    });

}

function multiSig(rs) {
    var x = Bitcoin2.Crypto.RIPEMD160(Bitcoin2.Crypto.SHA256(Bitcoin2.convert.bytesToWordArray(rs)));
    x = Bitcoin2.convert.wordArrayToBytes(x);
    x.unshift(0xC4);
    var r = x;
    r = Bitcoin2.Crypto.SHA256(Bitcoin2.Crypto.SHA256(Bitcoin2.convert.bytesToWordArray(r)));
    var checksum = Bitcoin2.convert.wordArrayToBytes(r).slice(0, 4);
    var address = Bitcoin2.base58.encode(x.concat(checksum));
    return address;
}