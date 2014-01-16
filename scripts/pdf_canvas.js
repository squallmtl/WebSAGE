function pdf_canvas() {
	this.img = null;
	this.element = null;
	this.ctx = null;
	
	this.pdfDoc = null;
	this.pageNum = 1;
	
	this.init = function(id, file) {
		this.img = document.getElementById(id);
		this.element = document.createElement("canvas");
		this.element.width = this.img.width;
		this.element.height = this.img.height;
		this.ctx = this.element.getContext("2d");
		
		//
		// Asynchronously download PDF as an ArrayBuffer
		//
		var _this = this;
		PDFJS.getDocument(file).then(function getPdfHelloWorld(_pdfDoc) {
			_this.pdfDoc = _pdfDoc;
			_this.renderPage();
		});
	};
    
	//
	// Get page info from document, resize canvas accordingly, and render page
	//
	this.renderPage = function() {
		this.element.width = this.img.width;
		this.element.height = this.img.height;
	
		// Using promise to fetch the page
		var _this = this;
		this.pdfDoc.getPage(this.pageNum).then(function(page) {
			// set the scale to match the canvas
			var viewport = page.getViewport(_this.element.width / page.getViewport(1.0).width);
			viewport.height = _this.element.height;
			viewport.width  = _this.element.width;

			// Render PDF page into canvas context
			var renderContext = {canvasContext: _this.ctx, viewport: viewport};
			page.render(renderContext).then(function() {
				_this.img.src = _this.element.toDataURL();
			});
		});
	};
	
	//
	// Go to previous page
	//
	this.goPrevious = function () {
		if(this.pageNum <= 1) return;
		this.pageNum = this.pageNum - 1;
		
		this.renderPage();
	};
	
	//
	// Go to next page
	//
	this.goNext = function () {
		if(this.pageNum >= this.pdfDoc.numPages) return;
		this.pageNum = this.pageNum + 1;
		
		this.renderPage();
	};
}
