function pdf() {

    this.element = null;
    this.ctx = null;
    this.resrcPath = null;

    this.pdfDoc = null;
    this.pageNum = 1;
    
    this.startDate = null;
    this.prevDate = null;
    this.frame = null;

    this.init = function (id, date, resrc) {
        this.element = document.getElementById(id);
        this.ctx = this.element.getContext("2d");
        this.resrcPath = resrc;
        this.pdfdocument = this.resrcPath + "doc/test.pdf";
        console.log("Document: ", this.pdfdocument);
        var _this = this;

        this.startDate = date;
        this.prevDate = date;
        this.frame = 0;

        //
        // Asynchronously download PDF as an ArrayBuffer
        //
        PDFJS.getDocument(this.pdfdocument).then(function getPdfHelloWorld(_pdfDoc) {
            _this.pdfDoc = _pdfDoc;
            _this.renderPage(_this.pageNum);
        });
    };

    this.draw = function (date) {
        var t = (date.getTime() - this.startDate.getTime()) / 1000; // total time since start of program (sec)
        var dt = (date.getTime() - this.prevDate.getTime()) / 1000; // delta time since last frame (sec)

        // clear canvas     
        //this.ctx.clearRect(0,0, this.element.width, this.element.height);

        // Render the PDF
        this.renderPage(this.pageNum);

        // update time variables
        this.prevDate = date;
        this.frame++;
   };

   this.key = function(keycode) {
        // keycode 37: left -> previous
        // keycode 39: right -> next
        // keycode 38: up -> home
        // keycode 40: down -> last
        switch(keycode)
        {
        case 37:
            this.goPrevious();
            break;
        case 38:
            this.pageNum = 1;
            break;
        case 39:
            this.goNext();
            break;
        case 40:
            this.pageNum = this.pdfDoc.numPages;
            break;
        default:
            console.log("Keycode: unprocessed");
        }
        // Render the PDF
        this.renderPage(this.pageNum);
   };

    //
    // Go to previous page
    //
    this.goPrevious = function () {
        if (this.pageNum <= 1)
            return;
        this.pageNum = this.pageNum - 1;
    };

    //
    // Go to next page
    //
    this.goNext = function () {
        if (this.pageNum >= this.pdfDoc.numPages)
            return;
        this.pageNum = this.pageNum + 1;
    };

    //
    // Get page info from document, resize canvas accordingly, and render page
    //
    this.renderPage = function (num) {
        // Using promise to fetch the page
        var _this = this;
        this.pdfDoc.getPage(num).then(function (page) {
            // set the scale to match the canvas
            var viewport = page.getViewport(_this.element.width / page.getViewport(1.0).width);

            viewport.height = _this.element.height;
            viewport.width  = _this.element.width;

            // Render PDF page into canvas context
            var renderContext = {
                canvasContext: _this.ctx,
                viewport: viewport
            };
            page.render(renderContext);
        });
    };

}
