var express = require('express');
var fs = require('fs');
var https = require('https');
var path = require('path');
var request = require('request');

var websocketIOServer = require('node-websocket.io'); // custom node module
var loader = require('node-itemloader'); // custom node module
var interaction = require('node-interaction'); // custom node module
var sagepointer = require('node-sagepointer'); // custom node module
var omicronManager = require('node-omicron'); // custom node module
 
// CONFIG FILE
//var file = "config/desktop-cfg.json";
//var file = "config/thor-cfg.json";
//var file = "config/iridiumX-cfg.json";
//var file = "config/lyraX-cfg.json";
var file = "config/desktop-omicron-cfg.json";
//ar file = "config/iridiumX-omicron-cfg.json";

var json_str = fs.readFileSync(file, 'utf8');
var config = JSON.parse(json_str);
config.totalWidth = config.resolution.width * config.layout.columns;
config.totalHeight = config.resolution.height * config.layout.rows;
config.titleBarHeight = Math.round(0.025 * config.totalHeight);
config.titleTextSize = Math.round(0.015 * config.totalHeight);
config.pointerWidth = Math.round(0.20 * config.totalHeight);
config.pointerHeight = Math.round(0.05 * config.totalHeight);
console.log(config);

var uploadsFolder = path.join(__dirname, "uploads");

var savedFiles = {"image": [], "video": [], "pdf": [], "app": []};
var uploadedImages = fs.readdirSync(path.join(uploadsFolder, "images"));
var uploadedVideos = fs.readdirSync(path.join(uploadsFolder, "videos"));
var uploadedPdfs = fs.readdirSync(path.join(uploadsFolder, "pdfs"));
var uploadedApps = fs.readdirSync(path.join(uploadsFolder, "apps"));
for(var i=0; i<uploadedImages.length; i++) savedFiles["image"].push(uploadedImages[i]);
for(var i=0; i<uploadedVideos.length; i++) savedFiles["video"].push(uploadedVideos[i]);
for(var i=0; i<uploadedPdfs.length; i++) savedFiles["pdf"].push(uploadedPdfs[i]);
for(var i=0; i<uploadedApps.length; i++) savedFiles["app"].push(uploadedApps[i]);

var app = express();

app.configure(function(){
	app.use(express.methodOverride());
	app.use(express.bodyParser({uploadDir: uploadsFolder, limit: '250mb'}));
	app.use(express.multipart());
	app.use(express.static(__dirname + path.sep));
	app.use(app.router);
});

var options = {
  key: fs.readFileSync(path.join("keys", "server.key")),
  cert: fs.readFileSync(path.join("keys", "server.crt")),
  ca: fs.readFileSync(path.join("keys", "ca.crt")),
  requestCert: true,
  rejectUnauthorized: false
};

var server = https.createServer(options, app);
var wsioServer = new websocketIOServer(config.port+1);

var itemCount = 0;
var items = [];

var clients = [];
var sagePointers = {};
var remoteInteraction = {};
var mediaStreams = {};

//handle pointer modes
var numberOfPointerModes = 2; //2 modes:  interact with window and interact in window
var ON_WINDOW_MODE = 0;
var IN_WINDOW_MODE = 1; 

