var express = require("express");
var http = require('http');
var fs = require('fs');
var path = require('path');
var gm = require('gm');

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

//var file = 'config/desktop-cfg.json';
//var file = 'config/thor-cfg.json';
var file = 'config/iridium-cfg.json';
var config;
fs.readFile(file, 'utf8', function(err, json_str) {
	if(err){
		console.log('Error: ' + err);
		return;
	}
	config = JSON.parse(json_str);
	console.log(config);
});

var itemCount = 0;
var items = [];

var itemTest = {type: "canvas2d", id: "item_test", src: "scripts/clock.js", left: 0, top: 0, width: 400, height: 300, aspectRatio: 1.333333, initFunction: "myClock1 = new clock('item_test_canvas2d'); myClock1.draw();"};
items.push(itemTest);

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
		sio.sockets.emit('setItemPosition', {elemId: selectedMoveItem.id, elemLeft: selectedMoveItem.left, elemTop: selectedMoveItem.top});
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
		sio.sockets.emit('setItemPositionAndSize', {elemId: selectedScrollItem.id, elemLeft: selectedScrollItem.left, elemTop: selectedScrollItem.top, elemWidth: selectedScrollItem.width, elemHeight: selectedScrollItem.height});
	});
});

app.post('/upload', function(request, response) {
	var i;
	console.log("### " + request.files);
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
					var newItem = {type: "img", id: "item"+itemCount.toString(), src: this.source, left: 0, top: 0, width: size.width, height: size.height, aspectRatio: aspect, initFunction: ""};
					items.push(newItem);
					sio.sockets.emit('addNewElement', newItem);
					itemCount++;
				}
				else{
					console.log("Error: " + err);
				}
			});
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
