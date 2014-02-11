cmake_minimum_required (VERSION 2.6)

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

find_package(GTK2)
if(GTK2_FOUND)
    set(CEF3_INCLUDE_DIRS "${CMAKE_SOURCE_DIR}/external/cef3/include" "${CMAKE_SOURCE_DIR}/external/cef3")
    set(CEF3_LIBRARIES "${CMAKE_SOURCE_DIR}/external/cef3/lib/linux64/libcef.so" "${CMAKE_SOURCE_DIR}/external/cef3/lib/linux64/libffmpegsumo.so" "${CMAKE_SOURCE_DIR}/external/cef3/lib/linux64/libcef_dll_wrapper.a")
    include_directories(${GTK2_INCLUDE_DIRS})
    include_directories(${CEF3_INCLUDE_DIRS})
    target_link_libraries(webBrowser ${CEF3_LIBRARIES})
    target_link_libraries(webBrowser ${GTK2_LIBRARIES})
else(GTK2_FOUND)
    message(FATAL_ERROR "GTK+ was not found. Please install gtk+")
endif(GTK2_FOUND)

IF(CMAKE_COMPILER_IS_GNUCXX)
  ADD_DEFINITIONS("-Wall")
ELSE()
    MESSAGE(FATAL_ERROR "CMakeLists.txt has not been tested/written for your compiler.")
ENDIF()

file(COPY ${CMAKE_SOURCE_DIR}/webBrowser.py DESTINATION ${CMAKE_BINARY_DIR})
file(COPY ${CMAKE_SOURCE_DIR}/Resources DESTINATION ${CMAKE_BINARY_DIR})
file(COPY ${CMAKE_SOURCE_DIR}/external/cef3/lib/linux64/libcef.so DESTINATION ${CMAKE_BINARY_DIR})