wsioServer.onconnection(function(wsio) {
	var address = wsio.remoteAddress.address + ":" + wsio.remoteAddress.port;
	console.log("New Connection: " + address);
	
	wsio.emit('setupDisplayConfiguration', config);
	wsio.emit('initialize', {address: address});
	
	wsio.onclose(function() {
		removeElement(clients, wsio);
	});
	
	wsio.on('addClient', function(data) {
		wsio.clientType = data.clientType;
		if(wsio.clientType == "sageUI"){
			createSagePointer(address);
		}
		else if(wsio.clientType == "display"){
			for(var key in sagePointers){
				wsio.emit('createSagePointer', sagePointers[key]);
			}
		}
		clients.push(wsio);
		
		for(i=0; i<items.length; i++){
			wsio.emit('addNewElement', items[i]);
		}
	});
	
	wsio.on('startSagePointer', function(data) {
		showPointer( address, data );
	});
	
	wsio.on('stopSagePointer', function() {
		hidePointer( address);
	});
	
	wsio.on('pointerPress', function() {
		var pointerX = sagePointers[address].left
		var pointerY = sagePointers[address].top
	
		pointerPress( address, pointerX, pointerY );
	});
	
	wsio.on('pointerRelease', function() {
		var pointerX = sagePointers[address].left
		var pointerY = sagePointers[address].top
		
		pointerRelease( address, pointerX, pointerY );
	});
	
	wsio.on('pointerPosition', function(data) {
		pointerPosition(address, data);
	});
	
	wsio.on('pointerMove', function(data) {
		sagePointers[address].left += data.deltaX;
		sagePointers[address].top += data.deltaY;
		if(sagePointers[address].left < 0) sagePointers[address].left = 0;
		if(sagePointers[address].left > config.totalWidth) sagePointers[address].left = config.totalWidth;
		if(sagePointers[address].top < 0) sagePointers[address].top = 0;
		if(sagePointers[address].top > config.totalHeight) sagePointers[address].top = config.totalHeight;
		
		broadcast('updateSagePointerPosition', sagePointers[address], "display");
		
	    if( remoteInteraction[address].windowManagementMode() ){
            var updatedItem = remoteInteraction[address].moveSelectedItem(sagePointers[address].left, sagePointers[address].top);
            if(updatedItem != null) broadcast('setItemPosition', updatedItem);
		}
        else if ( remoteInteraction[address].appInteractionMode() ) {		
            var pointerX = sagePointers[address].left
            var pointerY = sagePointers[address].top
            
            var elem = findItemUnderPointer(pointerX, pointerY);
 
            if( elem != null ){           
                var itemRelX = pointerX - items[i].left;
                var itemRelY = pointerY - items[i].top - config.titleBarHeight;
                var now = new Date();
                broadcast( 'eventInItem', { eventType: "pointerMove", elemId: elem.id, user_id: sagePointers[address].id, user_label: sagePointers[address].label, user_color: sagePointers[address].color, itemRelativeX: itemRelX, itemRelativeY: itemRelY, data: {}, date: now }, "display");  
            }
		}
	});
	
	wsio.on('pointerScrollStart', function() {
		var pointerX = sagePointers[address].left
		var pointerY = sagePointers[address].top
		
		pointerScrollStart( address, pointerX, pointerY );
	});
	
	wsio.on('pointerScroll', function(data) {
		pointerScroll( address, data );
	});
	
	wsio.on('keyPressed', function(data) {
		if(data.code == "16"){ // shift
			remoteInteraction[address].SHIFT = true;
		}
		else if(data.code == "17"){ // ctrl
			remoteInteraction[address].CTRL = true;
		}
		else if(data.code == "18") { // alt
			remoteInteraction[address].ALT = true;
		}
		else if(data.code == "91" || data.code == "92" || data.code == "93"){ // command
			remoteInteraction[address].CMD = true;
		}
	});
	
	wsio.on('keyReleased', function(data) {
		var pointerX = sagePointers[address].left
		var pointerY = sagePointers[address].top
		var elem = findItemUnderPointer(pointerX, pointerY);
		
		if(data.code == "16"){ // shift
			remoteInteraction[address].SHIFT = false;
		}
		else if(data.code == "17"){ // ctrl
			remoteInteraction[address].CTRL = false;
		}
		else if(data.code == "18") { // alt
			remoteInteraction[address].ALT = false;
		}
		else if(data.code == "20") { // caps lock
			remoteInteraction[address].CAPS = !remoteInteraction[address].CAPS;
		}
		else if(data.code == "91" || data.code == "92" || data.code == "93"){ // command
			remoteInteraction[address].CMD = false;
		}
		
		if(data.code == "9" && (remoteInteraction[address].CTRL)){ // ctrl + tab
			remoteInteraction[address].toggleModes();
			broadcast('changeSagePointerMode', {id: sagePointers[address].id, mode: remoteInteraction[address].interactionMode}, "display");
		}
		
		if(elem != null){
            if( remoteInteraction[address].windowManagementMode() ){
                if(data.code == "8" || data.code == "46"){ // backspace or delete
                    removeElement(items, elem);
                    broadcast('deleteElement', elem.id);
                }
                else{
                    var newOrder = moveItemToFront(elem.id);
                    broadcast('updateItemOrder', newOrder);
                    broadcast('keypressItem', {elemId: elem.id, keyCode: data.code});
                }
            }
            else if ( remoteInteraction[address].appInteractionMode() ) {	
                var itemRelX = pointerX - items[i].left;
                var itemRelY = pointerY - items[i].top - config.titleBarHeight;
                var now = new Date();	
                broadcast( 'eventInItem', { eventType: "keyPressed", elemId: elem.id, user_id: sagePointers[address].id, user_label: sagePointers[address].label, user_color: sagePointers[address].color, itemRelativeX: itemRelX, itemRelativeY: itemRelY, data: {code: data.code, key: String.fromCharCode(data.code).toLowerCase() }, date: now }, "display");  
            }
            
		}
	});
	
	wsio.on('requestStoredFiles', function() {
		wsio.emit('storedFileList', savedFiles);
	});
	
	wsio.on('updateVideoTime', function(video_data) {
		broadcast('updateVideoItemTime', video_data, "display");
	});
	
	wsio.on('startNewMediaStream', function(data) {
		mediaStreams[data.id] = {};
		for(var i=0; i<clients.length; i++){
			if(clients[i].clientType == "display"){
				var clientAddress = clients[i].remoteAddress.address + ":" + clients[i].remoteAddress.port;
				mediaStreams[data.id][clientAddress] = false;
			}
		}
		
		loader.loadScreenCapture(data.src, data.id, data.title, data.width, data.height, function(newItem) {
			broadcast('addNewElement', newItem);
			
			items.push(newItem);
			itemCount++;
		});
	});
	
	wsio.on('updateMediaStreamFrame', function(data) {
		for(var key in mediaStreams[data.id]){
			mediaStreams[data.id][key] = false;
		}
		
		broadcast('updateMediaStreamFrame', data, "display");
	});
	
	wsio.on('receivedMediaStreamFrame', function(data) {
		mediaStreams[data.id][address] = true;
		
		if(allTrueDict(mediaStreams[data.id])){
			var broadcastWS;
			for(i=0; i<clients.length; i++){
				var clientAddress = clients[i].remoteAddress.address + ":" + clients[i].remoteAddress.port;
				if(clientAddress == data.id) broadcastWS = clients[i];
			}
			
			if(broadcastWS != null) broadcastWS.emit('requestNextFrame', null);
		}
	});
	
	wsio.on('addNewWebElement', function(data) {
		if(data.type == "img"){
			request({url: data.src, encoding: null}, function(err, response, body) {
				if(err) throw err;
				
				loader.loadImage(body, "item"+itemCount.toString(), data.src.substring(data.src.lastIndexOf("/")+1), function(newItem) {
					broadcast('addNewElement', newItem);
				
					items.push(newItem);
					itemCount++;
				});
			});
		}
		else if(data.type == "video"){
			loader.loadVideo(data.src, "item"+itemCount.toString(), data.src.substring(data.src.lastIndexOf("/")+1), function(newItem) {
				broadcast('addNewElement', newItem);
			
				items.push(newItem);
				itemCount++;
			});
		}
		else if(data.type == "youtube"){
			loader.loadYoutube(data.src, "item"+itemCount.toString(), function(newItem) {
				broadcast('addNewElement', newItem);
			
				items.push(newItem);
				itemCount++;
			});
		}
		else if(data.type == "pdf"){
			request({url: data.src, encoding: null}, function(err, response, body) {
				if(err) throw err;
				
				loader.loadPdf(body, "item"+itemCount.toString(), data.src.substring(data.src.lastIndexOf("/")+1), function(newItem) {
					broadcast('addNewElement', newItem);
				
					items.push(newItem);
					itemCount++;
				});
			});
		}
	});
	
	wsio.on('addNewElementFromStoredFiles', function(file) {
		if(file.dir == "images"){
			var localPath = path.join("uploads", file.dir, file.name);
			
			fs.readFile(localPath, function (err, data) {
				if(err) throw err;
				
				loader.loadImage(data, "item"+itemCount.toString(), path.basename(localPath), function(newItem) {
					broadcast('addNewElement', newItem);
			
					items.push(newItem);
					itemCount++;
				});
			});
		}
		else if(file.dir == "videos"){
			var localPath = path.join("uploads", file.dir, file.name);
			
			loader.loadVideo(localPath, "item"+itemCount.toString(), path.basename(localPath), function(newItem) {
				broadcast('addNewElement', newItem);
		
				items.push(newItem);
				itemCount++;
			});
		}
		else if(file.dir == "pdfs"){
			var localPath = path.join("uploads", file.dir, file.name);
			
			fs.readFile(localPath, function (err, data) {
				if(err) throw err;
				
				loader.loadPdf(data, "item"+itemCount.toString(), path.basename(localPath), function(newItem) {
					broadcast('addNewElement', newItem);
			
					items.push(newItem);
					itemCount++;
				});
			});
		}
		else if(file.dir == "apps"){
			var localPath = path.join("uploads", file.dir, file.name);
			
			console.log(localPath);
			var id = "item"+itemCount.toString();
			loader.loadApp(localPath, id, function(newItem, instructions) {
				// add resource scripts to clients
				for(var i=0; i<instructions.resources.length; i++){
					if(instructions.resources[i].type == "script"){
						broadcast('addScript', path.join(zipFolder, instructions.resources[i].src));
					}
				}
	
				// add item to clients (after waiting 1 second to ensure resources have loaded)
				setTimeout(function() {
					broadcast('addNewElement', newItem);
					
					items.push(newItem);
					itemCount++;

					// set interval timer if specified
					if(instructions.animation == "timer"){
						setInterval(function() {
							var now = new Date();
							broadcast('animateCanvas', {elemId: id, type: instructions.type, date: now});
						}, instructions.interval);
					}
				}, 1000);
			});
		}
	});
});

