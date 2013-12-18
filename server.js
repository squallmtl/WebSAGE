var express = require("express");
var http = require('http');
var request = require('request');
var fs = require('fs');
var path = require('path');
//var pdfutils = require('pdfutils').pdfutils;
var decompresszip = require('decompress-zip');
var gm = require('gm');
var imageinfo = require('imageinfo');
var ffprobe = require('node-ffprobe');
var ytdl = require('ytdl');

var app = express();
var hport = 9090;

var uploadsFolder = __dirname + "/uploads";

app.configure(function(){
	app.use(express.methodOverride());
	app.use(express.bodyParser({uploadDir: uploadsFolder, limit: '250mb'}));
	app.use(express.multipart());
	app.use(express.static(__dirname + '/'));
	app.use(app.router);
});

var server = http.createServer(app);

// ---------------------------------------------
// Setup the websocket
// ---------------------------------------------
// To talk to the web clients
var io = require('socket.io');

var sio = io.listen(server);

sio.configure(function () {
	sio.set('transports', ['websocket']);
	sio.set('log level', 0);
});

sio.configure('development', function () {
	sio.set('transports', ['websocket' ]);
	sio.disable('log');
});

var initDate = new Date();

var file = 'config/desktop-cfg.json';
//var file = 'config/thor-cfg.json';
//var file = 'config/iridium-cfg.json';
//var file = 'config/iridiumX-cfg.json';
//var file = 'config/lyra-cfg.json';
var config;
fs.readFile(file, 'utf8', function(err, json_str) {
	if(err){
		console.log('Error: ' + err);
		return;
	}
	config = JSON.parse(json_str);
	config.totalWidth = config.resolution.width * config.layout.columns;
	config.totalHeight = config.resolution.height * config.layout.rows;
	config.titleBarHeight = Math.round(0.025 * config.totalHeight);
	config.titleTextSize = Math.round(0.015 * config.totalHeight);
	config.pointerWidth = Math.round(0.20 * config.totalHeight);
	config.pointerHeight = Math.round(0.05 * config.totalHeight);
	console.log(config);
});

var itemCount = 0;
var items = [];
var pointerCount = 0;
var sagePointers = {};
var interaction = {};

