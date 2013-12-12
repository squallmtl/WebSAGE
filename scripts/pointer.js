function pointer(){
	this.element = null;
	this.ctx = null;
	this.label = "";
	this.givenColor = "rgba(255, 255, 255, 1.0)";
	this.drawMode = null; 
	
	this.init = function(id, label, color) {
		this.element = document.getElementById(id);
		this.ctx = this.element.getContext("2d");
		
		this.label = label;
		this.givenColor = "rgba(" + color[0].toString() + "," + color[1].toString() + "," + color[2].toString() + ",1.0)"; 
		
		this.pointerOffset = [0.0, 0.0];
		this.drawMode = 0; 
	}
	
	this.setColor = function(color){
	    this.givenColor = "rgba(" + color[0].toString() + "," + color[1].toString() + "," + color[2].toString() + ",1.0)";
	}
	
	this.setLabel = function(label){
	    this.label = label;
	}
	
	this.changeMode = function(mode){
	    this.drawMode = mode;
	}
	
	this.draw = function() {
		// clear canvas		
		this.ctx.clearRect(0,0, this.element.width, this.element.height);
		
		var minDim = Math.min(this.element.width, this.element.height);
		
		// pointer
		this.ctx.lineWidth = (3.0/100.0) * minDim;
		if( this.drawMode == 0 ){
            this.ctx.fillStyle = this.givenColor;
            this.ctx.strokeStyle = "rgba(0, 0, 0, 1.0)";
        }
        else if(this.drawMode == 1){
            this.ctx.fillStyle = "rgba(0, 0, 0, 1.0)";
            this.ctx.strokeStyle = this.givenColor;
        }
		this.ctx.lineJoin = "round";
		this.ctx.beginPath();
		this.ctx.moveTo(0.025384*minDim, 0.934002*minDim);
		this.ctx.lineTo(0.025384*minDim, 0.060805*minDim);
		this.ctx.lineTo(0.665052*minDim, 0.649706*minDim);
		this.ctx.lineTo(0.282297*minDim, 0.649706*minDim);
		this.ctx.lineTo(0.025384*minDim, 0.934002*minDim);
		this.ctx.closePath();
		this.ctx.fill();
		this.ctx.stroke();
		
		// name
		var name = this.label; 
		var size = Math.round(0.22*minDim);
		this.ctx.font = size.toString() + "pt Arial";
		var metrics = this.ctx.measureText(name);
		var textWidth = metrics.width;
		var textHeight = metrics.height;
      
		this.ctx.lineWidth = 1.6*size;
		this.ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
		this.ctx.lineCap = "round";   
		this.ctx.beginPath();
		this.ctx.moveTo(0.82*minDim, 0.80*minDim);
		this.ctx.lineTo(0.82*minDim+textWidth, 0.80*minDim);
		this.ctx.moveTo(0.82*minDim, 0.80*minDim);
		this.ctx.closePath();
		this.ctx.stroke();
		
		this.ctx.textAlign = "left";
		this.ctx.fillStyle = "rgba(255, 255, 255, 1.0)";
		this.ctx.fillText(name, 0.82*minDim, 0.80*minDim+(0.4*size));
		
		console.log("finished draw");
	};
}