app.post('/upload', function(request, response) {
	var fileKeys = Object.keys(request.files);
	fileKeys.forEach(function(key) {
		var uploadPath = path.dirname(request.files[key].path);
		
		if(request.files[key].type == "image/jpeg" || request.files[key].type == "image/png"){
			var finalPath = path.join(uploadPath, "images", request.files[key].name);
			var localPath = finalPath.substring(__dirname.length+1);
			fs.rename(request.files[key].path, finalPath, function(err) {
				if(err) throw err;
				
				fs.readFile(localPath, function (err, data) {
					if(err) throw err;
					
					loader.loadImage(data, "item"+itemCount.toString(), path.basename(localPath), function(newItem) {
						broadcast('addNewElement', newItem);
				
						items.push(newItem);
						itemCount++;
				
						var file = path.basename(localPath);
						if(savedFiles["image"].indexOf(file) < 0) savedFiles["image"].push(file);
					});
				});
			});
		}
		else if(request.files[key].type == "video/mp4"){
			var finalPath = path.join(uploadPath, "videos", request.files[key].name);
			var localPath = finalPath.substring(__dirname.length+1);
			fs.rename(request.files[key].path, finalPath, function(err) {
				if(err) throw err;
				
				loader.loadVideo(localPath, "item"+itemCount.toString(), path.basename(localPath), function(newItem) {
					broadcast('addNewElement', newItem);
			
					items.push(newItem);
					itemCount++;
				
					var file = path.basename(localPath);
					if(savedFiles["video"].indexOf(file) < 0) savedFiles["video"].push(file);
				});
			});
		}
		else if(request.files[key].type == "application/pdf"){
			var finalPath = path.join(uploadPath, "pdfs", request.files[key].name);
			var localPath = finalPath.substring(__dirname.length+1);
			fs.rename(request.files[key].path, finalPath, function(err) {
				if(err) throw err;
				
				fs.readFile(finalPath, function (err, data) {
					if(err) throw err;
					
					loader.loadPdf(data, "item"+itemCount.toString(), path.basename(localPath), function(newItem) {
						broadcast('addNewElement', newItem);
				
						items.push(newItem);
						itemCount++;
						
						var file = path.basename(localPath);
						if(savedFiles["pdf"].indexOf(file) < 0) savedFiles["pdf"].push(file);
					});
				});
			});
		}
		else if(request.files[key].type == "application/zip"){
			var finalPath = path.join(uploadPath, "apps", request.files[key].name);
			var localPath = finalPath.substring(__dirname.length+1);
			fs.rename(request.files[key].path, finalPath, function(err) {
				if(err) throw err;
				
				var id = "item"+itemCount.toString();
				loader.loadZipApp(localPath, id, function(newItem, instructions) {
					// add resource scripts to clients
					for(var i=0; i<instructions.resources.length; i++){
						if(instructions.resources[i].type == "script"){
							broadcast('addScript', path.join(zipFolder, instructions.resources[i].src));
						}
					}
		
					// add item to clients (after waiting 1 second to ensure resources have loaded)
					setTimeout(function() {
						broadcast('addNewElement', newItem);
						
						items.push(newItem);
						itemCount++;
	
						// set interval timer if specified
						if(instructions.animation == "timer"){
							setInterval(function() {
								var now = new Date();
								broadcast('animateCanvas', {elemId: id, type: instructions.type, date: now});
							}, instructions.interval);
						}
					}, 1000);
					
					var file = path.basename(localPath, path.extname(localPath));
					if(savedFiles["app"].indexOf(file) < 0) savedFiles["app"].push(file);
				});
			});
		}
	});
});

