var express = require("express");
var http = require('http');

var app = express();
var hport = 9090;

app.configure(function(){
	app.use(express.methodOverride());
	app.use(express.bodyParser());
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

var fs = require('fs');
//var file = 'config/thor-cfg.json';
//var file = 'config/iridium-cfg.json';
var file = 'config/jauri-cfg.json';

var config;
fs.readFile(file, 'utf8', function(err, json_str) {
	if(err){
		console.log('Error: ' + err);
		return;
	}
	config = JSON.parse(json_str);
	console.log(config);
});


sio.sockets.on('connection', function(socket) {
	var address = socket.handshake.address;
	console.log("New connection from " + address.address + ":" + address.port);
	
	var cDate = new Date();

	console.log(cDate.getTime()-initDate.getTime());
	socket.emit('setSystemTime', cDate.getTime()-initDate.getTime());
	socket.emit('setupDisplayConfiguration', config);

	/* adding new elements */
	socket.emit('addNewElement', {type: "img", id: "item1", src: "images/sage_logo.jpg"});
	socket.emit('addNewElement', {type: "img", id: "item2", src: "images/evl-logo-small.jpg"});
	socket.emit('addNewElement', {type: "img", id: "item3", src: "images/omegalib-black.png"});
	
	/* jillian's elements */
	//socket.emit('addNewElement', {type: "site", id: "keggPathway", src: "protovisExample.html", width: 1000, height: 800 });
	//socket.emit('addNewElement', {type: "site", id: "keggPathway", src: "http://www.gmail.com", width: 500, height: 400 });
	socket.emit('addNewElement', {type: "site", id: "keggPathway", src: "http://webglmol.sourceforge.jp/glmol/viewer.html", width: 1000, height: 800 });


	/* user-interaction methods */
	var selectedElemId = null;
	var scrollElemId = null;
	var selectOffsetX;
	var selectOffsetY;
	var eLeft;
	var eTop;
	var eWidth;
	var eHeight;
	var eCenterX;
	var eCenterY;
	var eRatio;

	socket.on('selectElementById', function(select_data) {
		selectedElemId = select_data.elemId;
		selectOffsetX = select_data.eventOffsetX;
		selectOffsetY = select_data.eventOffsetY;
		eLeft = select_data.elemLeft;
		eTop = select_data.elemTop;
		
		sio.sockets.emit('itemSelected', selectedElemId);
	});
	
	socket.on('releaseSelectedElement', function() {
		selectedElemId = null;
	});
	
	socket.on('moveSelectedElement', function(move_data) {
		if(selectedElemId == null) return;
		eLeft = move_data.eventX + selectOffsetX;
		eTop = move_data.eventY + selectOffsetY;
		
		sio.sockets.emit('setItemPosition', {elemId: selectedElemId, elemLeft: eLeft, elemTop: eTop});	
	});
	
	socket.on('selectScrollElementById', function(scroll_data) {
		scrollElemId = scroll_data.elemId;
		eLeft = scroll_data.elemLeft;
		eTop = scroll_data.elemTop;
		eWidth = scroll_data.elemWidth;
		eHeight = scroll_data.elemHeight;
		eRatio = scroll_data.elemAspectRatio;
		eCenterX = eLeft + (eWidth/2);
		eCenterY = eTop + (eHeight/2);
		
		sio.sockets.emit('itemSelected', scrollElemId);
	});
	
	socket.on('scrollSelectedElement', function(scale) {
		if(scrollElemId == null) return;
		eWidth = eWidth*scale;
		eHeight = eWidth/eRatio;
		if(eWidth < 20){ eWidth = 20; eHeight = eWidth/eRatio; }
		if(eHeight < 20){ eHeight = 20; eWidth = eHeight*eRatio; }
		eLeft = eCenterX - (eWidth/2);
		eTop = eCenterY - (eHeight/2);
		
		sio.sockets.emit('setItemPositionAndSize', {elemId: scrollElemId, elemLeft: eLeft, elemTop: eTop, elemWidth: eWidth, elemHeight: eHeight});
	});
});
/////////////////////////////////////////////////////////////////////////


// Start the http server
server.listen(hport);

console.log('Now serving the app at http://localhost:' + hport);