sio.sockets.on('connection', function(socket) {
	var i;
	var address = socket.handshake.address.address;
	var port = socket.handshake.address.port;
	console.log("New connection from " + address + ":" + port);
	
	interaction[address] = {selectedMoveItem: null, selectedScrollItem: null, selectOffsetX: 0, selectOffsetY: 0, selectTimeId: {}};
	
	var cDate = new Date();

	console.log(cDate.getTime()-initDate.getTime());
	socket.emit('setSystemTime', cDate.getTime()-initDate.getTime());
	socket.emit('setupDisplayConfiguration', config);

	/* adding new elements */
	for(var key in sagePointers){
		sio.sockets.emit('createPointer', sagePointers[key]);
	}
	for(i=0; i<items.length; i++){
		socket.emit('addNewElement', items[i]);
	}
	
	socket.on('startSagePointer', function(pointer_data) {
		console.log("starting pointer: " + address)
		if(address in sagePointers){
			sagePointers[address].label = pointer_data.label;
			sagePointers[address].color = pointer_data.color;
			sagePointers[address].left = 0;
			sagePointers[address].top = 0;
			sio.sockets.emit('showPointer', sagePointers[address]);
		}
		else{
			sagePointers[address] = {id: "pointer"+pointerCount.toString(), left: 0, top: 0, label: pointer_data.label, color: pointer_data.color};
			pointerCount++;
			sio.sockets.emit('createPointer', sagePointers[address]);
		}
	});
	
	socket.on('stopSagePointer', function(pointer_data) {
		sio.sockets.emit('hidePointer', sagePointers[address]);
	});
	
	socket.on('addNewWebElement', function(elem_data) {
		if(elem_data.type == "img"){
			request({url:elem_data.src, encoding:null}, function(err, response, body) {
				if(err) throw err;
				
				console.log(elem_data.src);
				var info = imageinfo(body);
				var itemId = "item"+itemCount.toString();
				var title = elem_data.src.substring(elem_data.src.lastIndexOf("/")+1);
				var source = "data:" + info.mimeType + ";base64, " + body.toString("base64");
				var aspect = info.width / info.height;
				var now = new Date();
				var newItem = new item("img", title, itemId, source, 0, 0, info.width, info.height, aspect, now, null, null);
				items.push(newItem);
				sio.sockets.emit('addNewElement', newItem);
				itemCount++;
			});
		}
		else if(elem_data.type == "youtube"){
			ytdl.getInfo(elem_data.src, function(err, info){
				if(err) throw err;
				
				console.log(info.title);
				var mp4Idx = -1;
				var mp4Resolution = 0;
				for(i=0; i<info.formats.length; i++){
					if(info.formats[i].container == "mp4"){
						var res = parseInt(info.formats[i].resolution.substring(0, info.formats[i].resolution.length-1));
						if(res > mp4Resolution){
							mp4Idx = i;
							mp4Resolution = res;
						}
					}
				}
				console.log("mp4 resolution:  " + mp4Resolution);
				
				var itemId = "item"+itemCount.toString();
				var title = info.title;
				var aspect = 16/9;
				var now = new Date();
				var resolutionY = mp4Resolution;
				var resolutionX = resolutionY * aspect;
				var poster = info.iurlmaxres;
				if(poster == null) poster = info.iurl;
				if(poster == null) poster = info.iurlsd;
				var newItem = new item("youtube", title, itemId, info.formats[mp4Idx].url, 0, 0, resolutionX, resolutionY, aspect, now, poster, null);
				items.push(newItem);
				sio.sockets.emit('addNewElement', newItem);
				itemCount++;
			});
		}
	});

	socket.on('selectElementById', function(select_data) {
		interaction[address].selectedMoveItem = findItemById(select_data.elemId);
		interaction[address].selectedScrollItem = null;
		interaction[address].selectOffsetX = select_data.eventOffsetX;
		interaction[address].selectOffsetY = select_data.eventOffsetY;
		
		var newOrder = moveItemToFront(interaction[address].selectedMoveItem.id);
		sio.sockets.emit('updateItemOrder', newOrder);
	});
	
	socket.on('selectElementWithPointer', function() {
		var pointerX = sagePointers[address].left
		var pointerY = sagePointers[address].top
		
		for(var i=items.length-1; i>=0; i--){
			if(pointerX >= items[i].left && pointerX <= (items[i].left+items[i].width) && pointerY >= items[i].top && pointerY <= (items[i].top+items[i].height)){
				interaction[address].selectedMoveItem = findItemById(items[i].id);
				interaction[address].selectedScrollItem = null;
				interaction[address].selectOffsetX = items[i].left - pointerX;
				interaction[address].selectOffsetY = items[i].top - pointerY;
				break;
			}
		}
		
		if(interaction[address].selectedMoveItem != null){
			var newOrder = moveItemToFront(interaction[address].selectedMoveItem.id);
			sio.sockets.emit('updateItemOrder', newOrder);
		}
	});
	
	socket.on('releaseSelectedElement', function() {
		interaction[address].selectedMoveItem = null;
		interaction[address].selectedScrollItem = null;
	});
	
	socket.on('moveSelectedElement', function(move_data) {
		if(interaction[address].selectedMoveItem == null) return;
		interaction[address].selectedMoveItem.left = move_data.eventX + interaction[address].selectOffsetX;
		interaction[address].selectedMoveItem.top = move_data.eventY + interaction[address].selectOffsetY;
		var now = new Date();
		sio.sockets.emit('setItemPosition', {elemId: interaction[address].selectedMoveItem.id, elemLeft: interaction[address].selectedMoveItem.left, elemTop: interaction[address].selectedMoveItem.top, elemWidth: interaction[address].selectedMoveItem.width, elemHeight: interaction[address].selectedMoveItem.height, date: now});
	});
	
	socket.on('moveSagePointer', function(pointer_data) {
		sagePointers[address].left += pointer_data.deltaX;
		sagePointers[address].top += pointer_data.deltaY;
		if(sagePointers[address].left < 0) sagePointers[address].left = 0;
		if(sagePointers[address].left > config.totalWidth) sagePointers[address].left = config.totalWidth;
		if(sagePointers[address].top < 0) sagePointers[address].top = 0;
		if(sagePointers[address].top > config.totalHeight) sagePointers[address].top = config.totalHeight;
		
		sio.sockets.emit('updatePointer', sagePointers[address]);
		
		if(interaction[address].selectedMoveItem == null) return;
		interaction[address].selectedMoveItem.left = sagePointers[address].left + interaction[address].selectOffsetX;
		interaction[address].selectedMoveItem.top = sagePointers[address].top + interaction[address].selectOffsetY;
		var now = new Date();
		sio.sockets.emit('setItemPosition', {elemId: interaction[address].selectedMoveItem.id, elemLeft: interaction[address].selectedMoveItem.left, elemTop: interaction[address].selectedMoveItem.top, elemWidth: interaction[address].selectedMoveItem.width, elemHeight: interaction[address].selectedMoveItem.height, date: now});
	});
	
	socket.on('selectScrollElementById', function(elemId) {
		interaction[address].selectedScrollItem = findItemById(elemId);
		interaction[address].selectedMoveItem = null;
		
		var newOrder = moveItemToFront(interaction[address].selectedScrollItem.id);
		sio.sockets.emit('updateItemOrder', newOrder);
	});
	
	socket.on('selectScrollElementWithPointer', function() {
		var pointerX = sagePointers[address].left
		var pointerY = sagePointers[address].top
		
		for(var i=items.length-1; i>=0; i--){
			if(pointerX >= items[i].left && pointerX <= (items[i].left+items[i].width) && pointerY >= items[i].top && pointerY <= (items[i].top+items[i].height)){
				interaction[address].selectedScrollItem = findItemById(items[i].id);
				interaction[address].selectedMoveItem = null;
				break;
			}
		}
		
		if(interaction[address].selectedScrollItem != null){
			var newOrder = moveItemToFront(interaction[address].selectedScrollItem.id);
			sio.sockets.emit('updateItemOrder', newOrder);
		}
	});
	
	socket.on('scrollSelectedElement', function(scale) {
		if(interaction[address].selectedScrollItem == null) return;
		var iWidth = interaction[address].selectedScrollItem.width * scale;
		var iHeight = iWidth / interaction[address].selectedScrollItem.aspect;
		if(iWidth < 20){ iWidth = 20; iHeight = iWidth/interaction[address].selectedScrollItem.aspect; }
		if(iHeight < 20){ iHeight = 20; iWidth = iHeight*interaction[address].selectedScrollItem.aspect; }
		var iCenterX = interaction[address].selectedScrollItem.left + (interaction[address].selectedScrollItem.width/2);
		var iCenterY = interaction[address].selectedScrollItem.top + (interaction[address].selectedScrollItem.height/2);
		interaction[address].selectedScrollItem.left = iCenterX - (iWidth/2);
		interaction[address].selectedScrollItem.top = iCenterY - (iHeight/2);
		interaction[address].selectedScrollItem.width = iWidth;
		interaction[address].selectedScrollItem.height = iHeight;
		var now = new Date();
		sio.sockets.emit('setItemPositionAndSize', {elemId: interaction[address].selectedScrollItem.id, elemLeft: interaction[address].selectedScrollItem.left, elemTop: interaction[address].selectedScrollItem.top, elemWidth: interaction[address].selectedScrollItem.width, elemHeight: interaction[address].selectedScrollItem.height, date: now});
		
		var elemId = interaction[address].selectedScrollItem.id;
		if(elemId in interaction[address].selectTimeId) clearTimeout(interaction[address].selectTimeId[elemId]);
		
		interaction[address].selectTimeId[elemId] = setTimeout(function() {
			sio.sockets.emit('finishedResize', elemId);
			interaction[address].selectedScrollItem = null;
		}, 500);
	});
	
	socket.on('keypressElementById', function(keypress_data) {
		if(keypress_data.keyCode == "8" || keypress_data.keyCode == "46"){ // backspace or delete
			removeItemById(keypress_data.elemId);
			sio.sockets.emit('deleteElement', keypress_data.elemId);
		}
		else{
			var keypressItem = findItemById(keypress_data.elemId);
			var newOrder = moveItemToFront(keypressItem.id);
			sio.sockets.emit('updateItemOrder', newOrder);
			sio.sockets.emit('keypressItem', keypress_data);
		}
	});
	
	socket.on('updateVideoTime', function(video_data) {
		sio.sockets.emit('updateVideoItemTime', video_data);
	});
});