/******** Omicron section *****************************************************************/
var net = require('net');
var util = require('util');
var dgram = require('dgram');

udp = undefined;
	
trackerIP = config.omicronServerIP;
msgPort = config.omicronMsgPort;
dataPort = config.omicronDataPort;
	
if( config.omicronServerIP )
{
	if( msgPort == undefined )
	{
		msgPort = 28000;
		console.log('Omicron: msgPort undefined. Using default: ', msgPort);
	}
	if( dataPort == undefined )	
	{
		dataPort = 9123;
		console.log('Omicron: dataPort undefined. Using default: ', dataPort);
	}
	
	console.log('Connecting to Omicron server: ', trackerIP, msgPort);
	
	var client = net.connect(msgPort, trackerIP,  function()
	{ //'connect' listener
		console.log('Connected to Omicron server. Requesting data on port ', dataPort);
		
		var sendbuf = util.format("omicron_data_on,%d", dataPort);
		//console.log("Omicron> Sending handshake: ", sendbuf);
		client.write(sendbuf);

		udp = dgram.createSocket("udp4");
		var dstart = Date.now();
		var emit = 0;

		// array to hold all the button values (1 - down, 0 = up)
		var buttons = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
		var mouse   = [0, 0, 0];
		var mousexy = [0.0, 0.0];
		var colorpt = [0.0, 0.0, 0.0];
		var mousez  = 0;

		udp.on("message", function (msg, rinfo)
		{
			//console.log("UDP> got: " + msg + " from " + rinfo.address + ":" + rinfo.port);
			// var out = util.format("UDP> msg from [%s:%d] %d bytes", rinfo.address,rinfo.port,msg.length);
			// console.log(out);
		 
			if ((Date.now() - dstart) > 100)
			{
				var offset = 0;
				var e = {};
				if (offset < msg.length) e.timestamp = msg.readUInt32LE(offset); offset += 4;
				if (offset < msg.length) e.sourceId = msg.readUInt32LE(offset); offset += 4;
				if (offset < msg.length) e.serviceId = msg.readInt32LE(offset); offset += 4;
				if (offset < msg.length) e.serviceType = msg.readUInt32LE(offset); offset += 4;
				if (offset < msg.length) e.type = msg.readUInt32LE(offset); offset += 4;
				if (offset < msg.length) e.flags = msg.readUInt32LE(offset); offset += 4;

				if (offset < msg.length) e.posx = msg.readFloatLE(offset); offset += 4;
				if (offset < msg.length) e.posy = msg.readFloatLE(offset); offset += 4;
				if (offset < msg.length) e.posz = msg.readFloatLE(offset); offset += 4;
				if (offset < msg.length) e.orw = msg.readFloatLE(offset); offset += 4;
				if (offset < msg.length) e.orx = msg.readFloatLE(offset); offset += 4;
				if (offset < msg.length) e.ory = msg.readFloatLE(offset); offset += 4;
				if (offset < msg.length) e.orz = msg.readFloatLE(offset); offset += 4;
				if (offset < msg.length) e.extraDataType = msg.readUInt32LE(offset); offset += 4;
				if (offset < msg.length) e.extraDataItems = msg.readUInt32LE(offset); offset += 4;
				if (offset < msg.length) e.extraDataMask = msg.readUInt32LE(offset); offset += 4;

				// Extra data types:
				//    0 ExtraDataNull,
				//    1 ExtraDataFloatArray,
				//    2 ExtraDataIntArray,
				//    3 ExtraDataVector3Array,
				//    4 ExtraDataString,
				//    5 ExtraDataKinectSpeech

				var r_roll  = Math.asin(2.0*e.orx*e.ory + 2.0*e.orz*e.orw);
				var r_yaw   = Math.atan2(2.0*e.ory*e.orw-2.0*e.orx*e.orz , 1.0 - 2.0*e.ory*e.ory - 2.0*e.orz*e.orz);
				var r_pitch = Math.atan2(2.0*e.orx*e.orw-2.0*e.ory*e.orz , 1.0 - 2.0*e.orx*e.orx - 2.0*e.orz*e.orz);
						
				var posX = e.posx * config.totalWidth;
				var posY = e.posy*config.totalHeight;
				var sourceID = e.sourceId;

				// serviceID: 0 = touch, 1 = SAGEPointer (note this depends on the order the services are specified on the server)
				var serviceID = e.serviceId;
						
				var touchWidth = 0;
				var touchHeight = 0;
				if( serviceID == 0 &&  e.extraDataItems >= 2)
				{
					touchWidth = msg.readFloatLE(offset); offset += 4;
					touchHeight = msg.readFloatLE(offset); offset += 4;
					//console.log("Touch size: " + touchWidth + "," + touchHeight); 
				}
						
				// Appending sourceID to pointer address ID
				var address = trackerIP+":"+sourceID;
				
				// ServiceTypePointer //////////////////////////////////////////////////
				if (e.serviceType == 0)
				{  
					//console.log("pointer ID "+ sourceID +" event! type: " + e.type  );
					//console.log("pointer event! type: " + e.type  );
					//console.log("ServiceTypePointer> source ", e.sourceId);
					//console.log("ServiceTypePointer> serviceID ", e.serviceId);
								
					// TouchGestureManager Flags:
					// 1 << 17 = User flag start (as of 12/20/13)
					// User << 1 = Unprocessed
					// User << 2 = Single touch
					// User << 3 = Big touch
					// User << 4 = 5-finger hold
					// User << 5 = 5-finger swipe
					// User << 6 = 3-finger hold
					var User = 1 << 17;
					
					var FLAG_SINGLE_TOUCH = User << 2;
					var FLAG_BIG_TOUCH = User << 3;
					var FLAG_FIVE_FINGER_HOLD = User << 4;
					var FLAG_FIVE_FINGER_SWIPE = User << 5;
					var FLAG_THREE_FINGER_HOLD = User << 6;
					var FLAG_SINGLE_CLICK = User << 7;
					var FLAG_DOUBLE_CLICK = User << 8;
					
					//console.log( e.flags );
					if (e.type == 3)
					{ // update (Used only by classic SAGE pointer)
						/* if( e.sourceId in ptrs )
							 return;
						colorpt = [Math.floor(e.posx*255.0), Math.floor(e.posy*255.0), Math.floor(e.posz*255.0)];
						if (offset < msg.length)
						{
							if (e.extraDataType == 4 && e.extraDataItems > 0)
							{
								console.log("create touch pointer"); 
								e.extraString = msg.toString("utf-8", offset, offset+e.extraDataItems);
								ptrinfo = e.extraString.split(" ");
								offset += e.extraDataItems;
								ptrs[e.sourceId] = {id:e.sourceId, label:ptrinfo[0], ip:ptrinfo[1], mouse:[0,0,0], color:colorpt, zoom:0, position:[0,0], mode:0};
								sio.sockets.emit('createPointer', {type: 'ptr', id: e.sourceId, label: ptrinfo[0], color: colorpt, zoom:0, position:[0,0], src: "resources/mouse-pointer-hi.png" });
							}
						}*/
					}
					else if (e.type == 4)
					{ // move
						if( e.flags == FLAG_SINGLE_TOUCH )
						{
							pointerPosition( address, { pointerX: posX, pointerY: posY } );
		
						}
					}
					else if (e.type == 15)
					{ // zoom
						console.log("Touch zoom");
								
						/*
						Omicron zoom event extra data:
						0 = touchWidth (parsed above)
						1 = touchHeight (parsed above)
						2  = zoom delta
						3 = event second type ( 1 = Down, 2 = Move, 3 = Up )
						*/
						// extraDataType 1 = float
						if (e.extraDataType == 1 && e.extraDataItems >= 4)
						{

							var zoomDelta = msg.readFloatLE(offset); offset += 4;
							var eventType = msg.readFloatLE(offset);  offset += 4;
							console.log( zoomDelta ); 
							
							if( eventType == 1 ) // Zoom start/down
							{
								pointerScrollStart( address, posX, posY );
							}
							else // Zoom move
							{
								pointerScroll( address, { scale: 1+zoomDelta } );
							}
						}

					}
					else if (e.type == 5) { // button down
						//console.log("\t down , flags ", e.flags);
						
						if( e.flags == FLAG_SINGLE_TOUCH )
						{
							console.log("starting pointer: " + address)
							// Create pointer
							if(address in sagePointers){
								showPointer( address, { label:  "Touch: " + sourceID, color: "rgba(255, 255, 255, 1.0)" } );
							}else{
								createSagePointer(address);
								
								showPointer( address, { label:  "Touch: " + sourceID, color: "rgba(255, 255, 255, 1.0)" } );
								
								pointerPress( address, posX, posY );
							}
						}
						else if( e.flags == FLAG_FIVE_FINGER_HOLD )
						{
							console.log("Touch gesture: Five finger hold");
							
							var elem = findItemUnderPointer(posX, posY);
							
							// Remove element
							if( elem != null && remoteInteraction[address].windowManagementMode() )
							{
								removeElement(items, elem);
								broadcast('deleteElement', elem.id);
							}
						}
						else if( e.flags == FLAG_THREE_FINGER_HOLD )
						{
							console.log("Touch gesture: Three finger hold");
						}
						else if( e.flags == FLAG_SINGLE_CLICK )
						{
							console.log("Touch gesture: Click");
						}
						else if( e.flags == FLAG_DOUBLE_CLICK )
						{
							console.log("Touch gesture: Double Click");
						}
					}
					else if (e.type == 6)
					{ // button up
						if( e.flags == FLAG_SINGLE_TOUCH )
						{
							// Hide pointer
							hidePointer(address);
							
							// Release event
							pointerRelease(address, posX, posY);
							
							console.log("Touch release");
						}
					}
					else
					{
					console.log("\t UNKNOWN event type ", e.type);                                        
					}

					if (emit>2) { dstart = Date.now(); emit = 0; }
				}// ServiceTypePointer ends ///////////////////////////////////////////
			}
		});

		udp.on("listening", function () {
			var address = udp.address();
			console.log("UDP> listening " + address.address + ":" + address.port);
		});
								
		udp.bind(dataPort)
		
	});
}
/***************************************************************************************/

