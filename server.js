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

var fs = require('fs');
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

//	/* adding new elements */
//	socket.emit('addNewElement', {type: "img", id: "item1", src: "images/sage_logo.jpg"});
//	socket.emit('addNewElement', {type: "img", id: "item2", src: "images/evl-logo-small.jpg"});
//	socket.emit('addNewElement', {type: "img", id: "item3", src: "images/omegalib-black.png"});
//	
//	/* jillian's elements */
//	//socket.emit('addNewElement', {type: "site", id: "keggPathway", src: "protovisExample.html", width: 1000, height: 800 });
//	//socket.emit('addNewElement', {type: "site", id: "keggPathway", src: "http://www.gmail.com", width: 500, height: 400 });
//	//socket.emit('addNewElement', {type: "site", id: "keggPathway", src: "http://webglmol.sourceforge.jp/glmol/viewer.html", width: 1000, height: 800 });
//    socket.emit('addNewElement',  {type: "site", id: "webglExample1", src: "http://webglsamples.googlecode.com/hg/blob/blob.html", width: 1000, height: 800 });
////    socket.emit('addNewElement',  {type: "site", id: "webglExample2", src: "http://threejs.org/examples/#webgl_animation_skinning_morph", width: 1000, height: 800 });  //Good test of synchronization
//
               
               
   /* test pointer */
   socket.emit('createPointer', {type: 'ptr', id: '0', src: "resources/mouse-pointer-hi.png" });
               
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
		console.log("scroll: " + elemId);
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
	for(var f in request.files){
		console.log(request.files[f]);
		
		var uploadPath = path.dirname(request.files[f].path);
		var finalPath = path.join(uploadPath, request.files[f].name);
		fs.rename(request.files[f].path, finalPath);
		
		var localPath = finalPath.substring(__dirname.length+1);
		
		if(request.files[f].type == "image/jpeg" || request.files[f].type == "image/png" || request.files[f].type == "image/bmp"){
			gm(localPath).size(function(err, size) {
				if(!err){
					var aspect = size.width / size.height;
					var newItem = {type: "img", id: "item"+itemCount.toString(), src: localPath, left: 0, top: 0, width: size.width, height: size.height, aspectRatio: aspect};
					items.push(newItem);
					sio.sockets.emit('addNewElement', newItem);
					itemCount++;
				}
				else{
					console.log(err);
				}
			});
		}
	}
	
	response.end("upload complete");
});



// ---------------------------------------------
// DATA FROM OMICRONJS
// ADAPTED FROM LUC's omicronjs server code
// ---------------------------------------------

var net = require('net');
var util = require('util');
var dgram = require('dgram');
var sprint = require('sprint').sprint;

// Global UDP socket to the tracker server
var udp = undefined;

