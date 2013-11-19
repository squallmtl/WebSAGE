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
	config.totalWidth = config.resolution.width * config.layout.columns;
	config.totalHeight = config.resolution.height * config.layout.rows;
	config.titleBarHeight = Math.round(0.03 * config.totalHeight);
	config.titleTextSize = Math.round(0.018 * config.totalHeight);
	console.log(config);
});

var itemCount = 0;//num windows 
var items = [];//windows


sio.sockets.on('connection', function(socket) {  //called every time new window manager connects and new sage pointer connects 
	var i;
	var address = socket.handshake.address;
	console.log("New connection from " + address.address + ":" + address.port);
	
	var cDate = new Date();

	console.log(cDate.getTime()-initDate.getTime()); 
	socket.emit('setSystemTime', cDate.getTime()-initDate.getTime());
	socket.emit('setupDisplayConfiguration', config); //window manager will show appropriate display config

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
               
   /* test pointer */
//    socket.emit('createPointer', {type: 'ptr', id: '0', src: "resources/mouse-pointer-hi.png" });
               
	for(i=0; i<items.length; i++){
		socket.emit('addNewElement', items[i]);  //tell window manager that just connected what is on-screen
	}
	
// 
// 	socket.on('addNewWebElement', function(elem_data) { //call this when window manager receives a new element to add
// 		if(elem_data.type == "img"){ 
// 			gm(elem_data.src).size(function(err, size) {
// 				if(!err){
// 					var aspect = size.width / size.height;
// 					var now = new Date();
// 					var newItem = {type: "img", id: "item"+itemCount.toString(), src: this.source, left: 0, top: 0, width: size.width, height: size.height, aspectRatio: aspect, date: now, resrc: "", extra: ""};
// 					items.push(newItem);  //store item in list 
// 					sio.sockets.emit('addNewElement', newItem); //emit an addNewElement, will be caught by index.html and windowManager.html
// 					itemCount++;
// 					console.log(this.source);
// 				}
// 				else{
// 					console.log("Error: " + err);
// 				}
//
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
						var itemId = "item"+itemCount.toString();
						var title = info.title;
						var aspect = 16/9;
						var now = new Date();
						var resolutionY = parseInt(info.formats[i].resolution.substring(0, info.formats[i].resolution.length-1));
						var resolutionX = resolutionY * aspect;
						var poster = info.iurlmaxres;
						if(poster == null) poster = info.iurlsd;
						var newItem = new item("video", title, itemId, info.formats[i].url, 0, 0, resolutionX, resolutionY, aspect, now, "", poster);
						items.push(newItem);
						sio.sockets.emit('addNewElement', newItem);//emit an addNewElement, will be caught by index.html and windowManager.html
						itemCount++;
						
						break;
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
		else if(elem_data.type = "site" ){
            var aspect = 16/9;
			var now = new Date();
            var newItem = new item( "site", "webpage", "item"+itemCount.toString(), elem_data.src, 0, 0, 1920, 1080, aspect, now, "", "" ); 
            //{type: "site", id: "item"+itemCount.toString(), src: elem_data.src, left: 0, top: 0, width: 1920, height: 1080, aspectRatio: aspect, date: now, resrc: "", extra: "" }
			items.push(newItem);
			sio.sockets.emit('addNewElement', newItem);//emit an addNewElement, will be caught by index.html and windowManager.html
			itemCount++;
			console.log(elem_data.src);
		}
	});
	
	/* user-interaction methods */
	var selectedMoveItem;
	var selectedScrollItem;
	var selectOffsetX;
	var selectOffsetY;

	socket.on('selectElementById', function(select_data) { //when window manager or pointer selects a window, this gets called.  
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
				var zipPath = localPath.substring(0, localPath.length-4);
				console.log("reading instructions");
// 				var instuctionsFile = zipPath + "/instructions.json";
// =======
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

var clickingMode = 0;

// //MOVE ITEM TO FRONT
// function moveItemToFront(elemId) {
// 
//     console.log("elemID to front:  " + elemId );
//     var i;
//     for(i=0; i<this.items.length; i++){
//         if(this.items[i].id == elemId){
//             tmp = this.items[i];
//             this.items.splice(i, 0);
//             this.items.push(tmp);
//             break;
//         }
//     }
//     sio.sockets.emit('itemSelected',elemId );
// 
// };

var selectedScrollItem; 
var selectedMoveItem;
var selectOffsetX;
var selectOffsetY;  

//this will be invoked on every sage pointer click 
function handleSagePointerClick(x, y, ptrId, mode){
    if( mode == 0 ){//if manipulate windows mode
        var overAnItem = moveItemToFront(x, y);  //move item to front and return the item
        if( !overAnItem )
            ptrs[ptrId].mode = 1; 
        selectedScrollItem = null;
    
        if( selectedMoveItem != null ){
            //determine distance btw event and offset 
            selectOffsetX = selectedMoveItem.left - x; 
            selectOffsetY = selectedMoveItem.top - y; 
        }
    }
    else if( mode == 1 ){ //else click inside windows mode
        clickInsideWindow(x, y, ptrId); 
    }
}

// function moveItemToFront2(x, y) {
//     console.log("x " + x + " y " + y );
//     potentialItems = []; 
//     idx = [] ;
//     for(var i=0; i<items.length; i++){
//         var l = items[i].left;
//         var w = items[i].width;
//         var t = items[i].top;
//         var h = items[i].height; 
// 		if(l < x && l+w > x && t < y && t+h > y) {   
// 		    potentialItems.push( items[i] ) ;
// 		    idx.push( i ); 
//         } 
// 	}
// 	if( potentialItems.length == 0 ){
//         console.log("change mode");
//         clickMode = 1; 
//         sio.sockets.emit("changeMode", clickMode);   
//         return;      
//     }
//     
//     if( clickMode == 1 ){
//         clickMode = 0; 
//         sio.sockets.emit("changeMode", clickMode); 
//     }
//     
//     console.log("item: " + potentialItems[0].id );
//     items.splice(idx[0], 0);
//     items.push( potentialItems[0] ); 
//     sio.sockets.emit('itemSelected', potentialItems[0].id );
//     selectedMoveItem = potentialItems[0]; 
// };

function moveItemToFront(x,y){
	var i;
	var selectedIndex;
	var selectedItem;
	
	var overAnItem = false;
	
	for(i=items.length-1; i >= 0; i--){
		var l = items[i].left;
        var w = items[i].width;
        var t = items[i].top;
        var h = items[i].height; 
		if(l < x && l+w > x && t < y && t+h > y) { 
			selectedIndex = i;
			selectedItem = items[selectedIndex];
			overAnItem = true; 
			break;
		}
	}
	for(i=selectedIndex; i<items.length-1; i++){
		items[i] = items[i+1];
	}
	items[items.length-1] = selectedItem;
	
	
	var itemIds = [];
    for(var i=0; i<items.length; i++){
        itemIds.push(items[i].id);
    }
		
    sio.sockets.emit('updateItemOrder', itemIds);

    return overAnItem; //need to know so that ptr has correct mode
}

function clickInsideWindow(x, y, pID){
    console.log("click in window " + x + " " + y +  " " + items.length);
    var now = new Date();

	var selectedIndex;
	var selectedItem;
    for(i=items.length-1; i >= 0; i--){
		var l = items[i].left;
        var w = items[i].width;
        var t = items[i].top;
        var h = items[i].height; 
        console.log("l = " + l + " l+w " + (l+w) + " t " + t + " t+h " + (t+h) );
		if(l < x && l+w > x && t < y && t+h > y) { 
		    console.log("true");
			selectedIndex = i;
			selectedItem = items[selectedIndex];
			break;
		}
	}
    console.log(selectedIndex + " " + selectedItem.id);
    sio.sockets.emit( 'processClick', {elemId: selectedItem.id, date: now, x: x, y: y, ptrId: pID } ); 
		
}

function handleSagePointerZoom(zoom, x, y){
    console.log("x " + x + " y " + y + " zoom " + zoom );
    idx = [] ;
    for(var i=0; i<items.length; i++){
        var l = items[i].left;
        var w = items[i].width;
        var t = items[i].top;
        var h = items[i].height; 
		if(l < x && l+w > x && t < y && t+h > y) { 
		    selectedScrollItem = items[i];    //not checking for z!
        } 
	}
	
	if(selectedScrollItem == null )
	    return;
	    
    zoom = 1.0 - zoom*.01; 
    var iWidth = selectedScrollItem.width * zoom;
    var iHeight = iWidth / selectedScrollItem.aspect;
    console.log( "w: " + iWidth + " h:" + iHeight );
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

}

function handleSagePointerDrag(x, y){
    console.log( "x = " + x + " y = " + y + "items[0].left" + items[0].left);
    idx = [] ;
    for(var i=0; i<items.length; i++){
        var l = items[i].left;
        var w = items[i].width;
        var t = items[i].top;
        var h = items[i].height; 
		if(l < x && l+w > x && t < y && t+h > y) { 
		    selectedMoveItem = items[i];    //not checking for z!
        } 
	}

    if(selectedMoveItem == null) 
        return;

    selectedMoveItem.left = x + selectOffsetX;
    selectedMoveItem.top = y + selectOffsetY;
    var now = new Date();
    sio.sockets.emit('setItemPosition', {elemId: selectedMoveItem.id, elemLeft: selectedMoveItem.left, elemTop: selectedMoveItem.top, date: now});
}

function releaseSelectedMoveItem(){
    selectedMoveItem = null;
}

function releaseSelectedZoomItem(){
    selectedZoomItem = null;
}

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
//                 console.log("UDP> got: " + msg + " from " + rinfo.address + ":" + rinfo.port);
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
                                console.log("pointer event! type: " + e.type  );
                                //console.log("ServiceTypePointer> source ", e.sourceId);
                                if (e.type == 3) { // update
//                                         if( e.sourceId in ptrs )
//                                             return;
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
                                        console.log("\t move ", e.posx, e.posy);
                                        if (e.sourceId in ptrs) {
                                           sio.sockets.emit( 'movePointer',{elemId: e.sourceId, elemLeft: e.posx, elemTop: e.posy});
                                           
                                           if( ptrs[e.sourceId].mouse[0] == 1 )
                                           {
                                                console.log("Drag");
                                                handleSagePointerDrag( e.posx * config.totalWidth, e.posy*config.totalHeight );
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
//                                         console.log("\t zoom ");
                                        if (e.sourceId in ptrs) {
                                                ptrs[e.sourceId].position = [e.posx, e.posy];
                                                ptrs[e.sourceId].zoom = 1;
                                                zoom = 1; 
                                                if (offset < msg.length) {
                                                        // One int for zoom value
                                                        if (e.extraDataType == 2 && e.extraDataItems == 1) {
                                                                //which elem:
                                                                
                                                        
                                                                e.extraInt = msg.readInt32LE(offset);
                                                                offset += 4
                                                                zoom = e.extraInt; 
                                                                
                                                                handleSagePointerZoom( zoom, e.posx*config.totalWidth, e.posy*config.totalHeight); 
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

                                                if( ptrs[e.sourceId].mouse[0] == 1 )
                                                {
                                                    console.log("Click");
                                                    handleSagePointerClick( e.posx * config.totalWidth, e.posy*config.totalHeight, e.sourceId );
                                                }
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

function findItemByPosition(x, y){
    console.log("x " + x + " y " + y );
    potentialItems = []; 
    for(var i=0; i<items.length; i++){
        var l = items[i].left;
        var w = items[i].width;
        var t = items[i].top;
        var h = items[i].height; 
		if(l < x && l+w > x && t < y && t+h > y) {   
		    //return items[i];
		    potentialItems.push( items[i] ); 
        }
	}
	if( potentialItems.length == 0 )
        return "0";
    return potentialItems[0].id; //must check Z as well...  
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


var keypress = require('keypress');

// make `process.stdin` begin emitting "keypress" events
keypress(process.stdin);

// listen for the "keypress" event
process.stdin.on('keypress', function (ch, key) {
  console.log('got "keypress"', key);
  if (key && key.ctrl && key.name == 'c') {
    //process.stdin.pause();
    process.exit(code =0);
  }
  
  if( key.name == 'a' ){
        clickInsideWindow( 900, 400, "0" );
  }
  
});

process.stdin.setRawMode(true);
process.stdin.resume();

// event.type must be keypress
// 
// function getChar(event) {
// 
//   if (event.which == null) {
// 
//         return String.fromCharCode(event.keyCode) // IE
// 
//   } else if (event.which!=0 && event.charCode!=0) {
// 
//         return String.fromCharCode(event.which)   // the rest
// 
//   } else {
// 
//         return null // special key
// 
//   }
// 
// }