// Start the https server
server.listen(config.port);

console.log('Now serving the app at https://localhost:' + config.port);


/***************************************************************************************/

function broadcast(func, data, type) {
	for(var i=0; i<clients.length; i++){
		if(type == null || type == clients[i].clientType) clients[i].emit(func, data);
	}
}

function findItemUnderPointer(pointerX, pointerY) {
	for(var i=items.length-1; i>=0; i--){
		if(pointerX >= items[i].left && pointerX <= (items[i].left+items[i].width) && pointerY >= items[i].top && pointerY <= (items[i].top+items[i].height+config.titleBarHeight)){
			return items[i];
		}
	}
	return null;
}

function moveItemToFront(id) {
	var selectedIndex;
	var selectedItem;
	var itemIds = [];
	
	for(var i=0; i<items.length; i++){
		if(items[i].id == id){
			selectedIndex = i;
			selectedItem = items[selectedIndex];
			break;
		}
		itemIds.push(items[i].id);
	}
	for(var i=selectedIndex; i<items.length-1; i++){
		items[i] = items[i+1];
		itemIds.push(items[i].id);
	}
	items[items.length-1] = selectedItem;
	itemIds.push(id);
	
	return itemIds;
}

function moveItemToBack(id) {
	var selectedIndex;
	var selectedItem;
	var itemIds = [];
	
	for(var i=0; i<items.length; i++){
		if(items[i].id == id){
			selectedIndex = i;
			selectedItem = items[selectedIndex];
			itemIds.push(id);
			break;
		}
	}
	for(var i=0; i<selectedIndex; i++){
		items[i] = items[i+1];
		itemIds.push(items[i].id);
	}
	for(var i=selectedIndex+1; i<items.length; i++){
		items[i] = items[i];
		itemIds.push(items[i].id);
	}
	items[0] = selectedItem;
	
	return itemIds;
}

