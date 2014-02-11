#include <iostream>
#include <boost/python.hpp>

#include <cef_app.h>
#include <cef_client.h>
#include <cef_render_handler.h>

using namespace boost::python;

class RenderHandler : public CefRenderHandler {
public:

    bool GetViewRect(CefRefPtr<CefBrowser> browser, CefRect &rect) {
        std::cout << "Setting windowRect" << std::endl;
        rect = CefRect(0, 0, 800, 800);
        return true;
    }

    virtual void OnPaint(CefRefPtr<CefBrowser> browser, PaintElementType type, const RectList &dirtyRects, const void *buffer, int width, int height) {
        //memcpy(texBuf->getCurrentLock().data, buffer, width*height*4);
        std::cout << "Painting!" << std::endl;
    }

// CefBase interface
public:
    IMPLEMENT_REFCOUNTING(RenderHandler);
};

class BrowserClient : public CefClient, public CefLifeSpanHandler, public CefRenderHandler{
private:
    CefRefPtr<CefBrowser> mBrowser;

public:
    BrowserClient() {}

    virtual void OnAfterCreated(CefRefPtr<CefBrowser> browser) {
        // keep browser reference
        std::cout << "OnAfterClose()" << std::endl;
        mBrowser = browser;
    }

    void OnBeforeClose(CefRefPtr<CefBrowser> browser) {
        std::cout << "OnBeforeClose()" << std::endl;
        mBrowser = NULL;
    }

    virtual CefRefPtr<CefRenderHandler> GetRenderHandler() {
        return m_renderHandler;
    }

    virtual bool GetViewRect(CefRefPtr<CefBrowser> browser, CefRect &rect) {
        std::cout << "Setting windowRect" << std::endl;
        rect = CefRect(0, 0, 800, 800);
        return true;
    }

    virtual void OnPaint(CefRefPtr<CefBrowser> browser, PaintElementType type, const RectList &dirtyRects, const void *buffer, int width, int height) {
        //memcpy(texBuf->getCurrentLock().data, buffer, width*height*4);
        std::cout << "Painting!" << std::endl;
    }

    CefRefPtr<CefBrowser> GetBrowser() { return mBrowser; }

    CefRefPtr<CefRenderHandler> m_renderHandler;
    
    IMPLEMENT_REFCOUNTING(BrowserClient);
};

class Browser {
    public:

        CefRefPtr<CefBrowser> browser;
        CefRefPtr<BrowserClient> browserClient;
        
        Browser() {


            //RenderHandler* renderHandler;

            CefWindowInfo window_info;
            CefBrowserSettings browserSettings;

            //renderHandler = new RenderHandler();
            // in linux set a gtk widget, in windows a hwnd. 
            // If not available set nullptr - may cause some render errors, 
            // in context-menu and plugins.
            CefMainArgs args;
            CefSettings settings;
            CefString(&settings.browser_subprocess_path).FromASCII("/usr/lib/python2.7/site-packages/cefpython3/subprocess");
            CefString(&settings.locales_dir_path).FromASCII("Resources/locales");
            CefString(&settings.resources_dir_path).FromASCII("Resources");
            settings.no_sandbox = true;
            settings.multi_threaded_message_loop = false;
            settings.single_process = true;

            int result = CefExecuteProcess(args, NULL, NULL);
            
            if(result >=0)
                std::cout << "Error" << std::endl;

            bool res = CefInitialize(args, settings, NULL, NULL);

            if(!res) 
                std::cout << "Error CefInit" << std::endl;

            window_info.SetAsOffScreen(NULL);
            browserClient = new BrowserClient();

            bool br = CefBrowserHost::CreateBrowser(window_info, browserClient.get(), "http://www.google.com", browserSettings, NULL);

            //browser = CefBrowserHost::CreateBrowserSync(window_info, browserClient.get(), "http://www.google.com", browserSettings, NULL);

            if(!br)
                std::cout << "FAIL!" << std::endl;
            /*
            if(browser == NULL) 
                std::cout << "Error CefBrowserSync" << std::endl;
            */
            std::cout << "Initializing Cef browser" << std::endl;
            //CefRunMessageLoop();


            sleep(20);
            browserClient->GetBrowser()->GetMainFrame()->LoadURL("www.youtube.com");
            std::cout << "Loading youtube" << std::endl;
            //while (!browserClient->GetBrowser())
            //   sleep(1);

            

            // browser_->GetHost()->SendMouseClickEvent(mouseEvent, MBT_LEFT, false, clickCount);
            // CefBrowser.GetImage
        }

        void getScreenshot() {
            //CefDoMessageLoopWork();
            CefRunMessageLoop();
            //std::cout << "BLA" << std::endl;
            //void *buffer;
            //browser.GetImage(0, 0, 800, 800, buffer);
            //browser->GetImage(0, 0, 800, 800, buffer);
        }
};

BOOST_PYTHON_MODULE(libwebBrowser)
{
    class_<Browser>("Browser")
        .def("getScreenshot", &Browser::getScreenshot)
    ;
}
