include (FindPackageHandleStandardArgs)

find_path(AWESOMIUM_INCLUDE_PATH Awesomium/WebCore.h
	PATH_SUFFIXES include
	PATHS
	${AWESOMIUM_ROOT}
	$ENV{AWESOMIUM_ROOT}
	~/Library/Frameworks
	/Library/Frameworks
	/usr/local/
	/usr/
	/sw          # Fink
	/opt/local/  # DarwinPorts
	/opt/csw/    # Blastwave
	/opt/)
	
find_library(AWESOMIUM_LIBRARIES 
	NAMES awesomium awesomium.lib awesomium-1-7
	PATH_SUFFIXES lib64 lib build/lib 
	PATHS
	${AWESOMIUM_ROOT}
	$ENV{AWESOMIUM_ROOT}
	~/Library/Frameworks
	/Library/Frameworks
	/usr/local/
	/usr/
	/sw          # Fink
	/opt/local/  # DarwinPorts
	/opt/csw/    # Blastwave
	/opt/)

find_package_handle_standard_args (Awesomium DEFAULT_MSG AWESOMIUM_INCLUDE_PATH AWESOMIUM_LIBRARIES)
mark_as_advanced (AWESOMIUM_INCLUDE_PATH AWESOMIUM_LIBRARIES)

if (AWESOMIUM_FOUND)
    message (STATUS "Found Awesomium: ${AWESOMIUM_INCLUDE_PATH}")
endif ()
