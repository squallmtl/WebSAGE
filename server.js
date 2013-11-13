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

var fs = require('fs');
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

var itemCount = 0;//num windows 
var items = [];//windows

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

//	/* adding new elements */
//	socket.emit('addNewElement', {type: "img", id: "item1", src: "images/sage_logo.jpg"});
//	socket.emit('addNewElement', {type: "img", id: "item2", src: "images/evl-logo-small.jpg"});
//	socket.emit('addNewElement', {type: "img", id: "item3", src: "images/omegalib-black.png"});
//	
//	/* jillian's elements */
//	//socket.emit('addNewElement', {type: "site", id: "keggPathway", src: "protovisExample.html", width: 1000, height: 800 });
    //socket.emit('addNewElement', {type: "site", id: "keggPathway", src: "http://www.gmail.com", width: 500, height: 400 });
//     socket.emit('addNewElement', {type: "site", id: "keggPathway", src: "http://webglmol.sourceforge.jp/glmol/viewer.html", width: 1000, height: 800 });
//     socket.emit('addNewElement', {type: "site", id: "processing.js", src: "http://www.whyi.net/geometry/Delaunay/", width: 1000, height: 800 });
//      socket.emit('addNewElement', {type: "site", id: "kinetic.js", src: "http://cheghamwassim.com/apps/js/android-lock-screen/", width: 1000, height: 800 });
//      socket.emit('addNewElement', {type: "site", id: "d3", src: "http://mbostock.github.io/d3/talk/20111018/choropleth.html", width: 1000, height: 800 });

