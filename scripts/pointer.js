function pointer(){
	this.element = null;
	this.ctx = null;
	this.label = "";
	this.color = "rgba(255, 255, 255, 1.0)";
	
	this.pointerOffset = null;
	
	this.init = function(id, label, color) {
		this.element = document.getElementById(id);
		this.ctx = this.element.getContext("2d");
		
		this.label = label;
		this.color = "rgba(" + color[0].toString() + "," + color[1].toString() + "," + color[2].toString() + ",1.0)"; 
		
		this.pointerOffset = [0.0, 0.0];
	}
	
	this.setColor = function(color){
	    this.color = "rgba(" + color[0].toString() + "," + color[1].toString() + "," + color[2].toString() + ",1.0)"; 
	}
	
	this.setLabel = function(label){
	    this.label = label;
	}
	
	this.draw = function() {
		// clear canvas		
		this.ctx.clearRect(0,0, this.element.width, this.element.height);
		
		var minDim = Math.min(this.element.width, this.element.height);
		
		this.pointerOffset[0] = Math.round(0.025384*minDim); 
		this.pointerOffset[1] = Math.round(0.060805*minDim);
		
		// pointer
		this.ctx.lineWidth = (3.0/100.0) * minDim;
		this.ctx.fillStyle = this.color; //"rgba(164, 76, 199, 1.0)";
		this.ctx.strokeStyle = "rgba(0, 0, 0, 1.0)";
		this.ctx.lineJoin = "round";
		this.ctx.beginPath();
		this.ctx.moveTo(0.025384*minDim, 0.934002*minDim);
		this.ctx.lineTo(0.025384*minDim, 0.060805*minDim);
		this.ctx.lineTo(0.665052*minDim, 0.649706*minDim);
		this.ctx.lineTo(0.284297*minDim, 0.654782*minDim);
		this.ctx.lineTo(0.025384*minDim, 0.934002*minDim);
		this.ctx.closePath();
		this.ctx.fill();
		this.ctx.stroke();
		
		// name
		var name = this.label; 
		var size = Math.round(0.2*minDim);
		this.ctx.font = size.toString() + "pt Arial";
		var metrics = this.ctx.measureText(name);
		var textWidth = metrics.width;
		var textHeight = metrics.height;
      
		this.ctx.lineWidth = 1.5*size;
		this.ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
		this.ctx.lineCap = "round";   
		this.ctx.beginPath();
		this.ctx.moveTo(0.80*minDim, 0.81*minDim);
		this.ctx.lineTo(0.80*minDim+textWidth, 0.81*minDim);
		this.ctx.moveTo(0.80*minDim, 0.81*minDim);
		this.ctx.closePath();
		this.ctx.stroke();
		
		this.ctx.textAlign = "left";
		this.ctx.fillStyle = "rgba(255, 255, 255, 1.0)";
		this.ctx.fillText(name, 0.80*minDim, 0.80*minDim+(size/2));
	};
}
