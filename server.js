var decompresszip = require('decompress-zip');
var express = require("express");
var fs = require('fs');
var gm = require('gm');
var http = require('http');
var https = require('https');
var imageinfo = require('imageinfo');
var ffprobe = require('node-ffprobe');
var path = require('path');
var pdfutils = require('pdfutils').pdfutils;
var request = require('request');
var io = require('socket.io');
var webRTCio = require('webrtc.io');
var ytdl = require('ytdl');


var file = 'config/desktop-cfg.json';
//var file = 'config/thor-cfg.json';
//var file = 'config/iridium-cfg.json';
//var file = 'config/iridiumX-cfg.json';
//var file = 'config/lyra-cfg.json';

var json_str = fs.readFileSync(file, 'utf8');
var config = JSON.parse(json_str);
config.totalWidth = config.resolution.width * config.layout.columns;
config.totalHeight = config.resolution.height * config.layout.rows;
config.titleBarHeight = Math.round(0.025 * config.totalHeight);
config.titleTextSize = Math.round(0.015 * config.totalHeight);
config.pointerWidth = Math.round(0.20 * config.totalHeight);
config.pointerHeight = Math.round(0.05 * config.totalHeight);
console.log(config);

var uploadsFolder = __dirname + "/uploads";

var savedFiles = {"image": [], "video": [], "pdf": [], "app": []};
var uploadedImages = fs.readdirSync(uploadsFolder+"/images");
var uploadedVideos = fs.readdirSync(uploadsFolder+"/videos");
var uploadedPdfs = fs.readdirSync(uploadsFolder+"/pdfs");
var uploadedApps = fs.readdirSync(uploadsFolder+"/apps");
for(var i=0; i<uploadedImages.length; i++) savedFiles["image"].push(uploadedImages[i]);
for(var i=0; i<uploadedVideos.length; i++) savedFiles["video"].push(uploadedVideos[i]);
for(var i=0; i<uploadedPdfs.length; i++) savedFiles["pdf"].push(uploadedPdfs[i]);
for(var i=0; i<uploadedApps.length; i++) savedFiles["app"].push(uploadedApps[i]);
console.log(savedFiles);

var app = express();

app.configure(function(){
	app.use(express.methodOverride());
	app.use(express.bodyParser({uploadDir: uploadsFolder, limit: '250mb'}));
	app.use(express.multipart());
	app.use(express.static(__dirname + '/'));
	app.use(app.router);
});

var options = {
  key: fs.readFileSync("keys/server.key"),
  cert: fs.readFileSync("keys/server.crt"),
  ca: fs.readFileSync("keys/ca.crt"),
  requestCert: true,
  rejectUnauthorized: false
};

//var server = http.createServer(app);
var server = https.createServer(options, app);
var wsserver = http.createServer(app);

var webRTC = webRTCio.listen(wsserver);

// ---------------------------------------------
// Setup the websocket
// ---------------------------------------------
// To talk to the web clients
var sio = io.listen(server);

sio.configure(function () {
	sio.set('transports', ['websocket']);
	sio.set('log level', 0);
});

sio.configure('development', function () {
	sio.set('transports', ['websocket']);
	sio.disable('log');
});