var tserver   = "omgtracker.evl.uic.edu";
var tport     = 28000;
var pdataPort = 9123;
var client    = net.connect(tport, tserver,  function() { //'connect' listener
                            console.log('client connected: ', tserver, tport);
                            
                    var sendbuf = util.format("data_on,%d", pdataPort);
                    console.log("OMicron> Sending handshake: ", sendbuf);
                    client.write(sendbuf);
                    
                    udp = dgram.createSocket("udp4");
                    var dstart = Date.now();
                    var emit = 0;
                    udp.on("message", function (msg, rinfo) {
                           // console.log("UDP> got: " + msg + " from " + rinfo.address + ":" + rinfo.port);
                           // var out = util.format("UDP> msg from [%s:%d] %d bytes", rinfo.address,rinfo.port,msg.length);
                           // console.log(out);
                           
                           if ((Date.now() - dstart) > 100) {
                           var offset = 0;
                           var e = {};
                           if (offset < msg.length) e.timestamp = msg.readUInt32LE(offset); offset += 4;
                           if (offset < msg.length) e.sourceId = msg.readUInt32LE(offset); offset += 4;//wandId, touchId, ptrId -- unique id for particular object
                           if (offset < msg.length) e.serviceId = msg.readInt32LE(offset); offset += 4; //denote is it touch, sage ptr or mouse
                           if (offset < msg.length) e.serviceType = msg.readUInt32LE(offset); offset += 4;//ptr, mocap, wand
                           if (offset < msg.length) e.type = msg.readUInt32LE(offset); offset += 4;//event type: click, drag, scroll
                           if (offset < msg.length) e.flags = msg.readUInt32LE(offset); offset += 4;//button flags
                           
                           if (offset < msg.length) e.posx = msg.readFloatLE(offset); offset += 4;//0-1 convert to screen dimensions
                           if (offset < msg.length) e.posy = msg.readFloatLE(offset); offset += 4;
                           if (offset < msg.length) e.posz = msg.readFloatLE(offset); offset += 4;
                           if (offset < msg.length) e.orw = msg.readFloatLE(offset); offset += 4; //none for ptr, but for wand
                           if (offset < msg.length) e.orx = msg.readFloatLE(offset); offset += 4;
                           if (offset < msg.length) e.ory = msg.readFloatLE(offset); offset += 4;
                           if (offset < msg.length) e.orz = msg.readFloatLE(offset); offset += 4;
                           if (offset < msg.length) e.extraDataType = msg.readUInt32LE(offset); offset += 4;  //eventually store string vals for ptr: color, ip address
                           if (offset < msg.length) e.extraDataItems = msg.readUInt32LE(offset); offset += 4; 
                           if (offset < msg.length) e.extraDataMask = msg.readUInt32LE(offset); offset += 4;
                           // memcpy(ed.extraData, &eventPacket[offset], EventData::ExtraDataSize);
                           
                           var r_roll  = Math.asin(2.0*e.orx*e.ory + 2.0*e.orz*e.orw);
                           var r_yaw   = Math.atan2(2.0*e.ory*e.orw-2.0*e.orx*e.orz , 1.0 - 2.0*e.ory*e.ory - 2.0*e.orz*e.orz);
                           var r_pitch = Math.atan2(2.0*e.orx*e.orw-2.0*e.ory*e.orz , 1.0 - 2.0*e.orx*e.orx - 2.0*e.orz*e.orz);
                           
                           
//                           if (e.type == 3) {//  events
//                               if (e.serviceType == 1) {  //ptr
//                                   var RAD_TO_DEGREE = 180.0/Math.PI;
//                                   var pfmt = sprint("\tp: x %6.2fm | y %6.2fm | z %6.2fm\n",
//                                                     e.posx, e.posy, e.posz); // in meters
//                                   var rfmt = sprint("\tr: p(x) %4.0f | y(y) %4.0f | r(z) %4.0f\n", // degrees
//                                                     RAD_TO_DEGREE * r_pitch, RAD_TO_DEGREE * r_yaw, RAD_TO_DEGREE * r_roll);
//                                   
//                                   if (e.sourceId == 0) {
//                                       //console.log("head> ", pfmt+rfmt);
//                                       sio.sockets.emit('head', {text: pfmt+rfmt, pos:[e.posx, e.posy, e.posz],
//                                                        rot:[RAD_TO_DEGREE * r_pitch, RAD_TO_DEGREE * r_yaw, RAD_TO_DEGREE * r_roll]});
//                                   }
//                                   if (e.sourceId == 1) {
//                                       //console.log("wand> ", pfmt+rfmt);
//                                       sio.sockets.emit('wand', {text: pfmt+rfmt, pos:[e.posx, e.posy, e.posz],
//                                                        rot:[RAD_TO_DEGREE * r_pitch, RAD_TO_DEGREE * r_yaw, RAD_TO_DEGREE * r_roll]});
//                                   }
//                                   if (e.sourceId == 2) {
//                                       //console.log("wand2> ", pfmt+rfmt);
//                                       sio.sockets.emit('wand2', {text: pfmt+rfmt, pos:[e.posx, e.posy, e.posz],
//                                                        rot:[RAD_TO_DEGREE * r_pitch, RAD_TO_DEGREE * r_yaw, RAD_TO_DEGREE * r_roll]});
//                                   }
//                                   emit++;
//                               }
//                           }
                           if( e.type == 4 ) //MOVE event is of type 4
                           {
                               if( e.serviceType == 0 ) //SAGE pointer event
                               {
                                   var pfmt = sprint("\tp: x %6.2fm | y %6.2fm | z %6.2fm\n",
                                                     e.posx, e.posy, e.posz); // in meters
                                   console.log( "pointer moved: " + e.posx + " " + e.posy);
//                           
//                              sio.sockets.emit('createPointer', {type: 'ptr', id: '1', src: "resources/cursor_arrow_48x48.png" });
//                           sio.sockets.emit('movePointer', "hi");

                           
                                   sio.sockets.emit( 'movePointer',{elemId: '0', elemLeft: e.posx, elemTop: e.posy});
                           
                           
//                                    sio.sockets.emit('TEST', "hi");
                               }
                           }
                           
                           if (emit>2) { dstart = Date.now(); emit = 0; }
                           }
                           });
                            
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
