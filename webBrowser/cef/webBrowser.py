import json, base64, StringIO, urllib, cStringIO, sys
from twisted.internet import reactor, threads
from twisted.internet.threads import deferToThread
#from pyvirtualdisplay import Display
from twisted.internet import reactor
from autobahn.twisted.websocket import WebSocketClientFactory, \
                               WebSocketClientProtocol, \
                               connectWS
import libwebBrowser
from PIL import Image

id = ""
#display = Display(visible=0, size=(800, 600))
#display.start()

b = libwebBrowser.Browser()

class WebBrowserClientProtocol(WebSocketClientProtocol):

    doLoop = True

    def onOpen(self):
        msg = json.dumps({"data":{"clientType":"app"}, "func":"addClient", "callbackName": "done"})
        self.sendMessage(msg)

    def onMessage(self, msg, binary):
        msg = json.loads(msg)
        print msg
        if 'address' in msg['data']:
            threads.deferToThread(self.refreshPage, self.streamWebpage)
        elif 'eventInItem' in msg['callbackName']:
            if msg['data']['eventType'] is 'pointerPress':
                x = msg['data']['itemRelativeX']
                y = msg['data']['itemRelativeY']

    def refreshPage(self, f):
        while self.doLoop:
            b.getScreenshot()
        #s = driver.get_screenshot_as_base64()
        #reactor.callFromThread(f, s)

    def streamWebpage(self, screenshot):
        msg = json.dumps({"data":{"id":id, "src": screenshot}, "func":"updateWebpageStreamFrame", "callbackName": "done"})
        self.sendMessage(msg)

    def onClose(self, wasClean, code, reason):
        self.doLoop = False
        reactor.stop()
        reactor.disconnectAll()
        #display.stop()

    def kill(self):
        self.doLoop = False
        reactor.stop()
        reactor.disconnectAll()
        #display.stop()

if __name__ == "__main__":
    id = sys.argv[1]
    url = sys.argv[2]
    #driver.get(url)
    factory = WebSocketClientFactory("ws://localhost:9091", debug = False)
    factory.protocol = WebBrowserClientProtocol
    connectWS(factory)
    reactor.run()