function allTrueDict(dict) {
	for(key in dict){
		if(dict[key] == false) return false;
	}
	return true;
}

function removeElement(list, elem) {
	if(list.indexOf(elem) >= 0){
		moveElementToEnd(list, elem);
		list.pop();
	}
}

function moveElementToEnd(list, elem) {
	var pos = list.indexOf(elem);
	for(var i=pos; i<list.length-1; i++){
		list[i] = list[i+1];
	}
	list[list.length-1] = elem;
}

/**** Pointer Functions ********************************************************************/

function createSagePointer( address ) {
	sagePointers[address] = new sagepointer(address+"_pointer");
	remoteInteraction[address] = new interaction();
					
	broadcast('createSagePointer', sagePointers[address], "display");
}

function showPointer( address, data ) {
	if( sagePointers[address] == undefined )
		return;
		
	console.log("starting pointer: " + address);
		
	sagePointers[address].start(data.label, data.color);
	broadcast('showSagePointer', sagePointers[address], "display");
}

function hidePointer( address ) {
	if( sagePointers[address] == undefined )
		return;
		
	sagePointers[address].stop;
	broadcast('hideSagePointer', sagePointers[address], "display");
}

function pointerPress( address, pointerX, pointerY ) {
	if( sagePointers[address] == undefined )
		return;
		
    var elem = findItemUnderPointer(pointerX, pointerY);
		
	if(elem != null){
        if( remoteInteraction[address].windowManagementMode() ){
            remoteInteraction[address].selectMoveItem(elem, pointerX, pointerY); //will only go through if window management mode 
        }
        else if ( remoteInteraction[address].appInteractionMode() ) {
            var itemRelX = pointerX - items[i].left;
			var itemRelY = pointerY - items[i].top - config.titleBarHeight;
			var now = new Date();
			broadcast( 'eventInItem', { eventType: "pointerPress", elemId: elem.id, user_id: sagePointers[address].id, user_label: sagePointers[address].label, user_color: sagePointers[address].color, itemRelativeX: itemRelX, itemRelativeY: itemRelY, data: {button: "left"}, date: now }, "display");  
        }        
            
		var newOrder = moveItemToFront(elem.id);
		broadcast('updateItemOrder', newOrder);
	} 
	else { //if no item, change pointer mode
		remoteInteraction[address].toggleModes(); 
		broadcast('changeSagePointerMode', {id: sagePointers[address].id, mode: remoteInteraction[address].interactionMode } , 'display' ); 
	}
}

