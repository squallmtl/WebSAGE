var express = require("express");
var http = require('http');
var fs = require('fs');
var path = require('path');
var gm = require('gm');
var unzip = require('unzip');

var app = express();
var hport = 9090;

app.configure(function(){
	app.use(express.methodOverride());
	app.use(express.bodyParser({uploadDir:__dirname + '/uploads'}));
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
var totalWidth;
var totalHeight;
fs.readFile(file, 'utf8', function(err, json_str) {
	if(err){
		console.log('Error: ' + err);
		return;
	}
	config = JSON.parse(json_str);
	totalWidth = config.resolution.width * config.layout.columns;
	totalHeight = config.resolution.height * config.layout.rows;
	console.log(config);
	console.log("Total Resolution: " + totalWidth + "x" + totalHeight);
});

var itemCount = 0;
var items = [];

//var itemTest = {type: "canvas2d", id: "item_test", src: "scripts/clock.js", left: 0, top: 0, width: 400, height: 300, aspectRatio: 1.333333, initFunction: "myClock1 = new clock('item_test_canvas2d'); myClock1.draw();"};
//items.push(itemTest);

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
		
		sio.sockets.emit('itemSelected', selectedMoveItem.id);
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
		sio.sockets.emit('itemSelected', selectedScrollItem.id);
	});
	
	socket.on('scrollSelectedElement', function(scale) {
		if(selectedScrollItem == null) return;
		var iWidth = selectedScrollItem.width * scale;
		var iHeight = iWidth / selectedScrollItem.aspectRatio;
		if(iWidth < 20){ iWidth = 20; iHeight = iWidth/selectedScrollItem.aspectRatio; }
		if(iHeight < 20){ iHeight = 20; iWidth = iHeight*selectedScrollItem.aspectRatio; }
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
	for(var f in request.files){
		var uploadPath = path.dirname(request.files[f].path);
		var finalPath = path.join(uploadPath, request.files[f].name);
		fs.rename(request.files[f].path, finalPath);
		
		var localPath = finalPath.substring(__dirname.length+1);
		console.log(localPath);
		
		if(request.files[f].type == "image/jpeg" || request.files[f].type == "image/png" || request.files[f].type == "image/bmp"){
			gm(localPath).size(function(err, size) {
				if(!err){
					var aspect = size.width / size.height;
					var now = new Date();
					var newItem = {type: "img", id: "item"+itemCount.toString(), src: this.source, left: 0, top: 0, width: size.width, height: size.height, aspectRatio: aspect, date: now, extra: ""};
					items.push(newItem);
					sio.sockets.emit('addNewElement', newItem);
					itemCount++;
				}
				else{
					console.log("Error: " + err);
				}
			});
		}
		else if(request.files[f].type == "application/x-javascript"){
			// default values
			var cWidth = Math.round(totalWidth / 4);
			var cHeight = Math.round(totalHeight / 4);
			var cAnimation = "none";
			var cInterval = 16;
			
			// read file for WebSAGE information
			fs.readFile(localPath, 'utf8', function(err, data) {
				if(err){
					console.log('Error: ' + err);
					return;
				}
				var lines = data.toString().split("\n");
				for(i=0; i<lines.length; i++){
					if(lines[i].substring(0,6) == "//WS: "){
						var param = lines[i].substring(6).split("=");
						if(param[0] == "width"){
							cWidth = parseInt(param[1]);
						}
						else if(param[0] == "height"){
							cHeight = parseInt(param[1]);
						}
						else if(param[0] == "animation"){
							cAnimation = param[1];
						}
						else if(param[0] == "interval"){
							cInterval = parseInt(param[1]);
						}
					}
				}
				var cAspect = cWidth / cHeight;
			
				// add item to clients
				var itemId = "item"+itemCount.toString();
				var className = request.files[f].name.substring(0, request.files[f].name.length-3);
				var now = new Date();
				var newItem = {type: "canvas", id: itemId, src: localPath, left: 0, top: 0, width: cWidth, height: cHeight, aspectRatio: cAspect, date: now, extra: className};
				items.push(newItem);
				sio.sockets.emit('addNewElement', newItem);
				itemCount++;
				
				// set interval timer if specified
				if(cAnimation == "timer"){
					setInterval(function() {
						var now = new Date();
						sio.sockets.emit('animateCanvas', {elemId: itemId, date: now});
					}, cInterval);
				}
			});
		}
		else if(request.files[f].type == "application/zip"){
			var parentDir = request.files[f].name.substring(0, request.files[f].name.length-4);
			
			// unzip file
			var zipfile = fs.createReadStream(localPath).pipe(unzip.Parse());
			zipfile.on('entry', function(entry) {
				if(entry.path.substring(0, parentDir.length) == parentDir) {
					if(entry.type == "Directory"){
						var exist = fs.existsSync(__dirname + "/uploads/" + entry.path);
						if(!exist) {
							fs.mkdir(__dirname + "/uploads/" + entry.path, function(err) {
								if(err) console.log(err);
							});
						}
					}
					else if(entry.type == "File"){
						var output = fs.createWriteStream(__dirname + "/uploads/" + entry.path);
						output.on('finish', function() {
							console.log("finished writing: " + entry.path);
						});
						entry.pipe(output);
					}
				}
				else {
					entry.autodrain();
				}
			});
			
			// once all files/folders have been extracted
			zipfile.on('close', function() {
				// read instructions for how to handle
				var instuctionsFile = localPath.substring(0, localPath.length-4) + "/instructions.txt";
				fs.readFile(instuctionsFile, 'utf8', function(err, data) {
					if(err){
						console.log('Error: ' + err);
						return;
					}
					var lines = data.toString().split("\n");
					console.log("Application Instructions");
					for(i=0; i<lines.length; i++){
						console.log("  " + lines[i]);
					}
				});
				
				// delete original zip file
				fs.unlink(localPath, function(err) {
					if(err) console.log(err);
				});
			});
			
			//zipfile.pipe(unzip.Parse());
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
