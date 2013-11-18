var express = require("express");
var http = require('http');
var request = require('request');
var fs = require('fs');
var path = require('path');
var decompresszip = require('decompress-zip');
var gm = require('gm');
var ytdl = require('ytdl');

var app = express();
var hport = 9090;

var uploadsFolder = __dirname + "/uploads";

app.configure(function(){
	app.use(express.methodOverride());
	app.use(express.bodyParser({uploadDir: uploadsFolder}));
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
var config;
fs.readFile(file, 'utf8', function(err, json_str) {
	if(err){
		console.log('Error: ' + err);
		return;
	}
	config = JSON.parse(json_str);
	config.totalWidth = config.resolution.width * config.layout.columns;
	config.totalHeight = config.resolution.height * config.layout.rows;
	config.titleBarHeight = Math.round(0.03 * config.totalHeight);
	config.titleTextSize = Math.round(0.018 * config.totalHeight);
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
			var fileName = elem_data.src.substring(elem_data.src.lastIndexOf("/")+1);
			var tmpFile = fs.createWriteStream("tmp/" + fileName);
			request(elem_data.src).pipe(tmpFile);
			
			tmpFile.on('finish', function() {
				gm("tmp/" + fileName).size(function(err, size) {
					if(!err){
						var itemId = "item"+itemCount.toString();
						var title = fileName;
						var aspect = size.width / size.height;
						var now = new Date();
						var newItem = new item("img", title, itemId, elem_data.src, 0, 0, size.width, size.height, aspect, now, "", "");
						items.push(newItem);
						sio.sockets.emit('addNewElement', newItem);
						itemCount++;
						console.log(elem_data.src);
						
						// delete tmp file
						fs.unlink("tmp/" + fileName, function(err) {
							if(err) console.log(err);
						});
					}
					else{
						console.log("Error: " + err);
					}
				});
				
			});
			
		}
		else if(elem_data.type == "youtube"){
			ytdl.getInfo(elem_data.src, function(err, info){
				console.log(info.title);
				var mp4Idx = -1;
				var mp4Resolution = 0;
				var webmIdx = -1;
				var webmResolution = 0;
				for(i=0; i<info.formats.length; i++){
					if(info.formats[i].container == "mp4"){
						var res = parseInt(info.formats[i].resolution.substring(0, info.formats[i].resolution.length-1));
						if(res > mp4Resolution){
							mp4Idx = i;
							mp4Resolution = res;
						}
					}
					else if(info.formats[i].container == "webm"){
						var res = parseInt(info.formats[i].resolution.substring(0, info.formats[i].resolution.length-1));
						if(res > webmResolution){
							webmIdx = i;
							webmResolution = res;
						}
					}
				}
				console.log(mp4Idx + ": " + mp4Resolution);
				console.log(webmIdx + ": " + webmResolution);
				
				var itemId = "item"+itemCount.toString();
				var title = info.title;
				var aspect = 16/9;
				var now = new Date();
				var resolutionY = Math.max(mp4Resolution, webmResolution);
				var resolutionX = resolutionY * aspect;
				var poster = info.iurlmaxres;
				if(poster == null) poster = info.iurlsd;
				var newItem = new item("video", title, itemId, info.formats[mp4Idx].url, 0, 0, resolutionX, resolutionY, aspect, now, info.formats[webmIdx].url, poster);
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

	socket.on('selectElementById', function(select_data) {
		selectedMoveItem = findItemById(select_data.elemId);
		selectedScrollItem = null;
		selectOffsetX = select_data.eventOffsetX;
		selectOffsetY = select_data.eventOffsetY;
		
		moveItemToFront(selectedMoveItem.id);
		
		var itemIds = [];
		for(var i=0; i<items.length; i++){
			itemIds.push(items[i].id);
		}
		
		sio.sockets.emit('updateItemOrder', itemIds);
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
		sio.sockets.emit('setItemPosition', {elemId: selectedMoveItem.id, elemLeft: selectedMoveItem.left, elemTop: selectedMoveItem.top, date: now});
	});
	
	socket.on('selectScrollElementById', function(elemId) {
		selectedScrollItem = findItemById(elemId);
		selectedMoveItem = null;
		
		moveItemToFront(selectedScrollItem.id);
		
		var itemIds = [];
		for(var i=0; i<items.length; i++){
			itemIds.push(items[i].id);
		}
		
		sio.sockets.emit('updateItemOrder', itemIds);
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
	});
});

app.post('/upload', function(request, response) {
	var i;
	var uploads
	for(var f in request.files){
		var uploadPath = path.dirname(request.files[f].path);
		var finalPath = path.join(uploadPath, request.files[f].name);
		fs.rename(request.files[f].path, finalPath);
		
		var localPath = finalPath.substring(__dirname.length+1);
		console.log(localPath);
		
		if(request.files[f].type == "image/jpeg" || request.files[f].type == "image/png" || request.files[f].type == "image/bmp"){
			gm(localPath).size(function(err, size) {
				if(!err){
					var itemId = "item"+itemCount.toString();
					var title = request.files[f].name;
					var aspect = size.width / size.height;
					var now = new Date();
					var newItem = new item("img", title, itemId, this.source, 0, 0, size.width, size.height, aspect, now, "", "");
					items.push(newItem);
					sio.sockets.emit('addNewElement', newItem);
					itemCount++;
				}
				else{
					console.log("Error: " + err);
				}
			});
		}
		else if(request.files[f].type == "application/zip"){
			var zipFolder = localPath.substring(0, localPath.length-4);
			var zipName = request.files[f].name.substring(0, request.files[f].name.length-4);
			
			var unzipper = new decompresszip(localPath);
			unzipper.on('extract', function (log) {
				// read instructions for how to handle
				var instuctionsFile = zipFolder + "/instructions.json";
				fs.readFile(instuctionsFile, 'utf8', function(err, json_str) {
					if(err){
						console.log('Error: ' + err);
						return;
					}
					var instructions = JSON.parse(json_str);
					
					// add resource scripts to clients
					for(i=0; i<instructions.resources.length; i++){
						if(instructions.resources[i].type == "script"){
							sio.sockets.emit('addScript', zipFolder+"/"+instructions.resources[i].src);
						}
					}
					
					// add item to clients (after waiting 1 second to ensure resources have loaded)
					setTimeout(function() {
						var itemId = "item"+itemCount.toString();
						var title = zipName;
						objName = instructions.main_script.substring(0, instructions.main_script.lastIndexOf('.'));
						var now = new Date();
						var aspect = instructions.width / instructions.height;
						var appExtra = [instructions.type, objName];
						var newItem = new item("canvas", title, itemId, zipFolder+"/"+instructions.main_script, 0, 0, instructions.width, instructions.height, aspect, now, zipFolder+"/", appExtra);
						items.push(newItem);
						sio.sockets.emit('addNewElement', newItem);
						itemCount++;
				
						// set interval timer if specified
						if(instructions.animation == "timer"){
							setInterval(function() {
								var now = new Date();
								sio.sockets.emit('animateCanvas', {elemId: itemId, date: now});
							}, instructions.interval);
						}
					}, 1000);
				});
				
				// delete original zip file
				fs.unlink(localPath, function(err) {
					if(err) console.log(err);
				});
			});
			unzipper.extract({
				path: uploadsFolder,
				filter: function (file) {
					return file.type !== "SymbolicLink";
				}
			});
		}
		else{
			console.log("Unknown type: " + request.files[f].type);
		}
	}
	
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

function moveItemToFront(id) {
	var i;
	var selectedIndex;
	var selectedItem;
	
	for(i=0; i<items.length; i++){
		if(items[i].id == id){
			selectedIndex = i;
			selectedItem = items[selectedIndex];
			break;
		}
	}
	for(i=selectedIndex; i<items.length-1; i++){
		items[i] = items[i+1];
	}
	items[items.length-1] = selectedItem;
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