// Copied from pointerPress. Eventually a touch gesture will use this to toggle modes
function togglePointerMode(address) {
	if( sagePointers[address] == undefined )
		return;
		
	remoteInteraction[address].toggleModes(); 
	broadcast('changeSagePointerMode', {id: sagePointers[address].id, mode: remoteInteraction[address].interactionMode } , 'display' ); 
}

function pointerRelease(address, pointerX, pointerY) {
	if( sagePointers[address] == undefined )
		return;
		
	if( remoteInteraction[address].windowManagementMode() ){
        remoteInteraction[address].releaseItem();

	}
	else if ( remoteInteraction[address].appInteractionMode() ) {
        var pointerX = sagePointers[address].left
        var pointerY = sagePointers[address].top
        
        var elem = findItemUnderPointer(pointerX, pointerY);
 
		if( elem != null ){           
            var itemRelX = pointerX - items[i].left;
            var itemRelY = pointerY - items[i].top - config.titleBarHeight;
            var now = new Date();
            broadcast( 'eventInItem', { eventType: "pointerRelease", elemId: elem.id, user_id: sagePointers[address].id, user_label: sagePointers[address].label, user_color: sagePointers[address].color, itemRelativeX: itemRelX, itemRelativeY: itemRelY, data: {button: "left"}, date: now }, "display");  
         }
	}
}

