#include <iostream>
#include <boost/python.hpp>

#include <Awesomium/WebCore.h>
#include <Awesomium/BitmapSurface.h>
#include <Awesomium/STLHelpers.h>

#include <jpeglib.h>

using namespace boost::python;
using namespace Awesomium;

/* For encoding into base64 */
static char encoding_table[] = {'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',
                                'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P',
                                'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X',
                                'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f',
                                'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n',
                                'o', 'p', 'q', 'r', 's', 't', 'u', 'v',
                                'w', 'x', 'y', 'z', '0', '1', '2', '3',
                                '4', '5', '6', '7', '8', '9', '+', '/'};
static int mod_table[] = {0, 2, 1};


class Browser {
private:
    WebView* mView;
    WebCore* mWebCore;

    std::string mUrl;
    size_t mWidth;
    size_t mHeight;


public:

    Browser(std::string url, size_t width, size_t height ) :
    mUrl(url), mWidth(width), mHeight(height) {
        WebConfig conf;
        conf.log_level = kLogLevel_Verbose;

        mWebCore = WebCore::Initialize(conf);
        //mView = mWebCore->CreateWebView(1981, 1081, 0, kWebViewType_Offscreen);
        mView = mWebCore->CreateWebView(width, height, 0, kWebViewType_Offscreen);
   
        // XXXXX
        WebURL webUrl(WSLit(url.c_str()));
        mView->LoadURL(webUrl);
        
    }

        
    std::string getScreenshot() {
        mWebCore->Update();
        BitmapSurface* surface = (BitmapSurface*)mView->surface();
        
        if (surface != 0) {
            return convertToJpeg(surface->buffer());
        } else {
            std::cout << "Error!" << std::endl;
        }

        return std::string("");
    }

    void resize(int width, int height) {
        mWidth = width;
        mHeight = height;
        mView->Resize(width, height);
    }

    void click(int x, int y) {
        mView->InjectMouseMove(x, y);
        mView->InjectMouseDown(kMouseButton_Left);
        mView->InjectMouseUp(kMouseButton_Left);
    }

private:
    
    char *base64_encode(const unsigned char *data,
                        size_t input_length,
                        size_t *output_length) {

        *output_length = 4 * ((input_length + 2) / 3);

        char *encoded_data = (char*)malloc(sizeof(char*) * *output_length);
        if (encoded_data == NULL) return NULL;

        for (unsigned int i = 0, j = 0; i < input_length;) {

            uint32_t octet_a = i < input_length ? (unsigned char)data[i++] : 0;
            uint32_t octet_b = i < input_length ? (unsigned char)data[i++] : 0;
            uint32_t octet_c = i < input_length ? (unsigned char)data[i++] : 0;

            uint32_t triple = (octet_a << 0x10) + (octet_b << 0x08) + octet_c;

            encoded_data[j++] = encoding_table[(triple >> 3 * 6) & 0x3F];
            encoded_data[j++] = encoding_table[(triple >> 2 * 6) & 0x3F];
            encoded_data[j++] = encoding_table[(triple >> 1 * 6) & 0x3F];
            encoded_data[j++] = encoding_table[(triple >> 0 * 6) & 0x3F];
        }

        for (int i = 0; i < mod_table[input_length % 3]; i++)
            encoded_data[*output_length - 1 - i] = '=';

        return encoded_data;
    }

    /* Converts a line from BGRA to RGB */
    void BGRAtoRGB(const unsigned char* bgra, int pixel_width, unsigned char* rgb) {
        for (int x = 0; x < pixel_width; x++) {
            const unsigned char* pixel_in = &bgra[x * 4];
            unsigned char* pixel_out = &rgb[x * 3];
            pixel_out[0] = pixel_in[2];
            pixel_out[1] = pixel_in[1];
            pixel_out[2] = pixel_in[0];
        }
    }

    std::string convertToJpeg(const unsigned char* buffer) {
        unsigned char* rgb = (unsigned char*) malloc(sizeof(unsigned char*) * mWidth);

        jpeg_compress_struct cinfo;
        jpeg_error_mgr jerr;

        cinfo.err = jpeg_std_error(&jerr);
        jerr.trace_level = 10;
        
        jpeg_create_compress(&cinfo);
        boost::uint8_t *jpeg_buffer_raw = NULL;
        unsigned long outbuffer_size = 0;
        jpeg_mem_dest(&cinfo, &jpeg_buffer_raw, &outbuffer_size);

        cinfo.image_width = mWidth;
        cinfo.image_height = mHeight;
        cinfo.input_components = 3;
        cinfo.in_color_space = JCS_RGB;
        jpeg_set_defaults(&cinfo);

        jpeg_set_quality(&cinfo, 100, true);
        jpeg_start_compress(&cinfo, true);
        int row_stride = mWidth * 4;
        JSAMPROW row_pointer[1];
        
        while (cinfo.next_scanline < cinfo.image_height) {
            BGRAtoRGB(&buffer[cinfo.next_scanline * row_stride], mWidth, rgb);
            row_pointer[0] = (JSAMPROW) rgb;
            jpeg_write_scanlines(&cinfo, row_pointer, 1);
        }

        jpeg_finish_compress(&cinfo);
        jpeg_destroy_compress(&cinfo);
        
        size_t out;
        char* base64 = base64_encode(jpeg_buffer_raw, outbuffer_size, &out);
    
        std::string sBuffer(base64, base64 + out);

	free(rgb);
        free(base64);

        return sBuffer;


     }


};

BOOST_PYTHON_MODULE(libwebBrowser)
{
    class_<Browser>("Browser", init<std::string, size_t, size_t>())
        .def("getScreenshot", &Browser::getScreenshot)
        .def("resize", &Browser::resize)
        .def("click", &Browser::click)
    ;
}