var initDate = new Date();

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
	
	socket.on('addNewSharedScreen', function(screen_data) {
		console.log("Added shared screen");
		var now = new Date();
		var newItem = new item("screen", screen_data.title, screen_data.id, null, 0, 0, screen_data.width, screen_data.height, screen_data.aspect, now, null, null);
		items.push(newItem);
		sio.sockets.emit('addNewElement', newItem);
		itemCount++;
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
		else if(elem_data.type == "video"){
			ffprobe(elem_data.src, function(err, data){
				if(err) throw err;
			
				for(var i=0; i<data.streams.length; i++){
					if(data.streams[i].codec_type == "video"){
						var itemId = "item"+itemCount.toString();
						var title = elem_data.src.substring(elem_data.src.lastIndexOf("/")+1);
						var aspect = data.streams[i].width / data.streams[i].height;
						var now = new Date();
						var newItem = new item("video", title, itemId, elem_data.src, 0, 0, data.streams[i].width, data.streams[i].height, aspect, now, null, null);
						items.push(newItem);
						sio.sockets.emit('addNewElement', newItem);
						itemCount++;
						
						break;
					}
				}
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
		else if(elem_data.type == "pdf"){
			request({url:elem_data.src, encoding:null}, function(err, response, body) {
				if(err) throw err;
			
				pdfutils(body, function(err, doc) {
					if(err) throw err;
					
					// grab size of first page
					var itemId = "item"+itemCount.toString();
					var title = elem_data.src.substring(elem_data.src.lastIndexOf("/")+1);
					var aspect = doc[0].width/doc[0].height;
					var now = new Date();
					var newItem = new item("pdf", title, itemId, body.toString("base64"), 0, 0, doc[0].width, doc[0].height, aspect, now, null, null);
					items.push(newItem);
					sio.sockets.emit('addNewElement', newItem);
					itemCount++;
				});
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
	
	socket.on('keypressElementWithPointer', function(code) {
		var pointerX = sagePointers[address].left
		var pointerY = sagePointers[address].top
		
		var keypressItem = null;
		for(var i=items.length-1; i>=0; i--){
			if(pointerX >= items[i].left && pointerX <= (items[i].left+items[i].width) && pointerY >= items[i].top && pointerY <= (items[i].top+items[i].height)){
				keypressItem = findItemById(items[i].id);
				break;
			}
		}
		
		if(keypressItem != null){
			if(code == "8" || code == "46"){ // backspace or delete
				removeItemById(keypressItem.id);
				sio.sockets.emit('deleteElement', keypressItem.id);
			}
			else{
				var newOrder = moveItemToFront(keypressItem.id);
				sio.sockets.emit('updateItemOrder', newOrder);
				sio.sockets.emit('keypressItem', {elemId: keypressItem.id, keyCode: code});
			}
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
		
		if(request.files[key].type == "image/jpeg" || request.files[key].type == "image/png"){
			var finalPath = path.join(uploadPath+"/images", request.files[key].name);
			var localPath = finalPath.substring(__dirname.length+1);
			console.log(finalPath);
			fs.rename(request.files[key].path, finalPath, function(err) {
				if(err) throw err;
				
				fs.readFile(finalPath, function (err, data) {
					if(err) throw err;
					
					var info = imageinfo(data);
					var itemId = "item"+itemCount.toString();
					var title = path.basename(finalPath);
					var source = "data:" + info.mimeType + ";base64, " + data.toString("base64");
					var aspect = info.width / info.height;
					var now = new Date();
					var newItem = new item("img", title, itemId, source, 0, 0, info.width, info.height, aspect, now, null, null);
					items.push(newItem);
					sio.sockets.emit('addNewElement', newItem);
					itemCount++;
					
					savedFiles["image"].push(path.basename(finalPath));
				});
			});
		}
		else if(request.files[key].type == "video/mp4"){
			var finalPath = path.join(uploadPath+"/videos", request.files[key].name);
			var localPath = finalPath.substring(__dirname.length+1);
			fs.rename(request.files[key].path, finalPath, function(err) {
				if(err) throw err;
		
				ffprobe(finalPath, function(err, data){
					if(err) throw err;
				
					for(var i=0; i<data.streams.length; i++){
						if(data.streams[i].codec_type == "video"){
							var itemId = "item"+itemCount.toString();
							var title = path.basename(finalPath);
							var aspect = data.streams[i].width / data.streams[i].height;
							var now = new Date();
							var newItem = new item("video", title, itemId, localPath, 0, 0, data.streams[i].width, data.streams[i].height, aspect, now, null, null);
							items.push(newItem);
							sio.sockets.emit('addNewElement', newItem);
							itemCount++;
							
							savedFiles["video"].push(path.basename(finalPath));
							
							break;
						}
					}
				});
			});
		}
		else if(request.files[key].type == "application/pdf"){
			var finalPath = path.join(uploadPath+"/pdfs", request.files[key].name);
			var localPath = finalPath.substring(__dirname.length+1);
			fs.rename(request.files[key].path, finalPath, function(err) {
				if(err) throw err;
				
				fs.readFile(finalPath, function (err, data) {	
					pdfutils(data, function(err, doc) {
						if(err) throw err;
					
						// grab size of first page
						var itemId = "item"+itemCount.toString();
						var title = path.basename(finalPath);
						var aspect = doc[0].width/doc[0].height;
						var now = new Date();
						var newItem = new item("pdf", title, itemId, data.toString("base64"), 0, 0, doc[0].width, doc[0].height, aspect, now, null, null);
						items.push(newItem);
						sio.sockets.emit('addNewElement', newItem);
						itemCount++;
					
						savedFiles["pdf"].push(path.basename(finalPath));
					});
				});
			});
		}
		else if(request.files[key].type == "application/zip"){
			var finalPath = path.join(uploadPath+"/apps", request.files[key].name);
			var localPath = finalPath.substring(__dirname.length+1);
			fs.rename(request.files[key].path, finalPath, function(err) {
				if(err) throw err;
				
				var zipFolder = localPath.substring(0, localPath.length-4);
				var zipName = path.basename(localPath, ".zip");
			
				var unzipper = new decompresszip(finalPath);
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
							
							savedFiles["app"].push(zipName);
				
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
					path: uploadsFolder+"/apps",
					filter: function(file) {
						if(file.type === "SymbolicLink") return false;
						if(file.filename === "__MACOSX") return false;
						if(file.filename.substring(0,1) == ".") return false;
						if(file.parent.length >= 8 && file.parent.substring(0,8) == "__MACOSX") return false;
						
						return true;
					}
				});
			});
		}
		else{
			console.log("Unknown type: " + request.files[key].type);
		}
	});
	
	response.end("upload complete");
});

/////////////////////////////////////////////////////////////////////////


// Start the https server
server.listen(config.port);
wsserver.listen(config.port+1);

console.log('Now serving the app at https://localhost:' + config.port);


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

