function wallMenuUI(){
	this.element = null;
	this.ctx = null;
	this.resrcPath = null;
	
	this.minDim = null;
	
	this.centerX = 0.0;
	this.centerY = 0.0;
	this.radius = 50;
	
	this.defaultColor =  "rgba(150, 150, 150, 1.0)";
	this.mouseOverColor = "rgba(255, 0, 0, 1.0 )";
	
	this.drawColor = this.defaultColor; 
	
	this.text = "TouchUI Test:\n";
	
	this.init = function(id, date, resrc) {
		this.element = document.getElementById(id);
		this.ctx = this.element.getContext("2d");
		this.resrcPath = resrc;
		
		this.minDim = Math.min(this.element.width, this.element.height);
		
		this.testButton = new buttonWidget();
	}
	
	this.draw = function(date) {
		// clear canvas		
		this.ctx.clearRect(0,0, this.element.width, this.element.height);
		
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.1)"
		this.ctx.fillRect(0,0, this.element.width, this.element.height)
		
		this.testButton.draw( this.ctx, date);
	};
	
	this.resize = function(date) {
		this.minDim = Math.min(this.element.width, this.element.height);
		this.draw(date);
	}
	               // canvasItems[child[0].id].event( event_data.eventType, event_data.ptr_id, event_data.itemRelativeX, event_data.itemRelativeY, event_data.data);  

	this.event = function( type, ptrId, x, y, data , date){
	    if( type == "pointerPress" ){
	       if( data.button == "left" ){
				var curButton = this.testButton;
				if( x >= curButton.posX && x <= curButton.posX + curButton.width && y >= curButton.posY && y <= curButton.posY + curButton.height )
					curButton.state = 2;
	       } 
	       
	       else if( data.button == "right" ){

	       }
	    }
	    else if( type == "pointerRelease" ){
           if( data.button == "left" ){
				var curButton = this.testButton;
				if( x >= curButton.posX && x <= curButton.posX + curButton.width && y >= curButton.posY && y <= curButton.posY + curButton.height )
					curButton.state = 1;
	       } 
	       else if( data.button == "right" ){
	        
	       }
	    }
	    else if( type == "pointerMove" ){
			var curButton = this.testButton;
			if( curButton.state != 2 && x >= curButton.posX && x <= curButton.posX + curButton.width && y >= curButton.posY && y <= curButton.posY + curButton.height )
				curButton.state = 1;
			else if( this.testButton.state == 1 )
				curButton.state = 0;
				
	    }
        else if( type == "pointerDoubleClick" ){
	        
	    }
	    else if( type == "keyPressed" ) {
	        
	    }
	    else if( type == "pointerScroll" ) {
	    
	    }
	    
	    else if( type == "pointerEnter" ){
	    
	    }
	    else if( type == "pointerLeave" ){
	    
	    }

	    else if( type == "close" ){
	    
	    }
	    else if( type == "minimize" ){
	    
	    }
	    
        this.draw( date ); //redraw    
	}
}

function buttonWidget() {
	this.element = null;
	this.ctx = null;
	this.resrcPath = null;
	
	this.posX = 100;
	this.posY = 100;
	this.width = 50;
	this.height = 50;
	
	this.defaultColor =  "rgba(100, 100, 100, 1.0)";
	this.mouseOverColor = "rgba(255, 0, 0, 1.0 )";
	this.clickedColor = "rgba(0, 255, 0, 1.0 )";
	
	this.state = 0;
	
	this.init = function(id, date, resrc) {
		this.element = document.getElementById(id);
		this.ctx = this.element.getContext("2d");
		this.resrcPath = resrc;
	}
	
	this.draw = function(ctx, date) {
		if( this.state == 1 )
			ctx.fillStyle = this.mouseOverColor;
		else if( this.state == 2 )
			ctx.fillStyle = this.clickedColor;
		else
			ctx.fillStyle = this.defaultColor;
		ctx.fillRect(this.posX,this.posY, this.width, this.height)
	};
	
	this.isOver = function(id, x, y) {
		if( x >= this.posX && x <= this.posX + this.width && y >= this.posY && y <= this.posY + this.height )
			this.state = 1;
		else
			this.state = 0;
	};
}