app.post('/upload', function(request, response) {
	var fileKeys = Object.keys(request.files);
	fileKeys.forEach(function(key) {
		var uploadPath = path.dirname(request.files[key].path);
		var finalPath = path.join(uploadPath, request.files[key].name);
		fs.rename(request.files[key].path, finalPath, function(err) {
			if(err) throw err;
			
			var localPath = finalPath.substring(__dirname.length+1);
			console.log(localPath);
		
			if(request.files[key].type == "image/jpeg" || request.files[key].type == "image/png"){
				fs.readFile(localPath, function (err, data) {
					if(err) throw err;
				
					var info = imageinfo(data);
					var itemId = "item"+itemCount.toString();
					var title = path.basename(localPath);
					var source = "data:" + info.mimeType + ";base64, " + data.toString("base64");
					var aspect = info.width / info.height;
					var now = new Date();
					var newItem = new item("img", title, itemId, source, 0, 0, info.width, info.height, aspect, now, null, null);
					items.push(newItem);
					sio.sockets.emit('addNewElement', newItem);
					itemCount++;
				});
			}
			else if(request.files[key].type == "video/mp4"){
				ffprobe(localPath, function(err, data){
					if(err) throw err;
				
					for(var i=0; i<data.streams.length; i++){
						if(data.streams[i].codec_type == "video"){
							var itemId = "item"+itemCount.toString();
							var title = data.filename;
							var aspect = data.streams[i].width / data.streams[i].height;
							var now = new Date();
							var newItem = new item("video", title, itemId, data.file, 0, 0, data.streams[i].width, data.streams[i].height, aspect, now, null, null);
							items.push(newItem);
							sio.sockets.emit('addNewElement', newItem);
							itemCount++;
						
							break;
						}
					}
				});
			}
			else if(request.files[key].type == "application/pdf"){
				console.log("Warning - PDF disabled");
				/*
				pdfutils(localPath, function(err, doc) {
					// grab size of first page
					var itemId = "item"+itemCount.toString();
					var title = path.basename(localPath);
					var aspect = doc[0].width/doc[0].height;
					var now = new Date();
					var newItem = new item("pdf", title, itemId, localPath, 0, 0, doc[0].width, doc[0].height, aspect, now, null, null);
					items.push(newItem);
					sio.sockets.emit('addNewElement', newItem);
					itemCount++;
				});
				*/
			}
			else if(request.files[key].type == "application/zip"){
				var zipFolder = localPath.substring(0, localPath.length-4);
				var zipName = request.files[key].name.substring(0, request.files[key].name.length-4);
			
				var unzipper = new decompresszip(localPath);
				unzipper.on('extract', function(log) {
					// read instructions for how to handle
					var instuctionsFile = zipFolder + "/instructions.json";
					fs.readFile(instuctionsFile, 'utf8', function(err, json_str) {
						if(err) throw err;
					
						var instructions = JSON.parse(json_str);
					
						// add resource scripts to clients
						for(var i=0; i<instructions.resources.length; i++){
							if(instructions.resources[i].type == "script"){
								sio.sockets.emit('addScript', zipFolder+"/"+instructions.resources[i].src);
							}
						}
					
						// add item to clients (after waiting 1 second to ensure resources have loaded)
						setTimeout(function() {
							var itemId = "item"+itemCount.toString();
							var title = zipName;
							var objName = instructions.main_script.substring(0, instructions.main_script.lastIndexOf('.'));
							var now = new Date();
							var aspect = instructions.width / instructions.height;
							var newItem = new item(instructions.type, title, itemId, zipFolder+"/"+instructions.main_script, 0, 0, instructions.width, instructions.height, aspect, now, zipFolder+"/", objName);
							items.push(newItem);
							sio.sockets.emit('addNewElement', newItem);
							itemCount++;
				
							// set interval timer if specified
							if(instructions.animation == "timer"){
								setInterval(function() {
									var now = new Date();
									sio.sockets.emit('animateCanvas', {elemId: itemId, type: instructions.type, date: now});
								}, instructions.interval);
							}
						}, 1000);
					});
				
					// delete original zip file
					fs.unlink(localPath, function(err) {
						if(err) throw err;
					});
				});
				unzipper.extract({
					path: uploadsFolder,
					filter: function(file) {
						return file.type !== "SymbolicLink";
					}
				});
			}
			else{
				console.log("Unknown type: " + request.files[key].type);
			}
		});
	});
	
	response.end("upload complete");
});

