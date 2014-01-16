function websocketIO(host, port) {
	this.ws = null;
	this.host = host;
	this.port = port;
	this.messages = {};
	
	this.open = function(callback) {
		var _this = this;
		
		console.log("ws://" + this.host + ":" + this.port);
		this.ws = new WebSocket("ws://" + this.host + ":" + this.port);
		this.ws.binaryType = "arraybuffer";
		
		this.ws.onopen = callback;
		
		this.ws.onmessage = function(msg) {
			if(typeof msg.data === "string"){
				var message = JSON.parse(msg.data);
				if(message.callbackName in _this.messages){
					_this.messages[message.callbackName](message.data);
				}
			}
			else{
				console.log("Error: message is not a binary string");
			}
		};
	};
	
	this.on = function(name, callback) {
		this.messages[name] = callback;
	};
	
	this.emit = function(name, data) {
		var message = {func: name, data: data};
		this.ws.send(JSON.stringify(message));
	};
}