function pointerPosition( address, data ) {
	if( sagePointers[address] == undefined )
		return;
		
	sagePointers[address].left = data.pointerX;
	sagePointers[address].top = data.pointerY;
	if(sagePointers[address].left < 0) sagePointers[address].left = 0;
	if(sagePointers[address].left > config.totalWidth) sagePointers[address].left = config.totalWidth;
	if(sagePointers[address].top < 0) sagePointers[address].top = 0;
	if(sagePointers[address].top > config.totalHeight) sagePointers[address].top = config.totalHeight;
		
	broadcast('updateSagePointerPosition', sagePointers[address], "display");
	
	var updatedItem = remoteInteraction[address].moveSelectedItem(sagePointers[address].left, sagePointers[address].top);
	if(updatedItem != null) broadcast('setItemPosition', updatedItem);
}

function pointerScrollStart( address, pointerX, pointerY ) {
	if( sagePointers[address] == undefined )
		return;
		
	var elem = findItemUnderPointer(pointerX, pointerY);
		
	if(elem != null){
		remoteInteraction[address].selectScrollItem(elem, pointerX, pointerY);
		var newOrder = moveItemToFront(elem.id);
		broadcast('updateItemOrder', newOrder);
	}
}

function pointerScroll( address, data ) {
	if( sagePointers[address] == undefined )
		return;
		
	var updatedItem = remoteInteraction[address].scrollSelectedItem(data.scale);
	if(updatedItem != null){
		broadcast('setItemPositionAndSize', updatedItem);
		
		if(updatedItem.elemId in remoteInteraction[address].selectTimeId){
			clearTimeout(remoteInteraction[address].selectTimeId[updatedItem.elemId]);
		}
		
		remoteInteraction[address].selectTimeId[updatedItem.elemId] = setTimeout(function() {
			broadcast('finishedResize', {id: updatedItem.elemId}, "display");
			remoteInteraction[address].selectedScrollItem = null;
		}, 500);
	}
}