/////////////////////////////////////////////////////////////////////////
// ---------------------------------------------
// DATA FROM OMICRONJS
// ADAPTED FROM LUC's omicronjs server code
// ---------------------------------------------

// ---------------------------------------------
// Tracking
// ---------------------------------------------

var net = require('net');
var util = require('util');
var dgram = require('dgram');
//var sprint = require('sprint').sprint;

// Global UDP socket to the tracker server
var udp = undefined;

// CAVE2
//var tserver   = "cave2tracker.evl.uic.edu";
// Green table
//var tserver   = "midori.evl.uic.edu";
// Icelab
var tserver   = "omgtracker.evl.uic.edu";

var tport     = 28000;
var pdataPort = 9123;

var ptrs    = {};

		console.log('Connecting to Omicron server: ', tserver, tport);
		var client = net.connect(tport, tserver,  function() { //'connect' listener
        console.log('Connected to: ', tserver, tport);

        var sendbuf = util.format("omicron_data_on,%d", pdataPort);
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

        udp.on("message", function (msg, rinfo) {
                // console.log("UDP> got: " + msg + " from " + rinfo.address + ":" + rinfo.port);
                // var out = util.format("UDP> msg from [%s:%d] %d bytes", rinfo.address,rinfo.port,msg.length);
                // console.log(out);

                if ((Date.now() - dstart) > 100) {
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
                        // memcpy(ed.extraData, &eventPacket[offset], EventData::ExtraDataSize);

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

                        if (e.serviceType == 0) {  // ServiceTypePointer
                                //console.log("pointer event! type: " + e.type  );
                                //console.log("ServiceTypePointer> source ", e.sourceId);
                                if (e.type == 3) { // update
                                         if( e.sourceId in ptrs )
                                             return;
                                        colorpt = [Math.floor(e.posx*255.0), Math.floor(e.posy*255.0), Math.floor(e.posz*255.0)];
                                        if (offset < msg.length) {
                                                if (e.extraDataType == 4 && e.extraDataItems > 0) {
                                                        console.log("create pointer"); 
                                                        e.extraString = msg.toString("utf-8", offset, offset+e.extraDataItems);
                                                        ptrinfo = e.extraString.split(" ");
                                                        offset += e.extraDataItems;
                                                        ptrs[e.sourceId] = {id:e.sourceId, label:ptrinfo[0], ip:ptrinfo[1], mouse:[0,0,0], color:colorpt, zoom:0, position:[0,0], mode:0};
                                                        sio.sockets.emit('createPointer', {type: 'ptr', id: e.sourceId, label: ptrinfo[0], color: colorpt, zoom:0, position:[0,0], src: "resources/mouse-pointer-hi.png" });
                                                }
                                        }
                                }
                                else if (e.type == 4) { // move
                                        //console.log("\t move ", e.posx, e.posy);
                                        if (e.sourceId in ptrs) {
                                           sio.sockets.emit( 'movePointer',{elemId: e.sourceId, elemLeft: e.posx, elemTop: e.posy});
                                           ptrs[e.sourceId].position = [e.posx, e.posy];

                                           if( ptrs[e.sourceId].mouse[0] == 1 )
                                           {
                                                console.log("Drag");
                                                handleSagePointerDrag( e.posx * config.totalWidth, e.posy*config.totalHeight, ptrs[e.sourceId].mode );
                                            }
                                        }
//                                         else{
//                                             console.log("need to create pointer");
//                                               colorpt = [Math.floor(e.posx*255.0), Math.floor(e.posy*255.0), Math.floor(e.posz*255.0)];
//                                                 if (offset < msg.length) {
//                                                    if (e.extraDataType == 4 && e.extraDataItems > 0) {
//                                                             console.log("create pointer"); 
//                                                             e.extraString = msg.toString("utf-8", offset, offset+e.extraDataItems);
//                                                             ptrinfo = e.extraString.split(" ");
//                                                             offset += e.extraDataItems;
//                                                             ptrs[e.sourceId] = {id:e.sourceId, label:ptrinfo[0], ip:ptrinfo[1], mouse:[0,0,0], color:colorpt, zoom:0, position:[0,0]};
//                                                             sio.sockets.emit('createPointer', {type: 'ptr', id: e.sourceId, label: ptrinfo[0], color: colorpt, zoom:0, position:[0,0], src: "resources/mouse-pointer-hi.png" });
//                                                     }
//                                             }  
//                                         }
                                        
                                }
                                else if (e.type == 15) { // zoom
//                                         sio.sockets.emit('changeMode', {mode: 1} );
                                        if (e.sourceId in ptrs) {
                                                //console.log("\t zoom x:" + ptrs[e.sourceId].position[0] + " y:" + ptrs[e.sourceId].position[1]);

                                                //ptrs[e.sourceId].position = [e.posx, e.posy];
                                                ptrs[e.sourceId].zoom = 1;
                                                zoom = 1; 
                                                if (offset < msg.length) {
                                                        // One int for zoom value
                                                        if (e.extraDataType == 2 && e.extraDataItems == 1) {
                                                                //which elem:
                                                                
                                                        
                                                                e.extraInt = msg.readInt32LE(offset);
                                                                offset += 4
                                                                zoom = e.extraInt; 
                                                                
                                                                handleSagePointerZoom( zoom, ptrs[e.sourceId].position[0]*config.totalWidth, ptrs[e.sourceId].position[1]*config.totalHeight, ptrs[e.sourceId].mode); 
                                                        }
                                                }
                                        }
                                }
                                else if (e.type == 5) { // button down
                                        //console.log("\t down , flags ", e.flags);
                                        if (e.sourceId in ptrs) {
                                                ptrs[e.sourceId].position = [e.posx, e.posy];
                                                
                                                var counter, i;
                                                for(counter=0; counter < 3; counter++)
                                                { 
                                                        i = Math.pow(2, counter);
                                                        if (e.flags & i)
                                                                ptrs[e.sourceId].mouse[counter] = 1;
                                                        else
                                                                ptrs[e.sourceId].mouse[counter] = 0;

                                                }

                                                //if( ptrs[e.sourceId].mouse[0] == 1 )
                                                //{
                                                    console.log("Click");
                                                    handleSagePointerClick( e.posx * config.totalWidth, e.posy*config.totalHeight, e.sourceId, ptrs[e.sourceId].mode );
                                                //}
                                        }
                                }
                                else if (e.type == 6) { // button up
                                        //console.log("\t up , flags ", e.flags);
                                        if (e.sourceId in ptrs) {
                                           ptrs[e.sourceId].position = [e.posx, e.posy];
                                                        
                                            ptrs[e.sourceId].mouse[0] = 0;
                                            ptrs[e.sourceId].mouse[1] = 0;
                                            ptrs[e.sourceId].mouse[2] = 0;
                                            releaseSelectedMoveItem(); 
                                        }
                                }
                                else {
                                        console.log("\t UNKNOWN event type ", e.type);                                        
                                }

                                // Emit a pointer event
                                //sio.sockets.emit('pointer', {x:mousexy[0],y:mousexy[1],zoom:mousez, b1:mouse[0], b2:mouse[1], b3:mouse[2]} );
//                                 if (e.sourceId in ptrs)
//                                         sio.sockets.emit('pointer',  ptrs[e.sourceId] );
                        }

                        // if (e.type == 3) {
//                                 if (e.serviceType == 1) {  // ServiceTypeMocap
//                                         var RAD_TO_DEGREE = 180.0/Math.PI;
//                                         var pfmt = sprint("\tp: x %6.2fm | y %6.2fm | z %6.2fm\n",
//                                                                 e.posx, e.posy, e.posz); // in meters
//                                         var rfmt = sprint("\tr: p(x) %4.0f | y(y) %4.0f | r(z) %4.0f\n", // degrees
//                                                                 RAD_TO_DEGREE * r_pitch, RAD_TO_DEGREE * r_yaw, RAD_TO_DEGREE * r_roll);
// 
//                                         if (e.sourceId == 0) {
//                                                 //console.log("head> ", pfmt+rfmt);
//                                                 sio.sockets.emit('head', {text: pfmt+rfmt, pos:[e.posx, e.posy, e.posz],
//                                                                                                 rot:[RAD_TO_DEGREE * r_pitch, RAD_TO_DEGREE * r_yaw, RAD_TO_DEGREE * r_roll]});
//                                         }
//                                         if (e.sourceId == 1) {
//                                                 //console.log("wand> ", pfmt+rfmt);
//                                                 sio.sockets.emit('wand', {text: pfmt+rfmt, pos:[e.posx, e.posy, e.posz],
//                                                                                                 rot:[RAD_TO_DEGREE * r_pitch, RAD_TO_DEGREE * r_yaw, RAD_TO_DEGREE * r_roll]});
//                                         }
//                                         if (e.sourceId == 2) {
//                                                 //console.log("wand2> ", pfmt+rfmt);
//                                                 sio.sockets.emit('wand2', {text: pfmt+rfmt, pos:[e.posx, e.posy, e.posz],
//                                                                                                 rot:[RAD_TO_DEGREE * r_pitch, RAD_TO_DEGREE * r_yaw, RAD_TO_DEGREE * r_roll]});
//                                         }
//                                         emit++;
//                                 }
//                         }
                        if (emit>2) { dstart = Date.now(); emit = 0; }
                }
        });

// 
//                            if( e.type == 4 ) //MOVE event is of type 4
//                            {
//                                if( e.serviceType == 0 ) //SAGE pointer event
//                                {
//                                    var pfmt = sprint("\tp: x %6.2fm | y %6.2fm | z %6.2fm\n",
//                                                      e.posx, e.posy, e.posz); // in meters
//                                    console.log( "pointer moved: " + e.posx + " " + e.posy);
// //                           
// //                              sio.sockets.emit('createPointer', {type: 'ptr', id: '1', src: "resources/cursor_arrow_48x48.png" });
// //                           sio.sockets.emit('movePointer', "hi");
// 
//                            
//                                    sio.sockets.emit( 'movePointer',{elemId: '0', elemLeft: e.posx, elemTop: e.posy});
//                            
//                            
// //                                    sio.sockets.emit('TEST', "hi");
//                                }
//                            }
//                            
//                            if (emit>2) { dstart = Date.now(); emit = 0; }
//                            }
//                            });
                            
                            udp.on("listening", function () {
                                   var address = udp.address();
                                   console.log("UDP> listening " + address.address + ":" + address.port);
                                   });
                            
                            udp.bind(pdataPort);
                            });

/////////////////////////////////////////////////////////////////////////


// Start the http server
server.listen(hport);

console.log('Now serving the app at http://localhost:' + hport);


function findItemById(id) {
	for(var i=0; i<items.length; i++){
		if(items[i].id == id) return items[i];
	}
}

function removeItemById(id) {
	moveItemToFront(id);
	items.pop();
}

function moveItemToFront(id) {
	var i;
	var selectedIndex;
	var selectedItem;
	var itemIds = [];
	
	for(i=0; i<items.length; i++){
		if(items[i].id == id){
			selectedIndex = i;
			selectedItem = items[selectedIndex];
			break;
		}
		itemIds.push(items[i].id);
	}
	for(i=selectedIndex; i<items.length-1; i++){
		items[i] = items[i+1];
		itemIds.push(items[i].id);
	}
	items[items.length-1] = selectedItem;
	itemIds.push(id);
	
	return itemIds;
}

function item(type, title, id, src, left, top, width, height, aspect, date, resrc, extra) {
	this.type = type;
	this.title = title;
	this.id = id;
	this.src = src;
	this.left = left;
	this.top = top;
	this.width = width;
	this.height = height;
	this.aspect = aspect;
	this.date = date;
	this.resrc = resrc;
	this.extra = extra;
}