//    socket.emit('addNewElement',  {type: "site", id: "webglExample1", src: "http://webglsamples.googlecode.com/hg/blob/blob.html", width: 1000, height: 800 });
////    socket.emit('addNewElement',  {type: "site", id: "webglExample2", src: "http://threejs.org/examples/#webgl_animation_skinning_morph", width: 1000, height: 800 });  //Good test of synchronization
//
        socket.emit('addNewElement',  {type: "site", id: "webglExample2", src: "http://threejs.org/examples/#webgl_animation_skinning_morph", width: 1000, height: 800 });  //Good test of synchronization
        items.push( 
               
   /* test pointer */
//    socket.emit('createPointer', {type: 'ptr', id: '0', src: "resources/mouse-pointer-hi.png" });
               
	for(i=0; i<items.length; i++){
		socket.emit('addNewElement', items[i]);
	}
	
	socket.on('addNewWebElement', function(elem_data) {
		if(elem_data.type == "img"){
			gm(elem_data.src).size(function(err, size) {
				if(!err){
					var aspect = size.width / size.height;
					var now = new Date();
					var newItem = {type: "img", id: "item"+itemCount.toString(), src: this.source, left: 0, top: 0, width: size.width, height: size.height, aspectRatio: aspect, date: now, resrc: "", extra: ""};
					items.push(newItem);
					sio.sockets.emit('addNewElement', newItem);
					itemCount++;
					console.log(this.source);
				}
				else{
					console.log("Error: " + err);
				}
			});
		}
		else if(elem_data.type == "youtube"){
			var aspect = 16/9;
			var now = new Date();
			var source = elem_data.src.replace("watch?v=", "embed/");
			var newItem = {type: "youtube", id: "item"+itemCount.toString(), src: source, left: 0, top: 0, width: 1920, height: 1080, aspectRatio: aspect, date: now, resrc: "", extra: ""};
			items.push(newItem);
			sio.sockets.emit('addNewElement', newItem);
			itemCount++;
			console.log(source);
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
					var newItem = {type: "img", id: "item"+itemCount.toString(), src: this.source, left: 0, top: 0, width: size.width, height: size.height, aspectRatio: aspect, date: now, resrc: "", extra: ""};
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
				var zipPath = localPath.substring(0, localPath.length-4);
				var instuctionsFile = zipPath + "/instructions.json";
				fs.readFile(instuctionsFile, 'utf8', function(err, json_str) {
					if(err){
						console.log('Error: ' + err);
						return;
					}
					var instructions = JSON.parse(json_str);
					
					// add item to clients
					var itemId = "item"+itemCount.toString();
					var className = instructions.main_script.substring(0, instructions.main_script.length-3);
					var now = new Date();
					var aspect = instructions.width / instructions.height;
					var newItem = {type: "canvas", id: itemId, src: zipPath+"/"+instructions.main_script, left: 0, top: 0, width: instructions.width, height: instructions.height, aspectRatio: aspect, date: now, resrc: zipPath+"/", extra: className};
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
var sprint = require('sprint').sprint;

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
var client    = net.connect(tport, tserver,  function() { //'connect' listener
        console.log('client connected: ', tserver, tport);

        var sendbuf = util.format("omicron_data_on,%d", pdataPort);
        console.log("OMicron> Sending handshake: ", sendbuf);
        client.write(sendbuf);

        udp = dgram.createSocket("udp4");
        var dstart = Date.now();
        var emit = 0;

        // array to hold all the button values (1 - down, 0 = up)
        var ptrs    = {};
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

                                //console.log("ServiceTypePointer> source ", e.sourceId);
                                if (e.type == 3) { // update
                                        colorpt = [Math.floor(e.posx*255.0), Math.floor(e.posy*255.0), Math.floor(e.posz*255.0)];
                                        if (offset < msg.length) {
                                                if (e.extraDataType == 4 && e.extraDataItems > 0) {
                                                        e.extraString = msg.toString("utf-8", offset, offset+e.extraDataItems);
                                                        ptrinfo = e.extraString.split(" ");
                                                        offset += e.extraDataItems;
                                                        ptrs[e.sourceId] = {id:e.sourceId, label:ptrinfo[0], ip:ptrinfo[1], mouse:[0,0,0], color:colorpt, zoom:0, position:[0,0]};
                                                        sio.sockets.emit('createPointer', {type: 'ptr', id: e.sourceId, label: ptrinfo[0], color: colorpt, zoom:0, position:[0,0], src: "resources/mouse-pointer-hi.png" });
                                                }
                                        }
                                }
                                else if (e.type == 4) { // move
                                        //console.log("\t move ", e.posx, e.posy);
                                        if (e.sourceId in ptrs) {
//                                                 ptrs[e.sourceId].position = [e.posx, e.posy];
//                                                 ptrs[e.sourceId].zoom = 0;
                                           sio.sockets.emit( 'movePointer',{elemId: e.sourceId, elemLeft: e.posx, elemTop: e.posy});
                                        }
                                }
                                else if (e.type == 15) { // zoom
//                                         sio.sockets.emit('changeMode', {mode: 1} );
                                        //console.log("\t zoom ");
                                        if (e.sourceId in ptrs) {
//                                                 ptrs[e.sourceId].position = [e.posx, e.posy];
//                                                 ptrs[e.sourceId].zoom = 1;

                                                if (offset < msg.length) {
                                                        // One int for zoom value
                                                        if (e.extraDataType == 2 && e.extraDataItems == 1) {
                                                                e.extraInt = msg.readInt32LE(offset);
                                                                offset += 4;
//                                                                 ptrs[e.sourceId].zoom = e.extraInt;
                                                            sio.sockets.emit( 'pointerScroll', {elemId: e.sourceId, elemLeft: e.posx, elemTop: e.posy, elemZoom: e.extraInt} ); 
                                                        }
                                                }
                                        }
                                }
                                else if (e.type == 5) { // button down
                                        //console.log("\t down , flags ", e.flags);
                                        if (e.sourceId in ptrs) {
//                                                 ptrs[e.sourceId].position = [e.posx, e.posy];
                                                
                                                var counter, i;
                                                for(counter=0; counter < 3; counter++)
                                                { 
                                                        i = Math.pow(2, counter);
//                                                         if (e.flags & i)
//                                                                 ptrs[e.sourceId].mouse[counter] = 1;
//                                                         else
//                                                                 ptrs[e.sourceId].mouse[counter] = 0;
                                                }
                                        }
                                }
                                else if (e.type == 6) { // button up
                                        //console.log("\t up , flags ", e.flags);
                                        if (e.sourceId in ptrs) {
//                                                 ptrs[e.sourceId].position = [e.posx, e.posy];
                                                        
//                                                 ptrs[e.sourceId].mouse[0] = 0;
//                                                 ptrs[e.sourceId].mouse[1] = 0;
//                                                 ptrs[e.sourceId].mouse[2] = 0;
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

                        if (e.type == 3) {
                                if (e.serviceType == 1) {  // ServiceTypeMocap
                                        var RAD_TO_DEGREE = 180.0/Math.PI;
                                        var pfmt = sprint("\tp: x %6.2fm | y %6.2fm | z %6.2fm\n",
                                                                e.posx, e.posy, e.posz); // in meters
                                        var rfmt = sprint("\tr: p(x) %4.0f | y(y) %4.0f | r(z) %4.0f\n", // degrees
                                                                RAD_TO_DEGREE * r_pitch, RAD_TO_DEGREE * r_yaw, RAD_TO_DEGREE * r_roll);

                                        if (e.sourceId == 0) {
                                                //console.log("head> ", pfmt+rfmt);
                                                sio.sockets.emit('head', {text: pfmt+rfmt, pos:[e.posx, e.posy, e.posz],
                                                                                                rot:[RAD_TO_DEGREE * r_pitch, RAD_TO_DEGREE * r_yaw, RAD_TO_DEGREE * r_roll]});
                                        }
                                        if (e.sourceId == 1) {
                                                //console.log("wand> ", pfmt+rfmt);
                                                sio.sockets.emit('wand', {text: pfmt+rfmt, pos:[e.posx, e.posy, e.posz],
                                                                                                rot:[RAD_TO_DEGREE * r_pitch, RAD_TO_DEGREE * r_yaw, RAD_TO_DEGREE * r_roll]});
                                        }
                                        if (e.sourceId == 2) {
                                                //console.log("wand2> ", pfmt+rfmt);
                                                sio.sockets.emit('wand2', {text: pfmt+rfmt, pos:[e.posx, e.posy, e.posz],
                                                                                                rot:[RAD_TO_DEGREE * r_pitch, RAD_TO_DEGREE * r_yaw, RAD_TO_DEGREE * r_roll]});
                                        }
                                        emit++;
                                }
                        }
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
