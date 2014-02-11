cmake_minimum_required (VERSION 2.6)

INCLUDE(CheckCSourceRuns)

set (webBrowser_VERSION_MAJOR 0)
set (webBrowser_VERSION_MINOR 1)

project(webBrowser)

add_library(webBrowser SHARED webBrowser.cpp)

find_package(Boost REQUIRED system thread python)

if(Boost_FOUND)
    SET(Boost_USE_STATIC_LIBS OFF)
    SET(Boost_USE_MULTITHREADED ON)
    SET(Boost_USE_STATIC_RUNTIME OFF)
    include_directories(${Boost_INCLUDE_DIRS})
    target_link_libraries(webBrowser ${Boost_LIBRARIES})
else(Boost_FOUND)
    message(FATAL_ERROR "Boost was not found. Please install boost")
endif(Boost_FOUND)

find_package(PythonLibs REQUIRED)
if(PYTHONLIBS_FOUND)
    include_directories(${PYTHON_INCLUDE_PATH})
    target_link_libraries(webBrowser ${PYTHON_LIBRARIES})
else(PYTHONLIBS_FOUND)
    message(FATAL_ERROR "Python was not found. Please install python")
endif(PYTHONLIBS_FOUND)

# Awesomium
#include_directories(${CMAKE_SOURCE_DIR}/external/awesomium1.7.2/include)
#target_link_libraries(webBrowser ${CMAKE_SOURCE_DIR}/external/awesomium1.7.2/lib/linux64/libawesomium-1-7.so.2.0)
target_link_libraries(webBrowser awesomium-1-7)

find_package(JPEG)
if(JPEG_FOUND)
    include_directories(${JPEG_INCLUDE_PATH})
    target_link_libraries(webBrowser ${JPEG_LIBRARIES})
    
    # Check whether the version of libjpeg we found was libjpeg-turbo and print a
    # warning if not.
    
    set(CMAKE_REQUIRED_LIBRARIES ${JPEG_LIBRARIES})
    set(CMAKE_REQUIRED_FLAGS -I${JPEG_INCLUDE_DIR})

    set(JPEG_TEST_SOURCE "\n
        #include <stdio.h>\n
        #include <jpeglib.h>\n
        int main(void) {\n
            struct jpeg_compress_struct cinfo;\n
            struct jpeg_error_mgr jerr;\n
            cinfo.err=jpeg_std_error(&jerr);\n
            jpeg_create_compress(&cinfo);\n
            cinfo.input_components = 3;\n
            jpeg_set_defaults(&cinfo);\n
            cinfo.in_color_space = JCS_EXT_RGB;\n
            jpeg_default_colorspace(&cinfo);\n
            return 0;\n
        }")

    if(CMAKE_CROSSCOMPILING)
        check_c_source_compiles("${JPEG_TEST_SOURCE}" FOUND_LIBJPEG_TURBO)
    else()
        check_c_source_runs("${JPEG_TEST_SOURCE}" FOUND_LIBJPEG_TURBO)
    endif()

    set(CMAKE_REQUIRED_LIBRARIES)
    set(CMAKE_REQUIRED_FLAGS)
    set(CMAKE_REQUIRED_DEFINITIONS)

    if(NOT FOUND_LIBJPEG_TURBO)
        message(WARNING "*** The libjpeg library you are building against is not libjpeg-turbo.  Performance will be reduced.  You can obtain libjpeg-turbo from:  https://sourceforge.net/projects/libjpeg-turbo/files/ ***")
    endif()
else(JPEG_FOUND)
    message(FATAL_ERROR "libjpeg was not found. Please install libjpeg")
endif(JPEG_FOUND)

IF(CMAKE_COMPILER_IS_GNUCXX)
  ADD_DEFINITIONS("-Wall")
ELSE()
    MESSAGE(FATAL_ERROR "CMakeLists.txt has not been tested/written for your compiler.")
ENDIF()

file(COPY ${CMAKE_SOURCE_DIR}/external/awesomium1.7.2/lib/linux64/libawesomium-1-7.so.2.0 DESTINATION ${CMAKE_BINARY_DIR})
file(COPY ${CMAKE_SOURCE_DIR}/webBrowser.py DESTINATION ${CMAKE_BINARY_DIR})
