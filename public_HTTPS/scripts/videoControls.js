function videoControls(){
	this.element = null;
	this.ctx = null;
	this.resrcPath = null;
	
	this.init = function(id) {
		this.element = document.getElementById(id);
		this.ctx = this.element.getContext("2d");
	};
	
	this.draw = function() {
		// clear canvas		
		this.ctx.clearRect(0,0, this.element.width, this.element.height);
		
		this.ctx.fillStyle = "rgba(0, 0, 0, 1.0)"
		this.ctx.fillRect(0,0, this.element.width, this.element.height)
		
		var spacing = 0.8*this.element.height;
		
		// play button
		this.ctx.lineWidth = 0.05 * this.element.height;
		this.ctx.fillStyle = "rgba(255, 255, 255, 1.0)";
		this.ctx.strokeStyle = "rgba(128, 128, 128, 1.0)";
		this.ctx.lineJoin = "round";
		this.ctx.beginPath();
		this.ctx.moveTo(spacing, 0.85*this.element.height);
		this.ctx.lineTo(spacing, 0.15*this.element.height);
		this.ctx.lineTo(2*spacing, 0.50*this.element.height);
		this.ctx.lineTo(spacing, 0.85*this.element.height);
		this.ctx.closePath();
		this.ctx.fill();
		this.ctx.stroke();
		
		// time
		var time = "MM:SS / MM:SS";
		var size = Math.round(0.75 * this.element.height);
		this.ctx.font = size.toString() + "px Arial";
		var metrics = this.ctx.measureText(time);
		var textWidth = metrics.width;
		var textHeight = metrics.height;
		this.ctx.textAlign = "left";
		this.ctx.fillStyle = "rgba(255, 255, 255, 1.0)";
		this.ctx.fillText(time, this.element.width - textWidth - spacing, 0.40*this.element.height+(size/2));
		
		// progress bar
		this.ctx.lineWidth = 0.25 * this.element.height;
		this.ctx.strokeStyle = "rgba(255, 255, 255, 1.0)";
		this.ctx.lineCap = "round";   
		this.ctx.beginPath();
		this.ctx.moveTo(3*spacing, 0.50*this.element.height);
		this.ctx.lineTo(this.element.width - textWidth - (2*spacing), 0.50*this.element.height);
		this.ctx.moveTo(3*spacing, 0.50*this.element.height);
		this.ctx.closePath();
		this.ctx.stroke();
	};
}
