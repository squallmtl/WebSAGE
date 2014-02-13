import json, base64, StringIO, urllib, cStringIO, sys
from twisted.internet import reactor, threads
from twisted.internet.threads import deferToThread
#from pyvirtualdisplay import Display
from twisted.internet import reactor
from autobahn.twisted.websocket import WebSocketClientFactory, \
                               WebSocketClientProtocol, \
                               connectWS
import libwebBrowser, pygame, time, Queue

id = ""
url = ""
width = None
height = None

#display = Display(visible=0, size=(800, 600))
#display.start()


class WebBrowserClientProtocol(WebSocketClientProtocol):

    doLoop = True
    mWidth = None
    mHeight = None
    nWidth = None
    nHeight = None
    totalWidth = None
    totalHeight = None
    p = Queue.Queue()


    def onOpen(self):
        msg = json.dumps({"data":{"clientType":"app"}, "func":"addClient", "callbackName": "done"})
        self.sendMessage(msg)

    def onMessage(self, msg, binary):
        msg = json.loads(msg)

        if 'setupDisplayConfiguration' in msg['callbackName']:
	    _width = int(round(msg['data']['totalWidth']))
	    _height = int(round(msg['data']['totalHeight']))
            rows = int(msg['data']['layout']['rows'])
            columns = int(msg['data']['layout']['columns'])
            self.totalWidth = _width * columns
            self.totalHeight = _height * rows
        elif 'initialize' in msg['callbackName']:
            threads.deferToThread(self.refreshPage, self.streamWebpage)
        elif 'deleteElement' in msg['callbackName']:
            if id in msg['data']:
                self.kill()

        #if 'id' in msg['data']:
        #    if id != msg['data']['id']:
        #        return

        
        if 'eventInItem' in msg['callbackName']:
	    if 'elemId' in msg['data']:
		if id != msg['data']['elemId']:
		    return
            
	    if 'pointerPress' in msg['data']['eventType']:
                x = int(round(msg['data']['itemRelativeX']))
                y = int(round(msg['data']['itemRelativeY']))
                self.p.put({'x': x, 'y': y})
        elif 'setItemPositionAndSize' in msg['callbackName']:
            if 'elemId' in msg['data']:
		if id != msg['data']['elemId']:
		    return
            self.nWidth = int(round(msg['data']['elemWidth']))
            self.nHeight = int(round(msg['data']['elemHeight']))

    def refreshPage(self, f):
        self.mWidth = int(width)
        self.mHeight = int(height)
        self.nWidth = int(width)
        self.nHeight = int(height)
        b = libwebBrowser.Browser(url, self.totalWidth, self.totalHeight)
        b.resize(self.mWidth, self.mHeight)
        pygame.init()
        clock = pygame.time.Clock()

        while self.doLoop:
            if not self.p.empty():
                click = self.p.get()
                b.click(click['x'], click['y'])

            s = b.getScreenshot()
            #reactor.callFromThread(f, s)
            msg = json.dumps({"data":{"id":id, "src": s}, "func":"updateWebpageStreamFrame", "callbackName": "done"})
            start = time.time()
            self.sendMessage(msg)
            end = time.time()
            #print "Time2 to calculate screenshot: %f sec " %(end - start)

            # resize!
 	    if self.mWidth != self.nWidth or self.mHeight != self.nHeight:
		_height = self.nHeight
		_width = self.nWidth
            	if self.nHeight > self.totalHeight:
	            _height = self.totalHeight
 	    	if self.nWidth > self.totalHeight:
                    _width = self.totalWidth
                    
		b.resize(_width, _height)
                self.mWidth = self.nWidth
                self.mHeight = self.nHeight


            clock.tick(30)

    def streamWebpage(self, screenshot):
        msg = json.dumps({"data":{"id":id, "src": screenshot}, "func":"updateWebpageStreamFrame", "callbackName": "done"})
        start = time.time()
        self.sendMessage(msg)
        end = time.time()
        print "Time to calculate screenshot: %f sec " %(end - start)

    def onClose(self, wasClean, code, reason):
        self.doLoop = False
        reactor.disconnectAll()
        #display.stop()

    def kill(self):
        self.doLoop = False
        reactor.stop()

if __name__ == "__main__":
    id = sys.argv[1]
    url = sys.argv[2]
    width = int(sys.argv[3])
    height = int(sys.argv[4])
    factory = WebSocketClientFactory("ws://localhost:9091", debug = False)
    factory.protocol = WebBrowserClientProtocol
    connectWS(factory)
    reactor.run()
