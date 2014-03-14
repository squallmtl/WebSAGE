import ctypes, os, sys
libcef_so = os.path.join(os.path.dirname(
        os.path.abspath(__file__)), 'libcef.so')
if os.path.exists(libcef_so):
    # Import local module
    ctypes.CDLL(libcef_so, ctypes.RTLD_GLOBAL)
    if 0x02070000 <= sys.hexversion < 0x03000000:
        import cefpython_py27 as cefpython
    else:
        raise Exception("Unsupported python version: %s" % sys.version)
else:
    # Import from package
    from cefpython3 import cefpython

import json, base64, StringIO, urllib, cStringIO, sys
from twisted.internet import reactor, threads
from twisted.internet.threads import deferToThread
from pyvirtualdisplay import Display
from twisted.internet import reactor
from autobahn.twisted.websocket import WebSocketClientFactory, \
                               WebSocketClientProtocol, \
                               connectWS

from PIL import Image

id = ""
display = Display(visible=0, size=(800, 600))
display.start()

class WebBrowserClientProtocol(WebSocketClientProtocol):

    def onOpen(self):
        print "Opening!"
        msg = json.dumps({"data":{"clientType":"app"}, "func":"addClient", "callbackName": "done"})
        self.sendMessage(msg)
        self.start_cef()

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
        #while True:
            #s = driver.get_screenshot_as_base64()
            #reactor.callFromThread(f, s)
        print "frame"

    def streamWebpage(self, screenshot):
        msg = json.dumps({"data":{"id":id, "src": screenshot}, "func":"updateWebpageStreamFrame", "callbackName": "done"})
        self.sendMessage(msg)

    def onClose(self, wasClean, code, reason):
        reactor.stop()
        reactor.disconnectAll()
        display.stop()

    def kill(self):
        reactor.stop()
        reactor.disconnectAll()
        display.stop()

    def start_cef(self):
        '''Starts CEF.
        '''
        print "Starting CEF"
        #configure cef
        settings = {
            "debug": True, # cefpython debug messages in console and in log_file
            "log_severity": cefpython.LOGSEVERITY_INFO,
            "log_file": "debug.log",
            "release_dcheck_enabled": True, # Enable only when debugging.
            # This directories must be set on Linux
            "locales_dir_path": cefpython.GetModuleDirectory()+"/locales",
            "resources_dir_path": cefpython.GetModuleDirectory(),
            "browser_subprocess_path": "%s/%s" % (cefpython.GetModuleDirectory(), "subprocess")}

        #start idle
        #Clock.schedule_interval(self._cef_mes, 0)

        #init CEF
        cefpython.Initialize(settings)

        #WindowInfo offscreen flag
        windowInfo = cefpython.WindowInfo()
        windowInfo.SetAsOffscreen(0)

        #Create Broswer and naviagte to empty page <= OnPaint won't get called yet
        browserSettings = {}
        # The render handler callbacks are not yet set, thus an
        # error report will be thrown in the console (when release
        # DCHECKS are enabled), however don't worry, it is harmless.
        # This is happening because calling GetViewRect will return
        # false. That's why it is initially navigating to "about:blank".
        # Later, a real url will be loaded using the LoadUrl() method
        # and the GetViewRect will be called again. This time the render
        # handler callbacks will be available, it will work fine from
        # this point.
        # --
        # Do not use "about:blank" as navigateUrl - this will cause
        # the GoBack() and GoForward() methods to not work.
        self.browser = cefpython.CreateBrowserSync(windowInfo, browserSettings, navigateUrl="http://www.google.com")

        #set focus
        self.browser.SendFocusEvent(True)

        self._client_handler = ClientHandler(self)
        self.browser.SetClientHandler(self._client_handler)
        self.set_js_bindings()

        #Call WasResized() => force cef to call GetViewRect() and OnPaint afterwards
        self.browser.WasResized()

        # The browserWidget instance is required in OnLoadingStateChange().
        self.browser.SetUserData("browserWidget", self)

        # Clock.schedule_once(self.change_url, 5)
        self.browser.Navigate("http://www.google.com/")

    _client_handler = None
    _js_bindings = None

    def set_js_bindings(self):
        if not self._js_bindings:
            self._js_bindings = cefpython.JavascriptBindings(
                bindToFrames=True, bindToPopups=True)
            #self._js_bindings.SetFunction("__kivy__request_keyboard",
            #        self.request_keyboard)
            #self._js_bindings.SetFunction("__kivy__release_keyboard",
            #        self.release_keyboard)
        self.browser.SetJavascriptBindings(self._js_bindings)



class ClientHandler:

    def __init__(self, browserWidget):
        self.browserWidget = browserWidget
        print "Initializing ClientHandler"

    def OnLoadStart(self, browser, frame):
        browserWidget = browser.GetUserData("browserWidget")
        if browserWidget and browserWidget.keyboard_mode == "local":
            print("OnLoadStart(): injecting focus listeners for text controls")

    def OnLoadEnd(self, browser, frame, httpStatusCode):
        # Browser lost its focus after the LoadURL() and the
        # OnBrowserDestroyed() callback bug. When keyboard mode
        # is local the fix is in the request_keyboard() method.
        # Call it from OnLoadEnd only when keyboard mode is global.
        browserWidget = browser.GetUserData("browserWidget")
        if browserWidget and browserWidget.keyboard_mode == "global":
            browser.SendFocusEvent(True)


    def OnLoadingStateChange(self, browser, isLoading, canGoBack, canGoForward):
        print("OnLoadingStateChange(): isLoading = %s" % isLoading)
        browserWidget = browser.GetUserData("browserWidget")


    def OnPaint(self, browser, paintElementType, dirtyRects, buffer, width, height):
        print "OnPaint()"
        if paintElementType != cefpython.PET_VIEW:
            print "Popups aren't implemented yet"
            return

        #update buffer
        buffer = buffer.GetString(mode="bgra", origin="top-left")
        print("OnPaint")

        #update texture of canvas rectangle

        return True


    def GetViewRect(self, browser, rect):
        width, height = 800, 800
        rect.append(0)
        rect.append(0)
        rect.append(width)
        rect.append(height)
        # print("GetViewRect(): %s x %s" % (width, height))
        return True


if __name__ == "__main__":
    id = sys.argv[1]
    url = sys.argv[2]
    #driver.get(url)
    factory = WebSocketClientFactory("ws://localhost:9091", debug = False)
    factory.protocol = WebBrowserClientProtocol
    connectWS(factory)
    reactor.run()
