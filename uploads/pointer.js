//WS: width=400
//WS: height=200
//WS: animation=none

function pointer(){
	this.element = null;
	this.ctx = null;
	
	this.init = function(id) {
		this.element = document.getElementById(id);
		this.ctx = this.element.getContext("2d");
	}
	
	this.draw = function() {
		// clear canvas		
		this.ctx.clearRect(0,0, this.element.width, this.element.height);
		
		//this.ctx.fillStyle = "rgba(255, 255, 255, 255)";
		//this.ctx.fillRect(0,0, this.element.width, this.element.height);
		
		var minDim = Math.min(this.element.width, this.element.height);
		
		// pointer
		this.ctx.lineWidth = (3.0/100.0) * minDim;
		this.ctx.fillStyle = "rgba(164, 76, 199, 1.0)"
		this.ctx.strokeStyle = "rgba(0, 0, 0, 1.0)";
		this.ctx.lineJoin = "round";
		this.ctx.beginPath();
		this.ctx.moveTo(0.20*minDim, 0.90*minDim);
		this.ctx.lineTo(0.20*minDim, 0.10*minDim);
		this.ctx.lineTo(0.80*minDim, 0.60*minDim);
		this.ctx.lineTo(0.43*minDim, 0.58*minDim);
		this.ctx.lineTo(0.20*minDim, 0.90*minDim);
		this.ctx.closePath();
		this.ctx.fill();
		this.ctx.stroke();
		
		// name
		var name = "Thomas";
		var size = Math.round(0.15*minDim);
		this.ctx.font = size.toString() + "pt Arial";
		var metrics = this.ctx.measureText(name);
		var textWidth = metrics.width;
		var textHeight = metrics.height;
      
		this.ctx.lineWidth = 1.4*size;
		this.ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
		this.ctx.lineCap = "round";   
		this.ctx.beginPath();
		this.ctx.moveTo(0.80*minDim, 0.80*minDim);
		this.ctx.lineTo(0.80*minDim+textWidth, 0.80*minDim);
		this.ctx.moveTo(0.80*minDim, 0.80*minDim);
		this.ctx.closePath();
		this.ctx.stroke();
		
		this.ctx.textAlign = "left";
		this.ctx.fillStyle = "rgba(255, 255, 255, 1.0)";
		this.ctx.fillText(name, 0.80*minDim, 0.80*minDim+(size/2));
	};
}
