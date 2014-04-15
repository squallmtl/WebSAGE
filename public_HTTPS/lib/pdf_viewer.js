var pdf_viewer = SAGE2_App.extend( {
	construct: function() {
		this.resizeEvents = "onfinish";
		
		this.src = null;
		this.canvas = null;
		this.ctx = null;
		
		this.loaded = null;
		this.pdfDoc = null;
		this.pageNum = 1;
	},
	
	init: function(id, width, height, resrc, date) {
		// call super-class 'init'
		arguments.callee.superClass.init.call(this, id, "img", width, height, resrc, date);
		
		// application specific 'init'
		this.canvas = document.createElement("canvas");
		this.canvas.width = this.element.width;
		this.canvas.height = this.element.height;
		this.ctx = this.canvas.getContext("2d");
		
		this.loaded = false;
	},
	
	load: function(data, date) {
		var _this = this;
		PDFJS.getDocument(data.src).then(function getPdfHelloWorld(_pdfDoc) {
			_this.pdfDoc = _pdfDoc;
			_this.loaded = true;
			_this.draw(date);
		});
	},
	
	draw: function(date) {
		// call super-class 'preDraw'
		arguments.callee.superClass.preDraw.call(this, date);
		
		// application specific 'draw'
		if(!this.loaded) return;
		
		var _this = this;
		this.pdfDoc.getPage(this.pageNum).then(function(page) {
			// set the scale to match the canvas
			var viewport = page.getViewport(_this.canvas.width / page.getViewport(1.0).width);
			viewport.height = _this.canvas.height;
			viewport.width  = _this.canvas.width;

			// Render PDF page into canvas context
			var renderContext = {canvasContext: _this.ctx, viewport: viewport};
			page.render(renderContext).then(function() {
				_this.element.src = _this.canvas.toDataURL();
			});
		});
		
		// call super-class 'postDraw'
		arguments.callee.superClass.postDraw.call(this, date);
	},
	
	resize: function(date) {
		this.canvas.width = this.element.width;
		this.canvas.height = this.element.height;
		
		this.draw(date);
	},
	
	event: function(eventType, userId, x, y, data, date) {
		// Left Arrow - go back
		// Right Arrow - go forward
		/*
		this.goBack = function () {
			if(this.pageNum <= 1) return;
			this.pageNum = this.pageNum - 1;
		
			this.renderPage();
		};
		
		this.goForward = function () {
			if(this.pageNum >= this.pdfDoc.numPages) return;
			this.pageNum = this.pageNum + 1;
		
			this.renderPage();
		};
		*/
	}
});
