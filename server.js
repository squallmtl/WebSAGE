var express = require("express");
var http = require('http');
var request = require('request');
var fs = require('fs');
var path = require('path');
var pdfutils = require('pdfutils').pdfutils;
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
	console.log(config);
});

var itemCount = 0;
var items = [];

sio.sockets.on('connection', function(socket) {
	var i;
	var address = socket.handshake.address;
	console.log("New connection from " + address.address + ":" + address.port);
	
	var cDate = new Date();

	console.log(cDate.getTime()-initDate.getTime());
	socket.emit('setSystemTime', cDate.getTime()-initDate.getTime());
	socket.emit('setupDisplayConfiguration', config);

	/* adding new elements */
	for(i=0; i<items.length; i++){
		socket.emit('addNewElement', items[i]);
	}
	
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

	/* user-interaction methods */
	var selectedMoveItem;
	var selectedScrollItem;
	var selectOffsetX;
	var selectOffsetY;
	var selectTimeId = {};

	socket.on('selectElementById', function(select_data) {
		selectedMoveItem = findItemById(select_data.elemId);
		selectedScrollItem = null;
		selectOffsetX = select_data.eventOffsetX;
		selectOffsetY = select_data.eventOffsetY;
		
		var newOrder = moveItemToFront(selectedMoveItem.id);
		sio.sockets.emit('updateItemOrder', newOrder);
	});
	
	socket.on('releaseSelectedElement', function() {
		selectedMoveItem = null;
		selectedScrollItem = null;
	});
	
	socket.on('moveSelectedElement', function(move_data) {
		if(selectedMoveItem == null) return;
		selectedMoveItem.left = move_data.eventX + selectOffsetX;
		selectedMoveItem.top = move_data.eventY + selectOffsetY;
		var now = new Date();
		sio.sockets.emit('setItemPosition', {elemId: selectedMoveItem.id, elemLeft: selectedMoveItem.left, elemTop: selectedMoveItem.top, elemWidth: selectedMoveItem.width, elemHeight: selectedMoveItem.height, date: now});
	});
	
	socket.on('selectScrollElementById', function(elemId) {
		selectedScrollItem = findItemById(elemId);
		selectedMoveItem = null;
		
		var newOrder = moveItemToFront(selectedScrollItem.id);
		sio.sockets.emit('updateItemOrder', newOrder);
	});
	
	socket.on('scrollSelectedElement', function(scale) {
		if(selectedScrollItem == null) return;
		var iWidth = selectedScrollItem.width * scale;
		var iHeight = iWidth / selectedScrollItem.aspect;
		if(iWidth < 20){ iWidth = 20; iHeight = iWidth/selectedScrollItem.aspect; }
		if(iHeight < 20){ iHeight = 20; iWidth = iHeight*selectedScrollItem.aspect; }
		var iCenterX = selectedScrollItem.left + (selectedScrollItem.width/2);
		var iCenterY = selectedScrollItem.top + (selectedScrollItem.height/2);
		selectedScrollItem.left = iCenterX - (iWidth/2);
		selectedScrollItem.top = iCenterY - (iHeight/2);
		selectedScrollItem.width = iWidth;
		selectedScrollItem.height = iHeight;
		var now = new Date();
		sio.sockets.emit('setItemPositionAndSize', {elemId: selectedScrollItem.id, elemLeft: selectedScrollItem.left, elemTop: selectedScrollItem.top, elemWidth: selectedScrollItem.width, elemHeight: selectedScrollItem.height, date: now});
		
		var elemId = selectedScrollItem.id;
		if(elemId in selectTimeId) clearTimeout(selectTimeId[elemId]);
		
		selectTimeId[elemId] = setTimeout(function() {
			sio.sockets.emit('finishedResize', elemId);
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

