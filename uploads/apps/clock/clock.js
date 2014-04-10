function clock(){};
clock.prototype = new sageApp;
clock.prototype.init = function(id, date, resrc) {
	//this.element = document.getElementById(id);
	//this.ctx = this.element.getContext("2d");
	//this.resrcPath = resrc;
	console.log("this!!!");
	console.log(id);
	this.appInit(id,date,resrc);
	this.minDim = Math.min(this.element.width, this.element.height);
	this.ctx.fillStyle = "rgba(255, 255, 255, 1.0)";
	this.enableControls = true;

	this.controls.addButton({type:"play-pause", align:"left", action:function(appObj){
		appObj.ctx.fillStyle = "rgba(200, 155, 255, 1.0)";
	}});
	this.controls.addButton({type:"play-stop", align:"right", action:function(appObj){
		appObj.ctx.fillStyle = "rgba(120, 155, 200, 1.0)";
	}});
	this.controls.addButton({type:"prev", align:"center", action:function(appObj){
		appObj.ctx.fillStyle = "rgba(200, 180, 100, 1.0)";
	}});
	this.controls.addButton({type:"next", align:"left", action:function(appObj){
		appObj.ctx.fillStyle = "rgba(160, 200, 255, 1.0)";
	}});
}
	
clock.prototype.draw = function(date) {
	// clear canvas		
	this.ctx.clearRect(0,0, this.element.width, this.element.height);
	
	this.ctx.fillRect(0,0, this.element.width, this.element.height);
	
	var radius = 0.95 * this.minDim / 2;
	var centerX = this.element.width / 2;
	var centerY = this.element.height / 2;
	
	// outside of clock
	this.ctx.lineWidth = (3.0/100.0) * this.minDim;
	this.ctx.strokeStyle = "rgba(85, 100, 120, 1.0)";
	this.ctx.beginPath();
	this.ctx.arc(centerX, centerY, radius, 0, Math.PI*2);
	this.ctx.closePath();
	this.ctx.stroke();
	
	// tick marks
	var theta = 0;
	var distance = radius * 0.90; // 90% from the center
	var x = 0;
	var y = 0;
	
	// second dots
	this.ctx.lineWidth = (0.5/100.0) * this.minDim;
	this.ctx.strokeStyle = "rgba(20, 50, 120, 1.0)";
    
	for(var i=0; i<60; i++){
		// calculate theta
		theta = theta + (6 * Math.PI/180);
		// calculate x,y
		x = centerX + distance * Math.cos(theta);
		y = centerY + distance * Math.sin(theta);
		
		this.ctx.beginPath();
		this.ctx.arc(x, y, (1.0/100.0) * this.minDim, 0, Math.PI*2);
		this.ctx.closePath();
		this.ctx.stroke();
    }
    
    // hour dots
    this.ctx.lineWidth = (2.5/100.0) * this.minDim;
    this.ctx.strokeStyle = "rgba(20, 50, 120, 1.0)";
    
    for(var i=0; i<12; i++){
        // calculate theta
        theta = theta + (30 * Math.PI/180);
        // calculate x,y
        x = centerX + distance * Math.cos(theta);
        y = centerY + distance * Math.sin(theta);
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, (1.0/100.0) * this.minDim, 0, Math.PI*2, true);
        this.ctx.closePath();
        this.ctx.stroke();
    }
    
	// second hand
	var handSize = radius * 0.80; // 80% of the radius
    var sec = date.getSeconds();
    
    theta = (6 * Math.PI / 180);
    x = centerX + handSize * Math.cos(sec*theta - Math.PI/2);
    y = centerY + handSize * Math.sin(sec*theta - Math.PI/2);
    
    this.ctx.lineWidth = (1.0/100.0) * this.minDim;
    this.ctx.strokeStyle = "rgba(70, 35, 50, 1.0)";
    this.ctx.lineCap = "round";
        
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(centerX, centerY);
    this.ctx.moveTo(x, y);
    this.ctx.closePath();
    this.ctx.stroke();
    
    // minute hand
    handSize = radius * 0.60; // 60% of the radius
    var min = date.getMinutes();
    
    theta = (6 * Math.PI / 180);
    x = centerX + handSize * Math.cos((min+sec/60.0)*theta - Math.PI/2);
    y = centerY + handSize * Math.sin((min+sec/60.0)*theta - Math.PI/2);
    
    this.ctx.lineWidth = (1.5/100.0) * this.minDim;
    this.ctx.strokeStyle = "rgba(70, 35, 50, 1.0)";
    this.ctx.lineCap = "round";
        
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(centerX, centerY);
    this.ctx.moveTo(x, y);
    this.ctx.closePath();
    this.ctx.stroke();
    
    // hour hand
    handSize = radius * 0.40; // 40% of the radius
    var hour = date.getHours();
    
    theta = (30 * Math.PI / 180);
    x = centerX + handSize * Math.cos((hour+min/60.0) * theta - Math.PI/2);
    y = centerY + handSize * Math.sin((hour+min/60.0) * theta - Math.PI/2);
    
    this.ctx.lineWidth = (2.0/100.0) * this.minDim;
    this.ctx.strokeStyle = "rgba(70, 35, 50, 1.0)";
    this.ctx.lineCap = "round";
        
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(centerX, centerY);
    this.ctx.moveTo(x, y);
    this.ctx.closePath();
    this.ctx.stroke();
};
	
clock.prototype.resize = function(date) {
	this.minDim = Math.min(this.element.width, this.element.height);
	this.draw(date);
	console.log(this.controls.enumerate());
};
