"use strict";

function downloadAndOpenWalletUI(params,callback){

	assert(params.guidElement,"GUID not specified");
	assert(params.passwordElement,"Password not specified");
	assert(params.guidElement.val(),"GUID is blank");
	assert(params.passwordElement.val(),"Password is blank");

	assert(isRealGuid(params.guidElement.val()),"GUID is invalid");
	assert(
		params.passwordElement.val().length > config.walletSecurity.minimumPasswordLength,
		"Password is too short (minimum length is "+config.walletSecurity.minimumPasswordLength+")"
	);
	assert(callback,"Callback not specified");

	var guid = params.guidElement.val();
	var password = params.passwordElement.val();

	getWalletFromServer(guid,function(err,wallet){

		console.log(err,wallet);

		if (err){
			throw err;
		}

		if (wallet.Message && wallet.Message=="GUID not found"){
			return callback("That GUID does not exist on the server.", err);
		}

		if (wallet.Message.guid && wallet.Message.guid!=guid){
			throw new Error("Blob has wrong guid!")
		}

		try{
			var decryptedPayload = decrypt(wallet.Message.Payload,password);
		}catch(err){
			if (err.message == 'Unexpected end of input'){
				return callback("Could not decrypt.\n\n(Is your password correct?)", err);
			}else{
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
		.replace(/\\(.?)/g, function(s, n1) {
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

function getWalletFromServer(guid,callback){
	assert(guid,"Guid not specified");
	assert(isRealGuid(guid),"Not a GUID");
	assert(callback,"Callback not specified");

	var postData={guid:guid};
	return post("/api/1/u/getaccountdetails",postData,function(err,dataStr){
		console.log(dataStr);
		var data1 = stripslashes(dataStr);
		console.log(data1);

		//Because of broken JSON from Ben's API
		data1=data1.replace(':"{"',':{"');
		data1=data1.replace('"}"}','"}}');

		var data2 = JSON.parse(data1);
		console.log(data2);
		return callback(err,data2);
	});
}


function getNickname(guid,callback){
	assert(guid,"Guid not specified");
	assert(isRealGuid(guid),"Not a GUID");
	assert(callback,"Callback not specified");

	var postData={guid:guid};
	return post("/api/1/u/getnickname",postData,function(err,dataStr){
		console.log(dataStr);
		return callback(err,dataStr);
	});
}

function getUserPacket(guid,callback){
	assert(guid,"Guid not specified");
	assert(isRealGuid(guid),"Not a GUID");
	assert(callback,"Callback not specified");

	var postData={guid:guid};
	return post("/api/1/u/getuserpacket",postData,function(err,dataStr){
		console.log(dataStr);
		dataStr=dataStr.replace('"','');
		return callback(err,dataStr);
	});
}


function createAddress(guid,path,callback){
	//TODO Add asserts

	assert(guid,"GUID not specified");
	assert(path,"Path not specified");
	assert(isRealGuid(guid),"Not a GUID");
	assert(callback,"Callback not specified");

	var postData={guid:guid,path:path};
	return post("/api/1/u/createaddress",postData,function(err,response){
		var data1=response.body;
		console.log(data1);
		//console.log(dataStr);
		//var data1 = stripslashes(dataStr);
		//console.log(data1);

		//Because of broken JSON from Ben's API
		//data1=data1.replace(':"{"',':{"');
		//data1=data1.replace('"}"}','"}}');

		var data2 = JSON.parse(data1);
		console.log(data2);
		return callback(err,data2.Message);
	});
}


function createFriend(params,callback){

	assert(params.guidElement,"GUID not specified");
	assert(params.passwordElement,"Password not specified");
	assert(params.guidElement.val(),"GUID is blank");
	assert(params.passwordElement.val(),"Password is blank");

	assert(isRealGuid(params.guidElement.val()),"GUID is invalid");
	assert(
		params.passwordElement.val().length > config.walletSecurity.minimumPasswordLength,
		"Password is too short (minimum length is "+config.walletSecurity.minimumPasswordLength+")"
	);
	assert(callback,"Callback not specified");

	var guid = params.guidElement.val();
	var password = params.passwordElement.val();
	var friendUserName = params.friendUserNameElement.val();

	getWalletFromServer(guid,function(err,wallet){

		console.log(err,wallet);

		if (err){
			throw err;
		}

		if (wallet.Message && wallet.Message=="GUID not found"){
			return callback("That GUID does not exist on the server.", err);
		}

		if (wallet.Message.guid && wallet.Message.guid!=guid){
			throw new Error("Blob has wrong guid!")
		}

		try{
			var decryptedPayload = decrypt(wallet.Message.Payload,password);

			//get the next friend node
			var node = "";

			var postData={guid:guid};
			post("/api/1/u/getnextnodeforfriend",postData,function(err,node){

				var bipHot = new BIP32(decryptedPayload.hotPub);
				var bipCold = new BIP32(decryptedPayload.coldPub);
				var bipNinki = new BIP32(decryptedPayload.ninkiPubKey);

				var hotKey = bipHot.derive(node).extended_public_key_string('base58');
				var coldKey = bipCold.derive(node).extended_public_key_string('base58');
				var ninkiKey = bipNinki.derive(node).extended_public_key_string('base58');

				//get the friends public RSA key
				var rsaKey = '';
				var postRSAData={username:friendUserName};
				post("/api/1/u/getrsakey",postRSAData,function(err,rsaKey){

					var crypt = new JSEncrypt();
					crypt.setPublicKey(rsaKey.body);

					var pub1 = crypt.encrypt(hotKey);
					var pub2 = crypt.encrypt(coldKey);
					var pub3 =crypt.encrypt(ninkiKey);

					var pubset = pub1 + ' ' + pub2 + ' ' + pub3;

					console.log(pubset);

					var result = "";

					var postFriendData={guid:guid, userName:friendUserName,node:node,packetForFriend:pubset};
					post("/api/1/u/createfriend",postFriendData,function(err,result){

						return callback(err,result);

					});


				});


			});


		}catch(err){
			if (err.message == 'Unexpected end of input'){
				return callback("Could not decrypt.\n\n(Is your password correct?)", err);
			}else{
				//Something very strange happened.
				return callback("Could not decrypt.", err);
			}
		}
	});
}


function acceptFriendRequest(params,callback){

var guid = params.guidElement.val();
var password = params.passwordElement.val();
var friendUserName = params.friendUserNameElement.val();


var postData={guid:guid,username:friendUserName};

getWalletFromServer(guid,function(err,wallet){

	var decryptedPayload = decrypt(wallet.Message.Payload,password);


	getUserPacket(guid,function(err,encpacket){

	//get the RSA private key from the encrypted payload
		var rsaPriv = decrypt(encpacket,password);

		post("/api/1/u/getfriendrequestpacket",postData,function(err,packet){

			packet = packet.replace('"','');
			//get the packet from friend containing the public key set to
			//be used for address generation
		    var res = packet.split(" ");
			var decrypt = new JSEncrypt();
			decrypt.setPrivateKey(rsaPriv.RSAPriv);
			var key1 = decrypt.decrypt(res[0]);
			var key2 = decrypt.decrypt(res[1]);
			var key3 = decrypt.decrypt(res[2]);

			//now encrypt the keys with the user's password and save the packet
			//beck to the server

			var encryptedPayload = encrypt({
				hotPub: key1,
				coldPub: key2,
				ninkiPub: key3
			}
			, password);

			postData={guid:guid,username:friendUserName,packet:encryptedPayload.toString()};

			post("/api/1/u/updatefriend",postData,function(err,result){

				return callback(err,result);

			});

		});

	});

});

}


function sendTestTransaction(params,callback) {

	var guid = params.guidElement.val();
	var password = params.passwordElement.val();
	var friendUserName = params.friendUserNameElement.val();
	var amount = params.amountElement.val();

	var postData={guid:guid,username:friendUserName,amount:amount};


	getWalletFromServer(guid,function(err,wallet){

		var decryptedPayload = decrypt(wallet.Message.Payload,password);

		var bipHot = new BIP32(decryptedPayload.hotPriv);

		var pdata={guid:guid};

		post("/api/1/u/getunspentoutputs",pdata,function(err,outputs){

			var outputs = JSON.parse(outputs.body);
			var outputsToSpend = [];
			var amountsToSend = [];
			var addressToSend = [];
			var userHotPrivKeys = [];

			var packet = {addressToSend:addressToSend,amountsToSend:amountsToSend,outputsToSpend:outputsToSpend,userHotPrivKeys:userHotPrivKeys,guid:guid};

			var nodeLevels = [];
			for (var i = 0; i < outputs.length; i++) {
			   	var pitem = outputs[i];
			   	var pout = {transactionId:pitem.TransactionId,outputIndex:pitem.OutputIndex,amount:pitem.Amount,address:pitem.Address}
			   	nodeLevels.push(pitem.NodeLevel);
			   	outputsToSpend.push(pout);
			   	userHotPrivKeys.push(bipHot.derive(pitem.NodeLevel).extended_private_key_string('base58'));
			}

			amountsToSend.push(amount);

			//get address here

			var params={guid:guid,username:friendUserName,amount:amount,password:password};
			createAddressForFriend(params,function(err,address) {

				addressToSend.push(address);

				var params={jsonPacket:JSON.stringify(packet)};
				//now get the test transaction
				post("/api/1/u/getrawtransactionfortesting",params,function(err,rawtrans){


					var tester = JSON.parse(rawtrans.body);
					params={jsonPacket:rawtrans.body};
					post("/api/1/u/sendtransaction",params,function(err,transactionid){

						var tran = JSON.parse(transactionid.body);
						return callback(err,tran.Message);
					});


				});


			});

		});

	});


	//get private key from packet

	//get unspent outputs

	//get an address to send to



}


function createAddressForFriend(params,callback){

var password = params.password;
var postData={guid:params.guid,username:params.username};

post("/api/1/u/getfriendpacket",postData,function(err,packet){

	packet = packet.replace('"','');
	//get the packet from friend containing the public key set to
	//be used for address generation
	var pubkeys = decrypt(packet,password);


	post("/api/1/u/getnextleafforfriend",postData,function(err,leaf){

		var path = 'm/' + leaf;

		var bipHot = new BIP32(pubkeys.hotPub);
		var bipCold = new BIP32(pubkeys.coldPub);
		var bipNinki = new BIP32(pubkeys.ninkiPub);

		bipHot = bipHot.derive(path);
		bipCold = bipCold.derive(path);
		bipNinki = bipNinki.derive(path);

		//now create the multisig address
		var script = [0x52];
		script.push(33);
		script = script.concat(bipHot.eckey.getPub());
		script.push(33);
		script = script.concat(bipCold.eckey.getPub());
		script.push(33);
		script = script.concat(bipNinki.eckey.getPub());
		script.push(0x53);
		script.push(0xae);
		var address = multiSig(script);

		var postData={guid:params.guid,username:params.username,address:address,leaf:leaf};
		post("/api/1/u/createaddressforfriend",postData,function(err,result){

			return callback(err,address);

		});

		//now update the address to the server



	});

	function multiSig(rs){
		var x = Crypto.RIPEMD160(Crypto.SHA256(rs,{asBytes: true}),{asBytes: true});
		x.unshift(0xC4);
		var r = x;
		r = Crypto.SHA256(Crypto.SHA256(r,{asBytes: true}),{asBytes: true});
		var checksum = r.slice(0,4);
		var address = Bitcoin.Base58.encode(x.concat(checksum));
		return address;
	}

});


}